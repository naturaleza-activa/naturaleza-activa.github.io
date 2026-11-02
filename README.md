# Naturaleza Activa — sitio estático

Sitio de una sola página para la miel artesanal de Lobos. Abrí `index.html` en el navegador: no hace falta servidor.

**Live:** https://naturaleza-activa.github.io/

## Cotizador de envío (CP)

Flujo: elegir presentación → ingresar CP destino → ver zona, envío más económico y **total = producto + envío**.

### Configuración (un solo archivo)

En `js/shipping-config.js`:

| Constante | Qué hacer |
|---|---|
| `ORIGIN_CP` | Ya: `"7240"` (Lobos / B7240) |
| `RATES` | Ajustá tarifas ARS por zona × peso si cambian |
| `MP_CHECKOUT_READY` / `MP_WORKER_URL` | Worker de Checkout Pro (`…workers.dev`); ver `docs/worker/` |
| `MP_PRODUCT_LINKS` | Legacy (ya no se usan con Checkout Pro) |

### Zonas (CP de 4 dígitos)

| Zona | Rango usado |
|---|---|
| CABA | 1000–1499 |
| GBA / AMBA | 1500–1999 |
| Interior | resto (salvo Patagonia) |
| Patagonia / Sur | 8300–9420 |

### Tarifas estimadas actuales (ARS)

Opción más económica práctica orientativa (paquete según presentación). Actualizá en `RATES` cuando tengas valores reales del correo/courier.

| Zona | ½ kg | 1 kg | 10 kg |
|---|---:|---:|---:|
| CABA | 4.500 | 5.500 | 12.500 |
| GBA / AMBA | 5.500 | 6.500 | 14.500 |
| Interior | 7.500 | 9.000 | 22.000 |
| Patagonia / Sur | 11.000 | 13.000 | 32.000 |

Supuestos: tarifas de referencia para envío frágil/líquido; no es cotización en vivo de Andreani/Correo. El dueño debe alinearlas con su operador real.

### Pago (Mercado Pago Checkout Pro)

Tras cotizar, el comprador completa **datos de envío** (nombre, DNI, email, teléfono, dirección, ciudad, provincia, CP). El formulario hace POST al Cloudflare Worker (`MP_WORKER_URL`), que crea una preference Checkout Pro (miel + envío) con `payer.email`, `payer.identification` (DNI), `shipments.receiver_address` y `metadata`/`description` (útil para etiquetas Correo Argentino), y redirige a `init_point`.

Código del Worker: `docs/worker/` (secret `MP_ACCESS_TOKEN` — nunca en el sitio estático).

1. `npx wrangler login` + `npx wrangler deploy` en `docs/worker/`
2. `npx wrangler secret put MP_ACCESS_TOKEN`
3. Pegá la URL del Worker en `js/shipping-config.js` → `MP_WORKER_URL`
4. Republicá Pages

Sin `MP_WORKER_URL`, el sitio muestra el aviso por mail (`contactonaturalezaactiva@gmail.com`).

No uses WhatsApp para pedidos (preferencia del proyecto).

## Qué debe proveer el dueño

1. Cuenta Cloudflare (gratis) para desplegar el Worker — si el agente no pudo autenticar
2. Fotos reales (reemplazar `assets/placeholders/`)
3. (Opcional) Tarifas reales → tabla `RATES`

CP de origen ya cargado: `7240` (Lobos / B7240).

Mail ya configurado: `contactonaturalezaactiva@gmail.com`

## Publicar (repo user-site)

Cuenta: `naturaleza-activa` → repo `naturaleza-activa.github.io` → https://naturaleza-activa.github.io/

```bash
cd docs/site   # o esta carpeta
gh auth switch --user naturaleza-activa
gh auth setup-git
git add -A
git commit -m "Actualización sitio"
git push origin main
```

Costo mensual: $0 (GitHub Pages).
