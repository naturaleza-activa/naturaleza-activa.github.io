# Worker — Checkout Pro + etiqueta Correo Argentino

Cloudflare Worker gratis: crea preferences de Mercado Pago y, cuando el pago se aprueba, genera una **etiqueta imprimible** (HTML) y opcionalmente la manda por mail con Resend (free tier).

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | Healthcheck (`resend: true/false`) |
| `POST` | `/checkout` | Formulario sitio → preference + `init_point` (acepta `cart` JSON multi-ítem o `productId` legacy) |
| `POST`/`GET` | `/mp-webhook` | Webhook / IPN de Mercado Pago |
| `GET` | `/label?payment_id=ID` | Etiqueta imprimible (auto-print) |

La preference incluye `notification_url = {worker}/mp-webhook`.

## Secrets

```bash
npx wrangler secret put MP_ACCESS_TOKEN     # Owner Access Token PRODUCTION
npx wrangler secret put RESEND_API_KEY      # opcional — sin esto no hay email
```

Sin `RESEND_API_KEY`, el webhook igual genera la etiqueta; el dueño abre  
`https://…workers.dev/label?payment_id=…` (el webhook responde `labelUrl` en JSON).

## Resend ($0)

1. Crear cuenta gratis en [resend.com](https://resend.com)
2. API Key → secret `RESEND_API_KEY`
3. Mientras no verifiques dominio, usá `onboarding@resend.dev` como from (solo envía al mail de la cuenta Resend). Para mandar a `contactonaturalezaactiva@gmail.com` de forma estable: verificá un dominio o usá el mail del onboarding de Resend.
4. Vars ya seteadas: `LABEL_TO_EMAIL`, `RESEND_FROM`

## Deploy

```bash
cd docs/worker
npx wrangler login          # cuenta permanente (recomendado)
npx wrangler deploy
npx wrangler secret put MP_ACCESS_TOKEN
npx wrangler secret put RESEND_API_KEY   # cuando exista
```

Temporal (agente): `npx wrangler deploy --temporary --secrets-file …`  
El dueño debe **claim** la preview (URL ~60 min) o el Worker se borra.

En el sitio: `js/shipping-config.js` → `MP_WORKER_URL`.

## Costo

$0/mes (Workers free + Resend free tier).
