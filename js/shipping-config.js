/**
 * Naturaleza Activa — configuración de envíos y productos
 * Sitio estático: ajustá constantes acá; no hace falta backend.
 */
window.NA_CONFIG = {
  /* Origen Lobos (B7240). */
  ORIGIN_CP: "7240",

  CONTACT_EMAIL: "contactonaturalezaactiva@gmail.com",

  /**
   * Checkout Pro vía Cloudflare Worker (preference dinámica = producto + envío).
   * MP_WORKER_URL: URL del Worker desplegado (…workers.dev). Vacío = pago aún no listo.
   */
  MP_CHECKOUT_READY: true,
  MP_WORKER_URL: "https://naturaleza-activa-checkout.waiting-sugar.workers.dev",

  PRODUCTS: {
    "medio-kilo": {
      id: "medio-kilo",
      name: "½ kilo",
      weightKg: 0.5,
      price: 5000,
      perKg: 10000
    },
    kilo: {
      id: "kilo",
      name: "1 kilo",
      weightKg: 1,
      price: 9500,
      perKg: 9500
    },
    balde: {
      id: "balde",
      name: "Balde 10 kg",
      weightKg: 10,
      price: 65000,
      perKg: 6500
    },
    "combo-familiar": {
      id: "combo-familiar",
      name: "Combo familiar — 2 kilos",
      weightKg: 2,
      price: 18000,
      perKg: 9000,
      promo: true
    },
    "combo-5kg": {
      id: "combo-5kg",
      name: "Combo 5 kilos",
      weightKg: 5,
      price: 42000,
      perKg: 8400,
      promo: true
    },
    "pack-3kg-envio": {
      id: "pack-3kg-envio",
      name: "Pack 3 kilos con envío gratis",
      weightKg: 3,
      price: 31900,
      perKg: 10633,
      promo: true,
      /* Bonifica hasta $6.500 de envío (sujeto a zona). */
      freeShippingUpTo: 6500
    }
  },

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
