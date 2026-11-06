import { PALETTE } from "./palette.js";
import { axialToPixel, neighborsOf } from "./hex.js";

/**
 * 2–3 code-drawn bees that walk between hex centers.
 */
export function createBees(count, cells, index, size) {
  let hexSize = size;
  const n = Math.max(2, Math.min(3, count | 0));
  const bees = [];

  for (let i = 0; i < n; i++) {
    const start = cells[(Math.random() * cells.length) | 0];
    const p = axialToPixel(start.q, start.r, hexSize);
    bees.push({
      q: start.q,
      r: start.r,
      x: p.x,
      y: p.y,
      sx: p.x,
      sy: p.y,
      tx: p.x,
      ty: p.y,
      t: 1,
      speed: 0.4 + Math.random() * 0.35,
      bob: Math.random() * Math.PI * 2,
      wing: Math.random() * Math.PI * 2,
      pause: Math.random() * 0.8,
    });
  }

  function pickNext(bee) {
    const opts = neighborsOf(bee.q, bee.r, index);
    if (!opts.length) return;
    const next = opts[(Math.random() * opts.length) | 0];
    bee.q = next.q;
    bee.r = next.r;
    bee.sx = bee.x;
    bee.sy = bee.y;
    const p = axialToPixel(next.q, next.r, hexSize);
    bee.tx = p.x;
    bee.ty = p.y;
    bee.t = 0;
    bee.pause = 0.12 + Math.random() * 0.5;
  }

  function update(dt, reducedMotion) {
    if (reducedMotion) return;
    for (let i = 0; i < bees.length; i++) {
      const bee = bees[i];
      bee.bob += dt * 3.2;
      bee.wing += dt * 28;
      if (bee.pause > 0) {
        bee.pause -= dt;
        if (bee.pause <= 0 && bee.t >= 1) pickNext(bee);
        continue;
      }
      if (bee.t >= 1) {
        pickNext(bee);
        continue;
      }
      bee.t = Math.min(1, bee.t + dt * bee.speed);
      const e = easeInOut(bee.t);
      bee.x = bee.sx + (bee.tx - bee.sx) * e;
      bee.y = bee.sy + (bee.ty - bee.sy) * e;
      if (bee.t >= 1) {
        bee.x = bee.tx;
        bee.y = bee.ty;
        bee.pause = 0.2 + Math.random() * 0.6;
      }
    }
  }

  function draw(ctx, originX, originY) {
    const ox = originX || 0;
    const oy = originY || 0;
    for (let i = 0; i < bees.length; i++) {
      drawBee(ctx, bees[i], ox, oy);
    }
  }

  function resize(newSize) {
    hexSize = newSize;
    const scale = Math.max(0.9, Math.min(1.4, hexSize / 8));
    for (let i = 0; i < bees.length; i++) {
      const p = axialToPixel(bees[i].q, bees[i].r, hexSize);
      bees[i].x = bees[i].tx = bees[i].sx = p.x;
      bees[i].y = bees[i].ty = bees[i].sy = p.y;
      bees[i].t = 1;
      bees[i]._scale = scale;
    }
  }

  return { bees, update, draw, resize };
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function drawBee(ctx, bee, ox, oy) {
  const x = ox + bee.x;
  const y = oy + bee.y + Math.sin(bee.bob) * 1.8;
  const flap = 0.35 + Math.sin(bee.wing) * 0.35;
  const s = Math.max(0.85, Math.min(1.35, (bee._scale || 1)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = PALETTE.creamLight;
  ctx.beginPath();
  ctx.ellipse(-3.2, -4.2, 5.4, 2.4, -flap, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3.2, -4.2, 5.4, 2.4, flap, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = PALETTE.mid;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.dark;
  ctx.fillRect(-2.4, -3.4, 1.5, 6.8);
  ctx.fillRect(0.9, -3.4, 1.5, 6.8);

  ctx.fillStyle = PALETTE.brown;
  ctx.beginPath();
  ctx.arc(-6, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
