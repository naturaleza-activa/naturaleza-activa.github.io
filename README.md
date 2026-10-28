# Naturaleza Activa — sitio estático

Sitio de una sola página para la miel artesanal de Lobos. Abrí `index.html` en el navegador: no hace falta servidor.

## Qué reemplazar (dueño)

### 1. Links de Mercado Pago (3)

En `index.html`, buscá los botones `Comprar` y cambiá el `href`:

| Presentación | Placeholder actual | Pegá el link real |
|---|---|---|
| ½ kg | `href="#mp-medio-kilo"` | link MP del medio kilo |
| 1 kg | `href="#mp-kilo"` | link MP del kilo |
| Balde 10 kg | `href="#mp-balde"` | link MP del balde |

Los comentarios HTML encima de cada botón marcan exactamente dónde pegar.

### 2. Mail de contacto

Ya configurado: `contactonaturalezaactiva@gmail.com` (mailto + texto visible en `#contacto`).

### 3. Fotos

Archivos en `assets/placeholders/`:

| Archivo | Uso |
|---|---|
| `hero.svg` | Fondo del hero (campo / atardecer) |
| `colmenas.svg` | Sección historia |
| `producto-medio-kilo.svg` | Producto ½ kg |
| `producto-kilo.svg` | Producto 1 kg |
| `producto-balde.svg` | Producto balde |

Podés reemplazar cada SVG por un JPG/PNG con el mismo nombre (o actualizar las rutas `src` en `index.html`). Ideal: fotos propias, horizontales para hero/colmenas, cuadradas para productos.

## Publicar en GitHub Pages (mínimo)

Requiere `gh` autenticado (`gh auth login`).

```bash
# Desde esta carpeta docs/site/
gh repo create naturaleza-activa --public --source=. --remote=origin --push
gh api -X PUT "repos/$(gh api user -q .login)/naturaleza-activa/pages" \
  -f build_type=legacy \
  -f source='{"branch":"main","path":"/"}'
```

URL esperada: `https://<tu-usuario>.github.io/naturaleza-activa/`

Si el repo ya existe vacío:

```bash
git init
git add .
git commit -m "Sitio Naturaleza Activa"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/naturaleza-activa.git
git push -u origin main
# luego el comando gh api .../pages de arriba
```

Costo mensual: $0 (GitHub Pages gratis en repos públicos).
