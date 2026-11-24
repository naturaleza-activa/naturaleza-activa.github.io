(function () {
  "use strict";

  var cfg = window.NA_CONFIG || {};
  var header = document.querySelector("[data-header]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FREE_SHIP_PACK_ID = "pack-3kg-envio";

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

  /**
   * Mapea peso total del carrito a la franja de tarifa más cercana por arriba.
   * Sobre 10 kg: múltiplos de la tarifa de 10 kg (ceil).
   */
  function shippingForWeight(zoneId, weightKg) {
    var rates = cfg.RATES[zoneId];
    if (!rates || !(weightKg > 0)) return null;
    if (weightKg <= 0.5) return rates["0.5"];
    if (weightKg <= 1) return rates["1"];
    if (weightKg <= 2) return rates["2"];
    if (weightKg <= 3) return rates["3"];
    if (weightKg <= 5) return rates["5"];
    if (weightKg <= 10) return rates["10"];
    var blocks = Math.ceil(weightKg / 10);
    return rates["10"] * blocks;
  }

  function formatArs(n) {
    return (
      "$" +
      Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    );
  }

  function formatWeight(kg) {
    var n = Math.round(kg * 100) / 100;
    return String(n).replace(".", ",");
  }

  /* —— Carrito en memoria —— */
  /** @type {Record<string, number>} */
  var cartQty = {};

  function cartLines() {
    var products = cfg.PRODUCTS || {};
    var order = Object.keys(products);
    var lines = [];
    order.forEach(function (id) {
      var qty = cartQty[id] || 0;
      if (qty <= 0) return;
      var product = products[id];
      if (!product) return;
      lines.push({
        id: id,
        product: product,
        qty: qty,
        linePrice: product.price * qty,
        lineWeight: product.weightKg * qty
      });
    });
    return lines;
  }

  function cartTotals(lines) {
    var subtotal = 0;
    var weightKg = 0;
    var onlyFreePack = lines.length > 0;
    var freePackQty = 0;
    lines.forEach(function (line) {
      subtotal += line.linePrice;
      weightKg += line.lineWeight;
      if (line.id !== FREE_SHIP_PACK_ID) onlyFreePack = false;
      else freePackQty += line.qty;
    });
    if (!lines.length) onlyFreePack = false;
    return {
      subtotal: subtotal,
      weightKg: weightKg,
      onlyFreePack: onlyFreePack,
      freePackQty: freePackQty
    };
  }

  function setCartQty(id, qty) {
    var n = Math.max(0, Math.min(99, Math.floor(Number(qty) || 0)));
    if (n <= 0) delete cartQty[id];
    else cartQty[id] = n;
  }

  function addToCart(id, delta) {
    if (!cfg.PRODUCTS || !cfg.PRODUCTS[id]) return;
    setCartQty(id, (cartQty[id] || 0) + (delta || 1));
  }

  /**
   * Regla de envío mixto:
   * - Solo Pack 3 kg en el carrito → bonifica freeShippingUpTo × cantidad.
   * - Carrito mixto → tarifa por peso total, sin bonificación.
   */
  function quoteCartShipping(cp) {
    var lines = cartLines();
    if (!lines.length) return { error: "Sumá al menos un producto al carrito." };
    if (!/^\d{4}$/.test(cp)) return { error: "Ingresá un código postal de 4 dígitos." };

    var zoneId = zoneFromCp(cp);
    if (!zoneId) return { error: "No pudimos ubicar ese CP. Probá de nuevo." };

    var zone = cfg.ZONES[zoneId];
    var totals = cartTotals(lines);
    var rawShipping = shippingForWeight(zoneId, totals.weightKg);
    if (typeof rawShipping !== "number") return { error: "Sin tarifa para esa combinación." };

    var shippingBonus = 0;
    var freeShipping = false;
    if (totals.onlyFreePack) {
      var pack = cfg.PRODUCTS[FREE_SHIP_PACK_ID];
      var cap = pack && typeof pack.freeShippingUpTo === "number" ? pack.freeShippingUpTo : 0;
      shippingBonus = Math.min(cap * totals.freePackQty, rawShipping);
    }
    var shipping = Math.max(0, rawShipping - shippingBonus);
    freeShipping = shipping === 0 && shippingBonus > 0;

    return {
      lines: lines,
      cp: cp,
      zone: zone,
      weightKg: totals.weightKg,
      productsSubtotal: totals.subtotal,
      shipping: shipping,
      rawShipping: rawShipping,
      freeShipping: freeShipping,
      shippingBonus: shippingBonus,
      onlyFreePack: totals.onlyFreePack,
      total: totals.subtotal + shipping,
      originCp: cfg.ORIGIN_CP,
      cartPayload: lines.map(function (l) {
        return { id: l.id, qty: l.qty };
      })
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

  var cpInput = form.querySelector("[name=cp]");
  var resultEl = document.querySelector("[data-checkout-result]");
  var errorEl = document.querySelector("[data-checkout-error]");
  var originEl = document.querySelectorAll("[data-origin-cp]");
  var addressForm = document.querySelector("[data-address-form]");
  var payBtn = document.querySelector("[data-pay-btn]");
  var payNote = document.querySelector("[data-pay-note]");
  var cartLinesEl = document.querySelector("[data-cart-lines]");
  var cartEmptyEl = document.querySelector("[data-cart-empty]");
  var cartSubtotalEl = document.querySelector("[data-cart-subtotal]");
  var cartSubtotalValueEl = document.querySelector("[data-cart-subtotal-value]");
  var cartWeightEl = document.querySelector("[data-cart-weight]");
  var cartAddSelect = document.querySelector("[data-cart-add-product]");
  var cartAddBtn = document.querySelector("[data-cart-add]");
  var lastQuote = null;

  originEl.forEach(function (el) {
    el.textContent = cfg.ORIGIN_CP || "XXXX";
  });

  function setError(msg) {
    if (!errorEl) return;
    errorEl.hidden = !msg;
    errorEl.textContent = msg || "";
  }

  function clearResult() {
    lastQuote = null;
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

  function renderCart() {
    var lines = cartLines();
    var totals = cartTotals(lines);

    if (cartEmptyEl) cartEmptyEl.hidden = lines.length > 0;
    if (cartSubtotalEl) cartSubtotalEl.hidden = lines.length === 0;
    if (cartSubtotalValueEl) cartSubtotalValueEl.textContent = formatArs(totals.subtotal);
    if (cartWeightEl) cartWeightEl.textContent = formatWeight(totals.weightKg);

    if (!cartLinesEl) return;
    cartLinesEl.innerHTML = "";

    lines.forEach(function (line) {
      var li = document.createElement("li");
      li.className = "cart__line";
      li.setAttribute("data-cart-line", line.id);

      var info = document.createElement("div");
      info.className = "cart__line-info";

      var name = document.createElement("div");
      name.className = "cart__line-name";
      name.textContent = line.product.name;

      var meta = document.createElement("div");
      meta.className = "cart__line-meta";
      meta.textContent =
        formatArs(line.product.price) +
        " c/u · " +
        formatWeight(line.lineWeight) +
        " kg · " +
        formatArs(line.linePrice);

      info.appendChild(name);
      info.appendChild(meta);

      var controls = document.createElement("div");
      controls.className = "cart__line-controls";

      var qtyWrap = document.createElement("div");
      qtyWrap.className = "cart__qty";
      qtyWrap.setAttribute("role", "group");
      qtyWrap.setAttribute("aria-label", "Cantidad de " + line.product.name);

      var minus = document.createElement("button");
      minus.type = "button";
      minus.className = "cart__qty-btn";
      minus.setAttribute("data-cart-dec", line.id);
      minus.setAttribute("aria-label", "Quitar uno");
      minus.textContent = "−";

      var qty = document.createElement("span");
      qty.className = "cart__qty-value";
      qty.textContent = String(line.qty);

      var plus = document.createElement("button");
      plus.type = "button";
      plus.className = "cart__qty-btn";
      plus.setAttribute("data-cart-inc", line.id);
      plus.setAttribute("aria-label", "Sumar uno");
      plus.textContent = "+";

      qtyWrap.appendChild(minus);
      qtyWrap.appendChild(qty);
      qtyWrap.appendChild(plus);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart__remove";
      remove.setAttribute("data-cart-remove", line.id);
      remove.textContent = "Quitar";

      controls.appendChild(qtyWrap);
      controls.appendChild(remove);

      li.appendChild(info);
      li.appendChild(controls);
      cartLinesEl.appendChild(li);
    });
  }

  function renderQuote(q) {
    setError("");
    if (!resultEl) return;
    lastQuote = q;

    resultEl.hidden = false;

    var linesEl = resultEl.querySelector("[data-q-lines]");
    if (linesEl) {
      linesEl.innerHTML = "";
      q.lines.forEach(function (line) {
        var li = document.createElement("li");
        li.className = "quote-lines__item";
        li.textContent =
          line.qty +
          " × " +
          line.product.name +
          " — " +
          formatArs(line.linePrice);
        linesEl.appendChild(li);
      });
    }

    resultEl.querySelector("[data-q-products]").textContent = formatArs(q.productsSubtotal);
    resultEl.querySelector("[data-q-zone]").textContent = q.zone.label;
    resultEl.querySelector("[data-q-cp]").textContent = q.cp;
    resultEl.querySelector("[data-q-weight]").textContent = formatWeight(q.weightKg);

    var shipLabel = formatArs(q.shipping);
    if (q.freeShipping) {
      shipLabel = "Gratis";
    } else if (q.shippingBonus) {
      shipLabel = formatArs(q.shipping) + " (bonificamos " + formatArs(q.shippingBonus) + ")";
    }
    resultEl.querySelector("[data-q-shipping]").textContent = shipLabel;
    resultEl.querySelector("[data-q-total]").textContent = formatArs(q.total);

    var shipNote = resultEl.querySelector("[data-q-ship-note]");
    if (shipNote) {
      if (q.onlyFreePack && q.shippingBonus) {
        shipNote.hidden = false;
        shipNote.textContent =
          "Bonificación Pack 3 kg aplicada (hasta $6.500 por pack, solo carrito de ese pack).";
      } else if (!q.onlyFreePack && q.lines.some(function (l) { return l.id === FREE_SHIP_PACK_ID; })) {
        shipNote.hidden = false;
        shipNote.textContent =
          "Carrito mixto: la bonificación del Pack 3 kg no aplica; envío por peso total.";
      } else {
        shipNote.hidden = true;
        shipNote.textContent = "";
      }
    }

    if (!addressForm || !payBtn) return;

    addressForm.hidden = false;
    addressForm.action = checkoutReady() ? workerCheckoutUrl() : "#compra-pago";
    addressForm.method = checkoutReady() ? "post" : "get";

    var legacyId = q.cartPayload.length === 1 ? q.cartPayload[0].id : "cart";
    addressForm.querySelector('[name="productId"]').value = legacyId;
    addressForm.querySelector('[name="cart"]').value = JSON.stringify(q.cartPayload);
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
          "Completá la dirección y pagá: abrís Mercado Pago por el total del carrito (productos + envío).";
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

    if (!lastQuote || !lastQuote.cartPayload.length) {
      e.preventDefault();
      setError("Recalculá el envío del carrito.");
      return;
    }

    var err = validateAddress(addressForm);
    if (err) {
      e.preventDefault();
      setError(err);
      return;
    }

    /* Re-sync hidden fields from last quote (qty may have changed without re-quote) */
    var current = quoteCartShipping(lastQuote.cp);
    if (current.error || current.total !== lastQuote.total || current.shipping !== lastQuote.shipping) {
      e.preventDefault();
      setError("El carrito cambió. Volvé a calcular el envío.");
      clearResult();
      if (!current.error) renderQuote(current);
      return;
    }

    addressForm.querySelector('[name="cart"]').value = JSON.stringify(lastQuote.cartPayload);
    addressForm.querySelector('[name="productId"]').value =
      lastQuote.cartPayload.length === 1 ? lastQuote.cartPayload[0].id : "cart";
    addressForm.querySelector('[name="shipping"]').value = String(lastQuote.shipping);
    addressForm.querySelector('[name="total"]').value = String(lastQuote.total);

    setError("");
    if (payBtn) {
      payBtn.setAttribute("aria-busy", "true");
      payBtn.classList.add("is-loading");
      payBtn.textContent = "Conectando con Mercado Pago…";
    }
    /* Native form POST → Worker → 302 Mercado Pago */
  }

  /* Vuelta desde Mercado Pago: ?payment=success|pending|failure */
  (function showPaymentReturn() {
    try {
      var params = new URLSearchParams(window.location.search);
      var status = params.get("payment");
      var box = document.querySelector("[data-payment-return]");
      if (!status || !box) return;
      var mp = params.get("status") || params.get("collection_status");
      if (status === "success" && mp && mp !== "approved") status = mp === "in_process" ? "pending" : "failure";
      var copy = {
        success: [
          "¡Gracias por tu compra!",
          "Tu pago fue aprobado. Te escribimos al mail que dejaste para coordinar el envío. Cualquier duda: " + cfg.CONTACT_EMAIL + "."
        ],
        pending: [
          "Tu pago está pendiente",
          "Mercado Pago todavía está procesando el pago. Apenas se acredite te escribimos para coordinar el envío."
        ],
        failure: [
          "No se completó el pago",
          "El pago no se realizó y no se te cobró. Podés volver a intentarlo o escribirnos a " + cfg.CONTACT_EMAIL + "."
        ]
      };
      var c = copy[status];
      if (!c) return;
      box.className = "checkout__return checkout__return--" + status;
      box.querySelector("[data-payment-return-title]").textContent = c[0];
      box.querySelector("[data-payment-return-text]").textContent = c[1];
      box.hidden = false;
      var target = document.getElementById("compra");
      if (target) target.scrollIntoView({ behavior: "smooth" });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + "#compra");
      }
    } catch (_) {}
  })();

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
    var cp = (cpInput.value || "").replace(/\D/g, "").slice(0, 4);
    cpInput.value = cp;
    clearResult();
    var q = quoteCartShipping(cp);
    if (q.error) {
      setError(q.error);
      return;
    }
    renderQuote(q);
  }

  function afterCartChange() {
    renderCart();
    clearResult();
    setError("");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    runQuote();
  });

  if (addressForm) {
    addressForm.addEventListener("submit", onAddressSubmit);
  }

  if (cartAddBtn && cartAddSelect) {
    cartAddBtn.addEventListener("click", function () {
      var id = cartAddSelect.value;
      if (!id) return;
      addToCart(id, 1);
      afterCartChange();
    });
  }

  if (cartLinesEl) {
    cartLinesEl.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var rem = t.closest("[data-cart-remove]");
      if (rem) {
        setCartQty(rem.getAttribute("data-cart-remove"), 0);
        afterCartChange();
        return;
      }
      var inc = t.closest("[data-cart-inc]");
      if (inc) {
        addToCart(inc.getAttribute("data-cart-inc"), 1);
        afterCartChange();
        return;
      }
      var dec = t.closest("[data-cart-dec]");
      if (dec) {
        addToCart(dec.getAttribute("data-cart-dec"), -1);
        afterCartChange();
      }
    });
  }

  document.querySelectorAll("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var id = btn.getAttribute("data-buy");
      if (id) addToCart(id, 1);
      afterCartChange();
      if (cpInput) cpInput.focus();
      var target = document.getElementById("compra");
      if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  renderCart();
})();
