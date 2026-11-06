import { JAR_GOAL, PALETTE } from "./palette.js";

/**
 * Honey jar progress — Canvas-drawn; 20 filled cells = 100%.
 */
export function createJar(canvas) {
  const ctx = canvas.getContext("2d");
  let fill = 0; // 0..1
  let display = 0;

  function setFilledCount(n, snap) {
    fill = Math.max(0, Math.min(1, n / JAR_GOAL));
    // Snap instantly on reset so a full jar never lingers after reload
    if (snap || n <= 0) display = fill;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 120;
    const cssH = canvas.clientHeight || 160;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function update(dt) {
    const speed = 1.8;
    if (display < fill) display = Math.min(fill, display + dt * speed);
    else if (display > fill) display = Math.max(fill, display - dt * speed);
  }

  function draw() {
    const w = canvas.clientWidth || 120;
    const h = canvas.clientHeight || 160;
    ctx.clearRect(0, 0, w, h);

    const jarX = w * 0.18;
    const jarW = w * 0.64;
    const jarTop = h * 0.18;
    const jarH = h * 0.7;
    const neckH = h * 0.08;
    const radius = 10;

    // lid
    ctx.fillStyle = PALETTE.brown;
    roundRect(ctx, jarX + jarW * 0.15, jarTop - neckH - 6, jarW * 0.7, 10, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.dark;
    roundRect(ctx, jarX + jarW * 0.22, jarTop - neckH, jarW * 0.56, neckH + 2, 2);
    ctx.fill();

    // glass body
    ctx.beginPath();
    roundedJarPath(ctx, jarX, jarTop, jarW, jarH, radius);
    ctx.fillStyle = "rgba(255,247,213,0.55)";
    ctx.fill();
    ctx.strokeStyle = PALETTE.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // honey fill clip
    const level = display;
    if (level > 0.001) {
      ctx.save();
      roundedJarPath(ctx, jarX, jarTop, jarW, jarH, radius);
      ctx.clip();
      const fillTop = jarTop + jarH * (1 - level);
      const grad = ctx.createLinearGradient(0, fillTop, 0, jarTop + jarH);
      grad.addColorStop(0, PALETTE.mid);
      grad.addColorStop(0.55, PALETTE.amber);
      grad.addColorStop(1, PALETTE.deep);
      ctx.fillStyle = grad;
      ctx.fillRect(jarX - 2, fillTop, jarW + 4, jarTop + jarH - fillTop + 2);
      // surface highlight
      ctx.fillStyle = "rgba(255,247,213,0.35)";
      ctx.fillRect(jarX, fillTop, jarW, 4);
      ctx.restore();
      // redraw stroke
      ctx.beginPath();
      roundedJarPath(ctx, jarX, jarTop, jarW, jarH, radius);
      ctx.strokeStyle = PALETTE.dark;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // label band
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(jarX + 4, jarTop + jarH * 0.42, jarW - 8, jarH * 0.18);
    ctx.fillStyle = PALETTE.dark;
    ctx.font = "600 10px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MIEL", w / 2, jarTop + jarH * 0.53);
  }

  function getProgress() {
    return { fill, display, goal: JAR_GOAL };
  }

  return { setFilledCount, resize, update, draw, getProgress };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedJarPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y);
  ctx.lineTo(x + w * 0.8, y);
  ctx.lineTo(x + w, y + r * 1.2);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r * 1.2);
  ctx.closePath();
}
