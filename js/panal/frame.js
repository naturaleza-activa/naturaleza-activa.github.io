import { PALETTE } from "./palette.js";

/**
 * Code-drawn Langstroth-style wooden frame around the comb surface.
 * Top bar (wider), side bars, bottom bar — wood/honey tones only.
 */
export function frameInsets(combW) {
  // Scale rails with comb width; keep readable on mobile.
  const s = Math.max(0.75, Math.min(1.35, combW / 950));
  return {
    top: Math.round(30 * s),
    side: Math.round(18 * s),
    bottom: Math.round(24 * s),
  };
}

export function drawLangstrothFrame(ctx, cssW, cssH, insets) {
  const { top, side, bottom } = insets;
  const innerX = side;
  const innerY = top;
  const innerW = cssW - side * 2;
  const innerH = cssH - top - bottom;

  // Stage wash (cream — never dark)
  ctx.fillStyle = PALETTE.creamLight;
  ctx.fillRect(0, 0, cssW, cssH);

  // Outer wood plate
  const plate = ctx.createLinearGradient(0, 0, cssW, cssH);
  plate.addColorStop(0, PALETTE.woodLight);
  plate.addColorStop(0.45, PALETTE.woodMid);
  plate.addColorStop(1, PALETTE.woodDeep);
  ctx.fillStyle = plate;
  roundRectPath(ctx, 2, 2, cssW - 4, cssH - 4, 6);
  ctx.fill();

  // Grain lines on outer plate
  ctx.save();
  roundRectPath(ctx, 2, 2, cssW - 4, cssH - 4, 6);
  ctx.clip();
  ctx.strokeStyle = "rgba(112,66,15,0.12)";
  ctx.lineWidth = 1;
  for (let y = 8; y < cssH; y += 5) {
    ctx.beginPath();
    ctx.moveTo(4, y + Math.sin(y * 0.2) * 1.2);
    ctx.lineTo(cssW - 4, y + Math.sin(y * 0.17 + 1) * 1.2);
    ctx.stroke();
  }
  ctx.restore();

  // Top rail (Langstroth top bar — thicker)
  drawRail(ctx, 4, 4, cssW - 8, top - 2, true);
  // Bottom rail
  drawRail(ctx, 4, cssH - bottom, cssW - 8, bottom - 4, false);
  // Side rails
  drawSideRail(ctx, 4, top - 2, side - 2, cssH - top - bottom + 4);
  drawSideRail(ctx, cssW - side, top - 2, side - 4, cssH - top - bottom + 4);

  // Wax / foundation surface behind cells
  const wax = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
  wax.addColorStop(0, PALETTE.wax);
  wax.addColorStop(0.55, PALETTE.cream);
  wax.addColorStop(1, PALETTE.waxDeep);
  ctx.fillStyle = wax;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // Soft warm light over wax
  const light = ctx.createRadialGradient(
    innerX + innerW * 0.35,
    innerY + innerH * 0.25,
    Math.min(innerW, innerH) * 0.08,
    innerX + innerW * 0.5,
    innerY + innerH * 0.5,
    Math.max(innerW, innerH) * 0.7
  );
  light.addColorStop(0, "rgba(255,247,213,0.45)");
  light.addColorStop(1, "rgba(223,160,44,0.08)");
  ctx.fillStyle = light;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // Inner rebate shadow (frame lip)
  ctx.strokeStyle = "rgba(112,66,15,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1);
  ctx.strokeStyle = "rgba(255,247,213,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(innerX + 2.5, innerY + 2.5, innerW - 5, innerH - 5);

  // Wire / foundation hint lines (very subtle, horizontal)
  ctx.strokeStyle = "rgba(169,104,25,0.12)";
  ctx.lineWidth = 0.8;
  const wires = 4;
  for (let i = 1; i <= wires; i++) {
    const y = innerY + (innerH * i) / (wires + 1);
    ctx.beginPath();
    ctx.moveTo(innerX + 6, y);
    ctx.lineTo(innerX + innerW - 6, y);
    ctx.stroke();
  }

  return { innerX, innerY, innerW, innerH };
}

function drawRail(ctx, x, y, w, h, isTop) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, isTop ? PALETTE.woodLight : PALETTE.woodMid);
  g.addColorStop(0.5, PALETTE.woodMid);
  g.addColorStop(1, PALETTE.woodDeep);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Bevel
  ctx.fillStyle = "rgba(255,247,213,0.28)";
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "rgba(112,66,15,0.22)";
  ctx.fillRect(x, y + h - 2, w, 2);

  // End ears on top bar
  if (isTop && h > 10) {
    ctx.fillStyle = PALETTE.woodGrain;
    ctx.fillRect(x + 6, y + h * 0.35, 10, h * 0.4);
    ctx.fillRect(x + w - 16, y + h * 0.35, 10, h * 0.4);
  }
}

function drawSideRail(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, PALETTE.woodDeep);
  g.addColorStop(0.4, PALETTE.woodMid);
  g.addColorStop(1, PALETTE.woodLight);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,247,213,0.2)";
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = "rgba(112,66,15,0.2)";
  ctx.fillRect(x, y, 2, h);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
