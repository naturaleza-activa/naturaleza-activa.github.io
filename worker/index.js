/**
 * Naturaleza Activa — Checkout Pro + etiqueta Correo Argentino
 *
 * POST /checkout — preference (miel + envío + dirección)
 * POST /mp-webhook — MP IPN / Webhooks (payment approved → label + email)
 * GET  /label?payment_id= — etiqueta imprimible (HTML)
 * GET  /health
 *
 * Secrets: MP_ACCESS_TOKEN (required), RESEND_API_KEY (optional)
 * Vars (opcionales; el código ya trae defaults): SITE_ORIGIN, BACK_URL, LABEL_TO_EMAIL, RESEND_FROM
 *
 * Archivo 100% standalone (sin imports): se puede pegar entero en Cloudflare → Edit code.
 */

/**
 * Campaña Black Friday (mantener sincronizado con js/shipping-config.js).
 * - Para extender al 29/11: cambiar `untilDate` a "2026-11-29".
 * - Para volver a precios regulares: cambiar `active` a `false`.
 */
const BLACK_FRIDAY = {
  active: true,
  untilDate: "2026-11-27",
  prices: {
    balde: 59000,
    "combo-familiar": 16500,
    "combo-5kg": 37900,
    "pack-3kg-envio": 28900,
  },
};

const REGULAR_PRODUCTS = {
  "medio-kilo": {
    id: "medio-kilo",
    title: "Miel Naturaleza Activa — ½ kilo",
    price: 5000,
    weightKg: 0.5,
  },
  kilo: {
    id: "kilo",
    title: "Miel Naturaleza Activa — 1 kilo",
    price: 9500,
    weightKg: 1,
  },
  balde: {
    id: "balde",
    title: "Miel Naturaleza Activa — Balde 10 kg",
    price: 65000,
    weightKg: 10,
  },
  "combo-familiar": {
    id: "combo-familiar",
    title: "Combo familiar — 2 kilos",
    price: 18000,
    weightKg: 2,
  },
  "combo-5kg": {
    id: "combo-5kg",
    title: "Combo 5 kilos",
    price: 42000,
    weightKg: 5,
  },
  "pack-3kg-envio": {
    id: "pack-3kg-envio",
    title: "Pack 3 kilos con envío gratis",
    price: 31900,
    weightKg: 3,
    freeShippingUpTo: 6500,
  },
};

const PRODUCTS = Object.fromEntries(
  Object.entries(REGULAR_PRODUCTS).map(([id, product]) => {
    const promoPrice = BLACK_FRIDAY.active ? BLACK_FRIDAY.prices[id] : null;
    return [
      id,
      typeof promoPrice === "number"
        ? { ...product, regularPrice: product.price, price: promoPrice }
        : { ...product },
    ];
  })
);

const FREE_SHIP_PACK_ID = "pack-3kg-envio";

const RATES = {
  caba: { "0.5": 4500, "1": 5500, "2": 6500, "3": 7500, "5": 9000, "10": 12500 },
  gba: { "0.5": 5500, "1": 6500, "2": 7500, "3": 8500, "5": 10500, "10": 14500 },
  interior: { "0.5": 7500, "1": 9000, "2": 11000, "3": 13000, "5": 16000, "10": 22000 },
  patagonia: { "0.5": 11000, "1": 13000, "2": 16000, "3": 19000, "5": 23000, "10": 32000 },
};

const REMITENTE = {
  name: "Naturaleza Activa",
  line: "Miel artesanal",
  city: "Lobos",
  province: "Buenos Aires",
  cp: "7240",
  country: "Argentina",
  email: "contactonaturalezaactiva@gmail.com",
};

function zoneFromCp(cp) {
  const n = parseInt(cp, 10);
  if (!n || String(cp).length !== 4) return null;
  if (n >= 1000 && n <= 1499) return "caba";
  if (n >= 1500 && n <= 1999) return "gba";
  if (n >= 8300 && n <= 9420) return "patagonia";
  if (n >= 1000 && n <= 9999) return "interior";
  return null;
}

