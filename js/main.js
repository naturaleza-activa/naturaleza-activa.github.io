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

  function suggestProvince(zoneId) {
    if (zoneId === "caba") return "CABA";
    if (zoneId === "gba" || zoneId === "interior") return "Buenos Aires";
    return "";
  }

  /* —— Checkout UI —— */
  var form = document.querySelector("[data-checkout-form]");
  if (!form) return;

  var productSelect = form.querySelector("[name=product]");
  var cpInput = form.querySelector("[name=cp]");
  var resultEl = document.querySelector("[data-checkout-result]");
  var errorEl = document.querySelector("[data-checkout-error]");
  var originEl = document.querySelectorAll("[data-origin-cp]");
  var addressForm = document.querySelector("[data-address-form]");
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
    if (addressForm) addressForm.hidden = true;
    if (payBtn) {
      payBtn.hidden = true;
      payBtn.removeAttribute("aria-busy");
      payBtn.classList.remove("is-loading");
    }
  }

  function checkoutReady() {
    return !!(cfg.MP_CHECKOUT_READY && cfg.MP_WORKER_URL);
  }

  function workerCheckoutUrl() {
    return String(cfg.MP_WORKER_URL || "").replace(/\/$/, "") + "/checkout";
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

    if (!addressForm || !payBtn) return;

    addressForm.hidden = false;
    addressForm.action = checkoutReady() ? workerCheckoutUrl() : "#compra-pago";
    addressForm.method = checkoutReady() ? "post" : "get";

    addressForm.querySelector('[name="productId"]').value = q.product.id;
    addressForm.querySelector('[name="shipping"]').value = String(q.shipping);
    addressForm.querySelector('[name="total"]').value = String(q.total);
    addressForm.querySelector('[name="zone"]').value = q.zone.id;
    addressForm.querySelector('[name="cp"]').value = q.cp;

    var provinceSelect = addressForm.querySelector("[data-province]");
    if (provinceSelect && !provinceSelect.value) {
      var suggested = suggestProvince(q.zone.id);
      if (suggested) provinceSelect.value = suggested;
    }

    payBtn.hidden = false;
    payBtn.textContent = "Pagar " + formatArs(q.total);
    payBtn.removeAttribute("aria-busy");
    payBtn.classList.remove("is-loading");

    if (checkoutReady()) {
      if (payNote) {
        payNote.hidden = false;
        payNote.textContent =
          "Completá la dirección y pagá: abrís Mercado Pago por el total (producto + envío).";
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
          "\">" +
          cfg.CONTACT_EMAIL +
          "</a>.";
      }
    }
  }

  function validateAddress(formEl) {
    var name = (formEl.querySelector('[name="name"]').value || "").trim();
    var dni = (formEl.querySelector('[name="dni"]').value || "").replace(/\D/g, "").slice(0, 8);
    var email = (formEl.querySelector('[name="email"]').value || "").trim();
    var phone = (formEl.querySelector('[name="phone"]').value || "").trim();
    var street = (formEl.querySelector('[name="street"]').value || "").trim();
    var city = (formEl.querySelector('[name="city"]').value || "").trim();
    var province = (formEl.querySelector('[name="province"]').value || "").trim();
    var cp = (formEl.querySelector('[name="cp"]').value || "").replace(/\D/g, "").slice(0, 4);
    formEl.querySelector('[name="dni"]').value = dni;
    formEl.querySelector('[name="cp"]').value = cp;

    if (name.length < 3) return "Ingresá nombre y apellido.";
    if (!/^\d{7,8}$/.test(dni)) return "Ingresá un DNI válido (7 u 8 dígitos).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresá un email válido.";
    if (phone.replace(/\D/g, "").length < 8) return "Ingresá un teléfono válido.";
    if (street.length < 3) return "Ingresá calle y número.";
    if (city.length < 2) return "Ingresá la ciudad.";
    if (!province) return "Elegí la provincia.";
    if (!/^\d{4}$/.test(cp)) return "CP inválido.";
    return null;
  }

  function onAddressSubmit(e) {
    if (!checkoutReady()) {
      e.preventDefault();
      var panel = document.getElementById("compra-pago");
      if (panel) {
        panel.hidden = false;
        panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
      }
      return;
    }

    var err = validateAddress(addressForm);
    if (err) {
      e.preventDefault();
      setError(err);
      return;
    }

    setError("");
    if (payBtn) {
      payBtn.setAttribute("aria-busy", "true");
      payBtn.classList.add("is-loading");
      payBtn.textContent = "Conectando con Mercado Pago…";
    }
    /* Native form POST → Worker → 302 Mercado Pago */
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
        var next =
          window.location.pathname +
          (params.toString() ? "?" + params.toString() : "") +
          "#compra";
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

  if (addressForm) {
    addressForm.addEventListener("submit", onAddressSubmit);
  }

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
})();
