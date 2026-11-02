(function () {
  "use strict";

  var cfg = window.NA_CONFIG || {};
  var header = document.querySelector("[data-header]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!reduceMotion && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* —— CP → zona (Argentina, 4 dígitos) —— */
  function zoneFromCp(cp) {
    var n = parseInt(cp, 10);
    if (!n || cp.length !== 4) return null;
    if (n >= 1000 && n <= 1499) return "caba";
    if (n >= 1500 && n <= 1999) return "gba";
    if (n >= 8300 && n <= 9420) return "patagonia";
    if (n >= 1000 && n <= 9999) return "interior";
    return null;
  }

  function weightKey(weightKg) {
    if (weightKg <= 0.5) return "0.5";
    if (weightKg <= 1) return "1";
    return "10";
  }

  function formatArs(n) {
    return (
      "$" +
      Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    );
  }

  function quoteShipping(productId, cp) {
    var product = cfg.PRODUCTS[productId];
    if (!product) return { error: "Elegí una presentación." };
    if (!/^\d{4}$/.test(cp)) return { error: "Ingresá un código postal de 4 dígitos." };

    var zoneId = zoneFromCp(cp);
    if (!zoneId) return { error: "No pudimos ubicar ese CP. Probá de nuevo." };

    var zone = cfg.ZONES[zoneId];
    var wk = weightKey(product.weightKg);
    var shipping = cfg.RATES[zoneId][wk];
    if (typeof shipping !== "number") return { error: "Sin tarifa para esa combinación." };

    return {
      product: product,
      cp: cp,
      zone: zone,
      shipping: shipping,
      total: product.price + shipping,
      originCp: cfg.ORIGIN_CP
    };
  }

  /* —— Checkout UI —— */
  var form = document.querySelector("[data-checkout-form]");
  if (!form) return;

  var productSelect = form.querySelector("[name=product]");
  var cpInput = form.querySelector("[name=cp]");
  var resultEl = document.querySelector("[data-checkout-result]");
  var errorEl = document.querySelector("[data-checkout-error]");
  var originEl = document.querySelectorAll("[data-origin-cp]");
  var payBtn = document.querySelector("[data-pay-btn]");
  var payNote = document.querySelector("[data-pay-note]");

  originEl.forEach(function (el) {
    el.textContent = cfg.ORIGIN_CP || "XXXX";
  });

  function setError(msg) {
    if (!errorEl) return;
    errorEl.hidden = !msg;
    errorEl.textContent = msg || "";
  }

  function clearResult() {
    if (resultEl) resultEl.hidden = true;
    if (payBtn) {
      payBtn.hidden = true;
      payBtn.removeAttribute("data-total");
      payBtn.href = "#";
      payBtn.removeAttribute("aria-busy");
      payBtn.classList.remove("is-loading");
    }
  }

  function checkoutReady() {
    return !!(cfg.MP_CHECKOUT_READY && cfg.MP_WORKER_URL);
  }

  function renderQuote(q) {
    setError("");
    if (!resultEl) return;

    resultEl.hidden = false;
    resultEl.querySelector("[data-q-product]").textContent = q.product.name;
    resultEl.querySelector("[data-q-product-price]").textContent = formatArs(q.product.price);
    resultEl.querySelector("[data-q-zone]").textContent = q.zone.label;
    resultEl.querySelector("[data-q-cp]").textContent = q.cp;
    resultEl.querySelector("[data-q-shipping]").textContent = formatArs(q.shipping);
    resultEl.querySelector("[data-q-total]").textContent = formatArs(q.total);

    if (!payBtn) return;
    payBtn.hidden = false;
    payBtn.setAttribute("data-product", q.product.id);
    payBtn.setAttribute("data-cp", q.cp);
    payBtn.setAttribute("data-zone", q.zone.id);
    payBtn.setAttribute("data-shipping", String(q.shipping));
    payBtn.setAttribute("data-total", String(q.total));
    payBtn.textContent = "Pagar " + formatArs(q.total);
    payBtn.href = "#compra-pago";
    payBtn.setAttribute("aria-disabled", "false");

    if (checkoutReady()) {
      if (payNote) {
        payNote.hidden = false;
        payNote.textContent =
          "Al pagar abrís Mercado Pago Checkout Pro por el total (producto + envío).";
      }
      var next = document.getElementById("compra-pago");
      if (next) next.hidden = true;
    } else {
      if (payNote) {
        payNote.hidden = false;
        payNote.innerHTML =
          "El total incluye envío. Checkout Pro se activa cuando el Worker esté desplegado. " +
          "Mientras tanto, escribinos a <a href=\"mailto:" +
          cfg.CONTACT_EMAIL +
          "?subject=" +
          encodeURIComponent("Pedido " + q.product.name + " — CP " + q.cp) +
          "&body=" +
          encodeURIComponent(
            "Hola, quiero comprar:\n- Producto: " +
              q.product.name +
              " (" +
              formatArs(q.product.price) +
              ")\n- CP destino: " +
              q.cp +
              " (" +
              q.zone.label +
              ")\n- Envío estimado: " +
              formatArs(q.shipping) +
              "\n- Total: " +
              formatArs(q.total) +
              "\n\nOrigen cotizado desde CP " +
              q.originCp +
              ".\n"
          ) +
          "\">" +
          cfg.CONTACT_EMAIL +
          "</a> con este resumen y te mandamos el cobro exacto.";
      }
    }
  }

  function startCheckout(e) {
    e.preventDefault();
    if (!checkoutReady()) {
      var panel = document.getElementById("compra-pago");
      if (panel) {
        panel.hidden = false;
        panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
      }
      return;
    }

    var productId = payBtn.getAttribute("data-product");
    var cp = payBtn.getAttribute("data-cp");
    var shipping = payBtn.getAttribute("data-shipping");
    var total = payBtn.getAttribute("data-total");
    if (!productId || !cp || !shipping || !total) {
      setError("Recalculá el envío antes de pagar.");
      return;
    }

    setError("");
    /* Full-page navigation (not fetch): survives Cloudflare interstitial on workers.dev */
    var endpoint = String(cfg.MP_WORKER_URL).replace(/\/$/, "") + "/checkout";
    var params = new URLSearchParams({
      productId: productId,
      cp: cp,
      shipping: String(shipping),
      total: String(total)
    });
    payBtn.setAttribute("aria-busy", "true");
    payBtn.textContent = "Conectando con Mercado Pago…";
    window.location.href = endpoint + "?" + params.toString();
  }

  /* Show Worker/checkout errors returned via ?checkout_error=…#compra */
  (function showCheckoutError() {
    try {
      var params = new URLSearchParams(window.location.search);
      var err = params.get("checkout_error");
      if (!err) return;
      setError(err);
      var target = document.getElementById("compra");
      if (target) target.scrollIntoView({ behavior: "smooth" });
      if (window.history && window.history.replaceState) {
        params.delete("checkout_error");
        var next = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + "#compra";
        window.history.replaceState(null, "", next);
      }
    } catch (_) {}
  })();



  function runQuote() {
    var productId = productSelect.value;
    var cp = (cpInput.value || "").replace(/\D/g, "").slice(0, 4);
    cpInput.value = cp;
    clearResult();
    var q = quoteShipping(productId, cp);
    if (q.error) {
      setError(q.error);
      return;
    }
    renderQuote(q);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    runQuote();
  });

  document.querySelectorAll("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var id = btn.getAttribute("data-buy");
      if (productSelect && id) productSelect.value = id;
      if (cpInput) cpInput.focus();
      var target = document.getElementById("compra");
      if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      clearResult();
      setError("");
    });
  });

  if (payBtn) {
    payBtn.addEventListener("click", startCheckout);
  }
})();