/** Tarifa por peso total del carrito (misma lógica que el sitio). */
function shippingForWeight(zoneId, weightKg) {
  const rates = RATES[zoneId];
  if (!rates || !(weightKg > 0)) return null;
  if (weightKg <= 0.5) return rates["0.5"];
  if (weightKg <= 1) return rates["1"];
  if (weightKg <= 2) return rates["2"];
  if (weightKg <= 3) return rates["3"];
  if (weightKg <= 5) return rates["5"];
  if (weightKg <= 10) return rates["10"];
  return rates["10"] * Math.ceil(weightKg / 10);
}

/**
 * Regla: bonificación Pack 3 kg solo si el carrito tiene únicamente ese pack.
 * Carrito mixto → envío por peso total sin bonificación.
 */
function expectedShippingForCart(lines, cp) {
  const zone = zoneFromCp(cp);
  if (!zone || !lines.length) return null;
  let weightKg = 0;
  let onlyFreePack = true;
  let freePackQty = 0;
  for (const line of lines) {
    weightKg += line.product.weightKg * line.qty;
    if (line.product.id !== FREE_SHIP_PACK_ID) onlyFreePack = false;
    else freePackQty += line.qty;
  }
  const raw = shippingForWeight(zone, weightKg);
  if (typeof raw !== "number") return null;
  let bonus = 0;
  if (onlyFreePack) {
    const cap = PRODUCTS[FREE_SHIP_PACK_ID]?.freeShippingUpTo || 0;
    bonus = Math.min(cap * freePackQty, raw);
  }
  return {
    shipping: Math.max(0, raw - bonus),
    rawShipping: raw,
    shippingBonus: bonus,
    weightKg,
    zone,
  };
}

/** Compat: un solo productId (qty 1). */
function expectedShipping(productId, cp) {
  const product = PRODUCTS[productId];
  if (!product) return null;
  const result = expectedShippingForCart([{ product, qty: 1 }], cp);
  return result ? result.shipping : null;
}

function parseCartLines(body) {
  const lines = [];
  let rawCart = body.cart;
  if (typeof rawCart === "string" && rawCart.trim()) {
    try {
      rawCart = JSON.parse(rawCart);
    } catch {
      return { error: "Carrito inválido." };
    }
  }
  if (Array.isArray(rawCart) && rawCart.length) {
    const merged = new Map();
    for (const item of rawCart) {
      const id = String(item?.id || item?.productId || "").trim();
      const qty = Math.floor(Number(item?.qty ?? item?.quantity ?? 0));
      if (!PRODUCTS[id]) return { error: "Producto inválido en el carrito." };
      if (!(qty > 0) || qty > 99) return { error: "Cantidad inválida." };
      merged.set(id, (merged.get(id) || 0) + qty);
    }
    for (const [id, qty] of merged) {
      lines.push({ product: PRODUCTS[id], qty });
    }
  } else {
    const productId = String(body.productId || "").trim();
    if (productId && productId !== "cart" && PRODUCTS[productId]) {
      lines.push({ product: PRODUCTS[productId], qty: 1 });
    }
  }
  if (!lines.length) return { error: "Carrito vacío o producto inválido." };
  return { lines };
}

