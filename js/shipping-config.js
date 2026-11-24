/**
 * Naturaleza Activa — configuración de envíos y productos
 * Sitio estático: ajustá constantes acá; no hace falta backend.
 */
(function () {
  /**
   * Campaña Black Friday (mantener sincronizado con worker/index.js).
   * - Para extender al 29/11: cambiar `untilLabel` a "29/11" y `untilDate` a "2026-11-29".
   * - Para volver a precios regulares: poner `active: false` (y replicar en worker/index.js).
   */
  var PROMO_CAMPAIGN = {
    active: true,
    name: "Black Friday",
    badge: "Black Friday",
    untilLabel: "27/11",
    untilDate: "2026-11-27",
    copy: "Ofertas en combos y balde",
    ctaLabel: "Ver ofertas",
    prices: {
      balde: 59000,
      "combo-familiar": 16500,
      "combo-5kg": 37900,
      "pack-3kg-envio": 28900
    }
  };

  var BASE_PRODUCTS = {
    "medio-kilo": {
      id: "medio-kilo",
      name: "½ kilo",
      selectLabel: "½ kilo",
      weightKg: 0.5,
      price: 5000
    },
    kilo: {
      id: "kilo",
      name: "1 kilo",
      selectLabel: "1 kilo",
      weightKg: 1,
      price: 9500
    },
    balde: {
      id: "balde",
      name: "Balde 10 kg",
      selectLabel: "Balde 10 kg",
      weightKg: 10,
      price: 65000
    },
    "combo-familiar": {
      id: "combo-familiar",
      name: "Combo familiar — 2 kilos",
      selectLabel: "Combo familiar 2 kg",
      weightKg: 2,
      price: 18000,
      promo: true
    },
    "combo-5kg": {
      id: "combo-5kg",
      name: "Combo 5 kilos",
      selectLabel: "Combo 5 kg",
      weightKg: 5,
      price: 42000,
      promo: true
    },
    "pack-3kg-envio": {
      id: "pack-3kg-envio",
      name: "Pack 3 kilos con envío gratis",
      selectLabel: "Pack 3 kg envío gratis",
      weightKg: 3,
      price: 31900,
      promo: true,
      /**
       * Bonifica hasta $6.500 de envío × cantidad, SOLO si el carrito
       * tiene únicamente este pack. En carritos mixtos no aplica.
       */
      freeShippingUpTo: 6500
    }
  };

  var PRODUCTS = {};
  Object.keys(BASE_PRODUCTS).forEach(function (id) {
    var base = BASE_PRODUCTS[id];
    var promoPrice =
      PROMO_CAMPAIGN.active && typeof PROMO_CAMPAIGN.prices[id] === "number"
        ? PROMO_CAMPAIGN.prices[id]
        : null;
    var activePrice = promoPrice !== null ? promoPrice : base.price;
    var entry = {};
    Object.keys(base).forEach(function (k) {
      entry[k] = base[k];
    });
    entry.regularPrice = base.price;
    entry.price = activePrice;
    entry.perKg = Math.round(activePrice / base.weightKg);
    entry.onSale = promoPrice !== null && promoPrice < base.price;
    if (entry.onSale) {
      entry.saleLabel = PROMO_CAMPAIGN.badge;
    }
    PRODUCTS[id] = entry;
  });

  window.NA_CONFIG = {
    /* Origen Lobos (B7240). */
    ORIGIN_CP: "7240",

    CONTACT_EMAIL: "contactonaturalezaactiva@gmail.com",

    /**
     * Checkout Pro vía Cloudflare Worker (preference dinámica = producto + envío).
     * MP_WORKER_URL: URL del Worker desplegado (…workers.dev). Vacío = pago aún no listo.
     */
    MP_CHECKOUT_READY: true,
    MP_WORKER_URL: "https://naturaleza-activa-checkout.legend-move.workers.dev",

    PROMO_CAMPAIGN: PROMO_CAMPAIGN,

    PRODUCTS: PRODUCTS,

    ZONES: {
      caba: { id: "caba", label: "CABA" },
      gba: { id: "gba", label: "GBA / AMBA" },
      interior: { id: "interior", label: "Interior" },
      patagonia: { id: "patagonia", label: "Patagonia / Sur" }
    },

    /**
     * Tarifas estimadas (ARS) — opción más económica práctica por zona y peso.
     * Claves: "0.5" | "1" | "2" | "3" | "5" | "10"
     */
    RATES: {
      caba: { "0.5": 4500, "1": 5500, "2": 6500, "3": 7500, "5": 9000, "10": 12500 },
      gba: { "0.5": 5500, "1": 6500, "2": 7500, "3": 8500, "5": 10500, "10": 14500 },
      interior: { "0.5": 7500, "1": 9000, "2": 11000, "3": 13000, "5": 16000, "10": 22000 },
      patagonia: { "0.5": 11000, "1": 13000, "2": 16000, "3": 19000, "5": 23000, "10": 32000 }
    }
  };
})();
