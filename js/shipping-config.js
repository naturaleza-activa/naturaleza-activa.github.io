/**
 * Naturaleza Activa — configuración de envíos y productos
 * Sitio estático: ajustá constantes acá; no hace falta backend.
 */
window.NA_CONFIG = {
  /* Origen Lobos (B7240). */
  ORIGIN_CP: "7240",

  CONTACT_EMAIL: "contactonaturalezaactiva@gmail.com",

  /**
   * Cuando haya Checkout Pro / preference dinámica, poné true y
   * cableá MP_CHECKOUT_URL o el handler en main.js.
   * Mientras sea false, "Pagar" queda listo con data-* y muestra el aviso.
   */
  MP_CHECKOUT_READY: false,
  MP_CHECKOUT_URL: "",

  /* Links fijos de producto (placeholders hasta Checkout Pro). */
  MP_PRODUCT_LINKS: {
    "medio-kilo": "#mp-medio-kilo",
    kilo: "#mp-kilo",
    balde: "#mp-balde"
  },

  PRODUCTS: {
    "medio-kilo": {
      id: "medio-kilo",
      name: "½ kilo",
      weightKg: 0.5,
      price: 5000
    },
    kilo: {
      id: "kilo",
      name: "1 kilo",
      weightKg: 1,
      price: 9000
    },
    balde: {
      id: "balde",
      name: "Balde 10 kg",
      weightKg: 10,
      price: 35000
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
   * Claves de peso: "0.5" | "1" | "10"
   * Valores orientativos; el dueño puede actualizarlos cuando tenga tarifas reales.
   */
  RATES: {
    caba: { "0.5": 4500, "1": 5500, "10": 12500 },
    gba: { "0.5": 5500, "1": 6500, "10": 14500 },
    interior: { "0.5": 7500, "1": 9000, "10": 22000 },
    patagonia: { "0.5": 11000, "1": 13000, "10": 32000 }
  }
};