function corsHeaders(origin, allowedOrigin) {
  const allow = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function wantsJson(request) {
  const accept = request.headers.get("Accept") || "";
  const xhr = request.headers.get("X-Requested-With");
  const ctype = request.headers.get("Content-Type") || "";
  if (xhr === "XMLHttpRequest") return true;
  if (ctype.includes("application/json")) return true;
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return false;
}

function errorResponse(request, headers, message, status, backUrl) {
  if (wantsJson(request)) {
    return json({ error: message }, status, headers);
  }
  const dest = new URL(backUrl);
  dest.searchParams.set("checkout_error", message);
  dest.hash = "compra";
  return Response.redirect(dest.toString(), 302);
}

function pick(obj, key) {
  const v = obj?.[key];
  if (v == null) return "";
  return String(v).trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseStreet(street) {
  const raw = String(street || "").trim();
  const m = raw.match(/^(.*?)[,\s]+(\d+[A-Za-z\-/]*)$/);
  if (m) {
    return { street_name: m[1].trim(), street_number: m[2].trim() };
  }
  return { street_name: raw || "S/N", street_number: "0" };
}

function splitName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { name: "Cliente", surname: "NA" };
  if (parts.length === 1) return { name: parts[0], surname: "—" };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

function parsePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 10 && digits.startsWith("54")) {
    const local = digits.slice(2);
    return { area_code: local.slice(0, 2) || "11", number: local.slice(2) || local };
  }
  if (digits.length >= 10) {
    return { area_code: digits.slice(0, 2), number: digits.slice(2) };
  }
  if (digits.length >= 8) {
    return { area_code: "11", number: digits };
  }
  return { area_code: "11", number: digits || "0" };
}

async function parseInput(request) {
  const url = new URL(request.url);
  const fromParams = (src) => ({
    productId: src.get("productId") || src.get("product") || "",
    cart: src.get("cart") || "",
    cp: src.get("cp") || "",
    shipping: src.get("shipping"),
    total: src.get("total"),
    zone: src.get("zone") || "",
    name: src.get("name") || "",
    dni: src.get("dni") || "",
    email: src.get("email") || "",
    phone: src.get("phone") || "",
    street: src.get("street") || "",
    floor: src.get("floor") || "",
    city: src.get("city") || "",
    province: src.get("province") || "",
  });

  if (request.method === "GET") {
    return fromParams(url.searchParams);
  }

  const ctype = request.headers.get("Content-Type") || "";
  if (ctype.includes("application/json")) {
    const body = await request.json();
    return {
      productId: pick(body, "productId") || pick(body, "product"),
      cart: body.cart ?? pick(body, "cart"),
      cp: pick(body, "cp"),
      shipping: body.shipping,
      total: body.total,
      zone: pick(body, "zone"),
      name: pick(body, "name"),
      dni: pick(body, "dni"),
      email: pick(body, "email"),
      phone: pick(body, "phone"),
      street: pick(body, "street"),
      floor: pick(body, "floor"),
      city: pick(body, "city"),
      province: pick(body, "province"),
    };
  }
  if (
    ctype.includes("application/x-www-form-urlencoded") ||
    ctype.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return fromParams({
      get: (k) => {
        const v = form.get(k);
        return v == null ? "" : String(v);
      },
    });
  }

  try {
    const body = await request.json();
    return {
      productId: pick(body, "productId"),
      cart: body.cart ?? pick(body, "cart"),
      cp: pick(body, "cp"),
      shipping: body.shipping,
      total: body.total,
      zone: pick(body, "zone"),
      name: pick(body, "name"),
      dni: pick(body, "dni"),
      email: pick(body, "email"),
      phone: pick(body, "phone"),
      street: pick(body, "street"),
      floor: pick(body, "floor"),
      city: pick(body, "city"),
      province: pick(body, "province"),
    };
  } catch {
    return fromParams(url.searchParams);
  }
}

