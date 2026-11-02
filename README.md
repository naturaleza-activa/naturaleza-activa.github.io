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
| `MP_CHECKOUT_READY` / `MP_CHECKOUT_URL` | Cuando tengas Checkout Pro, activá el pago unificado |
| `MP_PRODUCT_LINKS` | Placeholders de links fijos por producto (legacy) |

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

### Pago (Mercado Pago)

Hoy el botón **Pagar** muestra el total (producto + envío) y deja `data-product`, `data-cp`, `data-zone`, `data-shipping`, `data-total` listos. Sin backend, el cobro unificado requiere **Checkout Pro** (preference con monto = total).

**Camino siguiente (dueño):**

1. Crear aplicación en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers).
2. Obtener Access Token (o preferencias/links dinámicos).
3. Opción A (recomendada): backend mínimo / Cloudflare Worker gratis que cree una preference con `transaction_amount = total` y devolver `init_point`.
4. Opción B: mientras tanto, recibir el pedido por mail (`contactonaturalezaactiva@gmail.com`) y mandar un link de pago por el total.
5. Cuando exista la URL de checkout, en `shipping-config.js` poné `MP_CHECKOUT_READY: true` y `MP_CHECKOUT_URL` (o cableá la preference dinámica en `main.js`).

No uses WhatsApp para pedidos (preferencia del proyecto).

## Qué debe proveer el dueño

1. **Mercado Pago:** Access Token + Checkout Pro (ideal) **o** links de pago actualizados por el total
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