function validateAddress(body) {
  const name = pick(body, "name");
  const dni = String(body.dni || "").replace(/\D/g, "").slice(0, 8);
  const email = pick(body, "email").toLowerCase();
  const phone = pick(body, "phone");
  const street = pick(body, "street");
  const city = pick(body, "city");
  const province = pick(body, "province");
  const floor = pick(body, "floor");
  const cp = String(body.cp || "").replace(/\D/g, "").slice(0, 4);

  if (name.length < 3) return { error: "Ingresá nombre y apellido." };
  if (!/^\d{7,8}$/.test(dni)) return { error: "Ingresá un DNI válido (7 u 8 dígitos)." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ingresá un email válido." };
  if (phone.replace(/\D/g, "").length < 8) return { error: "Ingresá un teléfono válido." };
  if (street.length < 3) return { error: "Ingresá calle y número." };
  if (city.length < 2) return { error: "Ingresá la ciudad." };
  if (!province) return { error: "Elegí la provincia." };
  if (!/^\d{4}$/.test(cp)) return { error: "CP inválido." };

  return { name, dni, email, phone, street, floor, city, province, cp };
}

function addressLine(addr) {
  const floorBit = addr.floor ? `, ${addr.floor}` : "";
  return `${addr.street}${floorBit}, ${addr.city}, ${addr.province}, CP ${addr.cp}`;
}

function publicBase(request, env) {
  if (env.WORKER_PUBLIC_URL) return String(env.WORKER_PUBLIC_URL).replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function backWithStatus(backUrl, status) {
  try {
    const u = new URL(backUrl);
    u.searchParams.set("payment", status);
    return u.toString();
  } catch {
    return backUrl;
  }
}

async function createPreference(env, lines, shipping, weightKg, addr, workerBase) {
  const backUrl = env.BACK_URL || "https://naturaleza-activa.github.io/";
  const { street_name, street_number } = parseStreet(addr.street);
  const names = splitName(addr.name);
  const phone = parsePhone(addr.phone);
  const shipLine = addressLine(addr);
  const cartSummary = lines
    .map((l) => `${l.qty}× ${l.product.title}`)
    .join(" · ");
  const desc =
    `Pedido: ${cartSummary}. Envío Correo Argentino: ${addr.name} · DNI ${addr.dni} · ${shipLine} · Tel ${addr.phone} · ${addr.email}`;
  const productsSubtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const primaryId =
    lines.length === 1 ? lines[0].product.id : "cart";
  const items = lines.map((l) => ({
    id: l.product.id,
    title: l.product.title,
    description: desc.slice(0, 250),
    quantity: l.qty,
    currency_id: "ARS",
    unit_price: l.product.price,
    category_id: "others",
  }));

  const preference = {
    items,
    payer: {
      name: names.name,
      surname: names.surname,
      email: addr.email,
      identification: { type: "DNI", number: addr.dni },
      phone: { area_code: phone.area_code, number: phone.number },
      address: { zip_code: addr.cp, street_name, street_number },
    },
    shipments: {
      mode: "not_specified",
      cost: shipping,
      receiver_address: {
        zip_code: addr.cp,
        street_name,
        street_number,
        city_name: addr.city,
        state_name: addr.province,
        country_name: "Argentina",
        apartment: addr.floor || undefined,
        floor: addr.floor || undefined,
      },
    },
    external_reference: `na:${primaryId}:cp${addr.cp}:${Date.now()}`,
    metadata: {
      product_id: primaryId,
      product_title: cartSummary.slice(0, 200),
      product_weight_kg: String(weightKg),
      cart_json: JSON.stringify(
        lines.map((l) => ({ id: l.product.id, qty: l.qty }))
      ).slice(0, 250),
      destination_cp: addr.cp,
      shipping_ars: shipping,
      buyer_name: addr.name,
      buyer_dni: addr.dni,
      buyer_email: addr.email,
      buyer_phone: addr.phone,
      ship_street: addr.street,
      ship_floor: addr.floor || "",
      ship_city: addr.city,
      ship_province: addr.province,
      ship_line: shipLine,
      correo_label: desc.slice(0, 250),
    },
    additional_info: desc.slice(0, 600),
    notification_url: `${workerBase}/mp-webhook`,
    back_urls: {
      success: backWithStatus(backUrl, "success"),
      failure: backWithStatus(backUrl, "failure"),
      pending: backWithStatus(backUrl, "pending"),
    },
    auto_return: "approved",
    statement_descriptor: "NATURALEZA ACTIVA",
  };

  if (!preference.shipments.receiver_address.apartment) {
    delete preference.shipments.receiver_address.apartment;
  }
  if (!preference.shipments.receiver_address.floor) {
    delete preference.shipments.receiver_address.floor;
  }

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  const mpData = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok || !mpData.init_point) {
    const msg =
      mpData.message || mpData.error || `Mercado Pago error (${mpRes.status})`;
    return { error: msg };
  }
  return {
    init_point: mpData.init_point,
    preference_id: mpData.id,
    total: productsSubtotal + shipping,
    shipping,
    productId: primaryId,
    cart: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
    cp: addr.cp,
  };
}

function buildLabelData(payment, preference) {
  const meta = {
    ...(preference?.metadata || {}),
    ...(payment?.metadata || {}),
  };
  const payer = payment?.payer || {};
  const productId = meta.product_id || "";
  const product = PRODUCTS[productId] || null;
  const weightKg =
    meta.product_weight_kg ||
    (product ? String(product.weightKg) : "") ||
    "";
  const title =
    meta.product_title ||
    product?.title ||
    payment?.description ||
    "Miel Naturaleza Activa";

  const name =
    meta.buyer_name ||
    [payer.first_name || payer.name, payer.last_name || payer.surname]
      .filter(Boolean)
      .join(" ") ||
    "Destinatario";
  const dni =
    meta.buyer_dni ||
    payer.identification?.number ||
    "";
  const email = meta.buyer_email || payer.email || "";
  const phone = meta.buyer_phone || payer.phone?.number || "";
  const street = meta.ship_street || "";
  const floor = meta.ship_floor || "";
  const city = meta.ship_city || "";
  const province = meta.ship_province || "";
  const cp = meta.destination_cp || payer.address?.zip_code || "";

  return {
    paymentId: String(payment?.id || ""),
    status: payment?.status || "",
    amount: payment?.transaction_amount,
    currency: payment?.currency_id || "ARS",
    productTitle: title,
    weightKg,
    productId,
    name,
    dni,
    email,
    phone,
    street,
    floor,
    city,
    province,
    cp,
    shipLine:
      meta.ship_line ||
      [street, floor, city, province, cp ? `CP ${cp}` : ""]
        .filter(Boolean)
        .join(", "),
  };
}

function renderLabelHtml(data, opts = {}) {
  const autoPrint = opts.autoPrint !== false;
  const floorBit = data.floor ? `<div>Piso/depto: <strong>${escapeHtml(data.floor)}</strong></div>` : "";
  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Etiqueta envío #${escapeHtml(data.paymentId)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Helvetica, Arial, sans-serif;
      background: #f2f2f2;
      color: #111;
    }
    .toolbar {
      max-width: 10cm;
      margin: 1rem auto 0;
      display: flex;
      gap: .5rem;
      justify-content: center;
    }
    .toolbar button {
      font: inherit;
      padding: .55rem 1rem;
      border: 1px solid #222;
      background: #111;
      color: #fff;
      cursor: pointer;
    }
    .sheet {
      width: 10cm;
      min-height: 15cm;
      margin: 1rem auto 2rem;
      padding: .45cm;
      background: #fff;
      border: 2px solid #111;
    }
    .brand {
      text-align: center;
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase;
      margin-bottom: .35cm;
    }
    .box {
      border: 2px solid #111;
      padding: .35cm .4cm;
      margin-bottom: .35cm;
    }
    .box h2 {
      margin: 0 0 .25cm;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      border-bottom: 1px solid #111;
      padding-bottom: .15cm;
    }
    .box .name { font-size: 18px; font-weight: 700; margin: .15cm 0; }
    .box div { font-size: 13px; line-height: 1.35; margin: .08cm 0; }
    .meta { font-size: 11px; }
    .cp {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: .04em;
      margin-top: .2cm;
    }
    .foot {
      font-size: 10px;
      text-align: center;
      margin-top: .2cm;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet {
        margin: 0;
        border-width: 1.5pt;
        page-break-inside: avoid;
      }
      @page { margin: 8mm; size: auto; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Imprimir etiqueta</button>
  </div>
  <div class="sheet">
    <div class="brand">Correo Argentino · etiqueta de envío</div>

    <div class="box">
      <h2>Destinatario</h2>
      <div class="name">${escapeHtml(data.name)}</div>
      <div>DNI: <strong>${escapeHtml(data.dni || "—")}</strong></div>
      <div>Tel: <strong>${escapeHtml(data.phone || "—")}</strong></div>
      <div>Email: <strong>${escapeHtml(data.email || "—")}</strong></div>
      <div>${escapeHtml(data.street || data.shipLine || "—")}</div>
      ${floorBit}
      <div>${escapeHtml(data.city || "")}${data.province ? ", " + escapeHtml(data.province) : ""}</div>
      <div class="cp">CP ${escapeHtml(data.cp || "————")}</div>
    </div>

    <div class="box">
      <h2>Remitente</h2>
      <div class="name">${escapeHtml(REMITENTE.name)}</div>
      <div>${escapeHtml(REMITENTE.line)}</div>
      <div>${escapeHtml(REMITENTE.city)}, ${escapeHtml(REMITENTE.province)}</div>
      <div class="cp">CP ${escapeHtml(REMITENTE.cp)}</div>
      <div class="meta">${escapeHtml(REMITENTE.email)}</div>
    </div>

    <div class="box meta">
      <h2>Contenido</h2>
      <div><strong>${escapeHtml(data.productTitle)}</strong></div>
      <div>Peso: <strong>${escapeHtml(data.weightKg || "—")} kg</strong></div>
      <div>Pago MP: <strong>#${escapeHtml(data.paymentId)}</strong></div>
      <div>Estado: <strong>${escapeHtml(data.status || "—")}</strong>
        ${data.amount != null ? ` · $${escapeHtml(data.amount)} ${escapeHtml(data.currency)}` : ""}
      </div>
    </div>

    <div class="foot">Naturaleza Activa · Lobos (B7240) · pegar en el paquete</div>
  </div>
  ${autoPrint ? "<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400)});</script>" : ""}
</body>
</html>`;
}

async function mpGet(env, path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || `MP GET ${path} (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function loadLabelContext(env, paymentId) {
  const payment = await mpGet(env, `/v1/payments/${paymentId}`);
  let preference = null;
  const prefId =
    payment.preference_id ||
    payment.additional_info?.preference_id ||
    payment.metadata?.preference_id ||
    null;
  // Checkout Pro often links via merchant_order
  if (!Object.keys(payment.metadata || {}).length || !payment.metadata?.buyer_name) {
    try {
      if (payment.order?.id) {
        const order = await mpGet(env, `/merchant_orders/${payment.order.id}`);
        if (order.preference_id) {
          preference = await mpGet(env, `/checkout/preferences/${order.preference_id}`);
        }
      } else if (prefId) {
        preference = await mpGet(env, `/checkout/preferences/${prefId}`);
      }
    } catch {
      /* metadata on payment may still be enough */
    }
  }
  return { payment, preference, label: buildLabelData(payment, preference) };
}

async function alreadyProcessed(paymentId) {
  try {
    const cache = caches.default;
    const key = new Request(`https://na-label-idempotency.invalid/${paymentId}`);
    const hit = await cache.match(key);
    return !!hit;
  } catch {
    return false;
  }
}

async function markProcessed(paymentId) {
  try {
    const cache = caches.default;
    const key = new Request(`https://na-label-idempotency.invalid/${paymentId}`);
    await cache.put(
      key,
      new Response("1", { headers: { "Cache-Control": "max-age=604800" } })
    );
  } catch {
    /* ignore */
  }
}

async function sendLabelEmail(env, label, labelUrl) {
  if (!env.RESEND_API_KEY) {
    return { sent: false, reason: "missing_resend_api_key" };
  }
  const to = env.LABEL_TO_EMAIL || REMITENTE.email;
  const from =
    env.RESEND_FROM || "Naturaleza Activa <onboarding@resend.dev>";
  const subject = `Etiqueta de envío · pago #${label.paymentId} · ${label.name}`;
  const html = `
    <p>Se aprobó un pago en Mercado Pago. Imprimí y pegá esta etiqueta en el paquete (Correo Argentino).</p>
    <p><a href="${escapeHtml(labelUrl)}"><strong>Abrir / imprimir etiqueta</strong></a></p>
    <hr>
    <p><strong>Destinatario:</strong> ${escapeHtml(label.name)} · DNI ${escapeHtml(label.dni)}<br>
    ${escapeHtml(label.shipLine)}<br>
    Tel ${escapeHtml(label.phone)} · ${escapeHtml(label.email)}</p>
    <p><strong>Producto:</strong> ${escapeHtml(label.productTitle)} (${escapeHtml(label.weightKg)} kg)<br>
    <strong>Pago:</strong> #${escapeHtml(label.paymentId)}</p>
    <hr>
    <p style="font-size:12px;color:#555">Si el link no abre, respondé este mail. Remitente: Naturaleza Activa · Lobos CP 7240.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      sent: false,
      reason: data.message || data.error || `resend_${res.status}`,
    };
  }
  return { sent: true, id: data.id || null };
}

async function handleApprovedPayment(env, workerBase, paymentId) {
  if (await alreadyProcessed(paymentId)) {
    return { ok: true, duplicate: true, paymentId };
  }
  const ctx = await loadLabelContext(env, paymentId);
  if (ctx.payment.status !== "approved") {
    return { ok: true, skipped: true, status: ctx.payment.status, paymentId };
  }
  const labelUrl = `${workerBase}/label?payment_id=${encodeURIComponent(paymentId)}`;
  const email = await sendLabelEmail(env, ctx.label, labelUrl);
  await markProcessed(paymentId);
  return {
    ok: true,
    paymentId,
    labelUrl,
    email,
    destinatario: ctx.label.name,
  };
}

async function handleWebhook(request, env, workerBase) {
  const url = new URL(request.url);
  let paymentId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";
  let topic =
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    "";

  if (request.method === "POST") {
    const ctype = request.headers.get("Content-Type") || "";
    try {
      if (ctype.includes("application/json")) {
        const body = await request.json();
        paymentId =
          paymentId ||
          body?.data?.id ||
          body?.id ||
          body?.resource?.split?.("/")?.pop?.() ||
          "";
        topic = topic || body?.type || body?.action || body?.topic || "";
      } else {
        const text = await request.text();
        const params = new URLSearchParams(text);
        paymentId = paymentId || params.get("data.id") || params.get("id") || "";
        topic = topic || params.get("type") || params.get("topic") || "";
        // resource=https://api.mercadopago.com/v1/payments/123
        const resource = params.get("resource") || "";
        if (!paymentId && /\/payments\/(\d+)/.test(resource)) {
          paymentId = resource.match(/\/payments\/(\d+)/)[1];
          topic = topic || "payment";
        }
      }
    } catch {
      /* ignore body parse */
    }
  }

  paymentId = String(paymentId || "").trim();
  topic = String(topic || "").toLowerCase();

  // Always 200 quickly for MP retries on non-payment topics
  if (!paymentId) {
    return json({ ok: true, ignored: true, reason: "no_payment_id" }, 200, {});
  }
  if (topic && !topic.includes("payment")) {
    return json({ ok: true, ignored: true, topic }, 200, {});
  }

  try {
    const result = await handleApprovedPayment(env, workerBase, paymentId);
    return json(result, 200, {});
  } catch (err) {
    return json(
      { ok: false, error: err.message || String(err), paymentId },
      200,
      {}
    );
  }
}

/** True when Mercado Pago Owner Access Token is bound on this Worker version. */
function hasMpAccessToken(env) {
  const v = env && env.MP_ACCESS_TOKEN;
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}

async function handleCheckout(request, env, headers, backUrl, workerBase) {
  if (!hasMpAccessToken(env)) {
    return errorResponse(request, headers, "Checkout no configurado (falta token).", 503, backUrl);
  }

  let body;
  try {
    body = await parseInput(request);
  } catch {
    return errorResponse(request, headers, "Datos inválidos.", 400, backUrl);
  }

  const parsedCart = parseCartLines(body);
  if (parsedCart.error) {
    return errorResponse(request, headers, parsedCart.error, 400, backUrl);
  }
  const lines = parsedCart.lines;

  const addrResult = validateAddress(body);
  if (addrResult.error) {
    return errorResponse(request, headers, addrResult.error, 400, backUrl);
  }
  const addr = addrResult;

  const shipQuote = expectedShippingForCart(lines, addr.cp);
  if (!shipQuote) {
    return errorResponse(request, headers, "No hay tarifa para ese CP.", 400, backUrl);
  }
  const shipping = shipQuote.shipping;
  const productsSubtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const expectedTotal = productsSubtotal + shipping;

  const clientShipping = Number(body.shipping);
  const clientTotal = Number(body.total);
  if (Number.isFinite(clientShipping) && Math.round(clientShipping) !== shipping) {
    return errorResponse(request, headers, "Monto de envío no coincide. Recalculá.", 400, backUrl);
  }
  if (Number.isFinite(clientTotal) && Math.round(clientTotal) !== expectedTotal) {
    return errorResponse(request, headers, "Total no coincide. Recalculá.", 400, backUrl);
  }

  const result = await createPreference(
    env,
    lines,
    shipping,
    shipQuote.weightKg,
    addr,
    workerBase
  );
  if (result.error) {
    return errorResponse(request, headers, result.error, 502, backUrl);
  }

  if (wantsJson(request)) {
    return json(result, 200, headers);
  }
  return Response.redirect(result.init_point, 302);
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.SITE_ORIGIN || "https://naturaleza-activa.github.io";
    const backUrl = env.BACK_URL || "https://naturaleza-activa.github.io/";
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, allowedOrigin);
    const workerBase = publicBase(request, env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return json(
        {
          ok: true,
          service: "naturaleza-activa-checkout",
          features: {
            checkout: true,
            webhook: true,
            label: true,
            multiItemCart: true,
            resend: Boolean(env.RESEND_API_KEY),
            mpToken: hasMpAccessToken(env),
          },
          mpToken: hasMpAccessToken(env),
          resend: Boolean(env.RESEND_API_KEY),
          multiItemCart: true,
          promo: BLACK_FRIDAY.active
            ? { name: "black-friday", untilDate: BLACK_FRIDAY.untilDate }
            : null,
          version: "2026-11-24-bf",
          workersDevHint: new URL(request.url).host,
        },
        200,
        headers
      );
    }

    if (path === "/mp-webhook" && (request.method === "POST" || request.method === "GET")) {
      return handleWebhook(request, env, workerBase);
    }

    if (path === "/label" && request.method === "GET") {
      const paymentId = (url.searchParams.get("payment_id") || url.searchParams.get("id") || "").trim();
      if (!paymentId) {
        return json({ error: "Falta payment_id" }, 400, headers);
      }
      if (!hasMpAccessToken(env)) {
        return json({ error: "Falta MP_ACCESS_TOKEN" }, 503, headers);
      }
      try {
        const ctx = await loadLabelContext(env, paymentId);
        const html = renderLabelHtml(ctx.label, {
          autoPrint: url.searchParams.get("autoprint") !== "0",
        });
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        return json({ error: err.message || String(err) }, 502, headers);
      }
    }

    const isCheckout = path === "/checkout" || path === "/" || path === "/pay";
    if (isCheckout && (request.method === "POST" || request.method === "GET")) {
      if (
        request.method === "GET" &&
        path === "/" &&
        !url.searchParams.get("productId")
      ) {
        return json({ ok: true, service: "naturaleza-activa-checkout" }, 200, headers);
      }
      return handleCheckout(request, env, headers, backUrl, workerBase);
    }

    return json({ error: "Not found" }, 404, headers);
  },
};
