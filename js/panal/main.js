import { CELL, JAR_GOAL, PALETTE, PANAL_ASSET_V } from "./palette.js";
import {
  GRID_COLS,
  GRID_ROWS,
  axialToPixel,
  buildGridMap,
  hexCorners,
  keyOf,
  mapBounds,
  pixelToAxial,
} from "./hex.js";
export { CURIOSITIES } from "./curiosities.js";
import { createCuriosityDeck } from "./curiosities.js";
import { clearAllPanalStorage } from "./storage.js";
import { createBees } from "./bees.js";
import { createJar } from "./jar.js";
import { drawLangstrothFrame, frameInsets } from "./frame.js";

/** Desktop target for the comb (wax) surface inside the wooden frame. */
const DESKTOP_COMB_W = 1040;
const DESKTOP_COMB_H = 490;

// Wipe any leftover keys before anything else runs
clearAllPanalStorage();

export function mountPanal(root) {
  if (!root) return null;

  // Always start clean — never restore
  clearAllPanalStorage();

  const canvas = root.querySelector("[data-panal-canvas]");
  const jarCanvas = root.querySelector("[data-panal-jar]");
  const cardEl = root.querySelector("[data-panal-card]");
  const cardText = root.querySelector("[data-panal-card-text]");
  const progressEl = root.querySelector("[data-panal-progress]");
  const countEl = root.querySelector("[data-panal-count]");
  const ctaWrap = root.querySelector("[data-panal-cta]");
  const skipBtn = root.querySelector("[data-panal-skip]");

  if (!canvas) return null;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const map = buildGridMap(GRID_COLS, GRID_ROWS);
  const index = new Map();
  for (let i = 0; i < map.cells.length; i++) {
    const c = map.cells[i];
    index.set(keyOf(c.q, c.r), c);
  }

  const filled = Object.create(null);
  let filledCount = 0;
  const deck = createCuriosityDeck(null);

  let hexSize = 10;
  let originX = 0;
  let originY = 0;
  let insets = frameInsets(DESKTOP_COMB_W);
  let selectedKey = null;
  let selectUntil = 0;
  let dirty = true;
  let running = true;
  let lastTs = 0;
  let cssW = 0;
  let cssH = 0;

  const combLayer = document.createElement("canvas");
  const combCtx = combLayer.getContext("2d", { alpha: false });

  const bees = createBees(7, map.cells, index, hexSize);
  const jar = jarCanvas ? createJar(jarCanvas) : null;

  function resetHudToZero() {
    filledCount = 0;
    for (const k of Object.keys(filled)) delete filled[k];
    selectedKey = null;
    if (countEl) countEl.textContent = "0";
    if (progressEl) {
      progressEl.style.width = "0%";
      progressEl.setAttribute("aria-valuenow", "0");
    }
    if (ctaWrap) ctaWrap.hidden = true;
    if (cardEl) {
      cardEl.hidden = true;
      cardEl.classList.remove("is-visible");
    }
    if (cardText) cardText.textContent = "";
    if (jar) jar.setFilledCount(0, true);
    dirty = true;
  }

  function updateHud() {
    const shown = Math.min(filledCount, JAR_GOAL);
    if (countEl) countEl.textContent = String(shown);
    if (progressEl) {
      progressEl.style.width = Math.round((shown / JAR_GOAL) * 100) + "%";
      progressEl.setAttribute("aria-valuenow", String(shown));
    }
    if (ctaWrap) ctaWrap.hidden = shown < JAR_GOAL;
    if (jar) jar.setFilledCount(shown, shown === 0);
  }

  function showCuriosity(text) {
    if (!cardEl || !cardText) return;
    cardText.textContent = text;
    cardEl.hidden = false;
    cardEl.classList.add("is-visible");
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const board = canvas.parentElement;
    const boardW = (board && board.clientWidth) || canvas.clientWidth || 320;

    const unit = mapBounds(map.cols, map.rows, 1);
    let combW = Math.min(boardW * 0.98, DESKTOP_COMB_W);
    let combH = Math.min(DESKTOP_COMB_H, Math.round(combW / unit.aspect));
    hexSize = Math.max(5.5, Math.min(combW / unit.w, combH / unit.h));
    const real = mapBounds(map.cols, map.rows, hexSize);
    combW = real.w;
    combH = real.h;

    insets = frameInsets(combW);
    cssW = Math.ceil(combW + insets.side * 2);
    cssH = Math.ceil(combH + insets.top + insets.bottom);

    if (cssW > boardW) {
      const scale = boardW / cssW;
      hexSize = Math.max(4.8, hexSize * scale);
      const real2 = mapBounds(map.cols, map.rows, hexSize);
      combW = real2.w;
      combH = real2.h;
      insets = frameInsets(combW);
      cssW = Math.ceil(combW + insets.side * 2);
      cssH = Math.ceil(combH + insets.top + insets.bottom);
    }

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    combLayer.width = Math.round(cssW * dpr);
    combLayer.height = Math.round(cssH * dpr);
    combCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    originX = insets.side + hexSize * Math.sqrt(3) * 0.5;
    originY = insets.top + hexSize;

    bees.resize(hexSize);
    if (jar) jar.resize();
    dirty = true;
  }

  function cellFill(state, q, r, cx, cy) {
    if (state === CELL.filled) {
      const g = combCtx.createRadialGradient(
        cx - hexSize * 0.2,
        cy - hexSize * 0.25,
        hexSize * 0.15,
        cx,
        cy,
        hexSize
      );
      g.addColorStop(0, PALETTE.mid);
      g.addColorStop(0.55, PALETTE.amber);
      g.addColorStop(1, PALETTE.deep);
      return g;
    }
    if (state === CELL.selected) return PALETTE.deep;
    const tone = ((q * 3 + r * 5) & 1) === 0 ? PALETTE.cream : PALETTE.soft;
    const g = combCtx.createRadialGradient(
      cx - hexSize * 0.25,
      cy - hexSize * 0.3,
      0,
      cx,
      cy,
      hexSize * 0.95
    );
    g.addColorStop(0, PALETTE.creamLight);
    g.addColorStop(0.55, tone);
    g.addColorStop(1, PALETTE.waxDeep);
    return g;
  }

  function drawHexOn(target, q, r, state) {
    const p = axialToPixel(q, r, hexSize);
    const cx = originX + p.x;
    const cy = originY + p.y;
    const rad = hexSize * 0.98;
    const pts = hexCorners(cx, cy, rad);
    target.beginPath();
    target.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) target.lineTo(pts[i].x, pts[i].y);
    target.closePath();
    target.fillStyle = cellFill(state, q, r, cx, cy);
    target.fill();
    target.strokeStyle =
      state === CELL.filled
        ? "rgba(112,66,15,0.45)"
        : state === CELL.selected
          ? PALETTE.brown
          : "rgba(169,104,25,0.32)";
    target.lineWidth =
      state === CELL.selected
        ? Math.max(1.2, hexSize * 0.12)
        : Math.max(0.55, hexSize * 0.06);
    target.stroke();

    if (state === CELL.empty) {
      target.fillStyle = "rgba(255,247,213,0.35)";
      target.beginPath();
      target.ellipse(
        cx - hexSize * 0.22,
        cy - hexSize * 0.28,
        hexSize * 0.18,
        hexSize * 0.1,
        -0.5,
        0,
        Math.PI * 2
      );
      target.fill();
    } else if (state === CELL.filled) {
      target.fillStyle = "rgba(255,247,213,0.28)";
      target.beginPath();
      target.ellipse(
        cx - hexSize * 0.15,
        cy - hexSize * 0.2,
        hexSize * 0.28,
        hexSize * 0.14,
        -0.4,
        0,
        Math.PI * 2
      );
      target.fill();
    }
  }

  function paintCombLayer() {
    drawLangstrothFrame(combCtx, cssW, cssH, insets);
    const now = performance.now();
    for (let i = 0; i < map.cells.length; i++) {
      const c = map.cells[i];
      const k = keyOf(c.q, c.r);
      let state = CELL.empty;
      if (filled[k]) state = CELL.filled;
      else if (k === selectedKey && now < selectUntil) state = CELL.selected;
      drawHexOn(combCtx, c.q, c.r, state);
    }
    dirty = false;
  }

  function redraw() {
    if (dirty) paintCombLayer();
    ctx.drawImage(combLayer, 0, 0, cssW, cssH);
    bees.draw(ctx, originX, originY);
    if (jar) jar.draw();
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = cssW / rect.width;
    const scaleY = cssH / rect.height;
    const x = (clientX - rect.left) * scaleX - originX;
    const y = (clientY - rect.top) * scaleY - originY;
    const axial = pixelToAxial(x, y, hexSize);
    const k = keyOf(axial.q, axial.r);
    if (!index.has(k)) return null;
    return { key: k, q: axial.q, r: axial.r };
  }

  function onPointer(e) {
    if (!running) return;
    const pt = e.touches && e.touches[0] ? e.touches[0] : e;
    const hit = hitTest(pt.clientX, pt.clientY);
    if (!hit) return;
    if (filled[hit.key]) return;

    selectedKey = hit.key;
    selectUntil = performance.now() + (reducedMotion ? 80 : 220);
    dirty = true;

    window.setTimeout(function () {
      if (filled[hit.key]) return;
      filled[hit.key] = true;
      filledCount++;
      const reward = deck.next();
      showCuriosity(reward.text);
      updateHud();
      clearAllPanalStorage(); // never leave keys behind
      dirty = true;
    }, reducedMotion ? 60 : 180);
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    bees.update(dt, reducedMotion);
    if (jar) jar.update(dt);
    if (selectedKey && performance.now() > selectUntil) {
      selectedKey = null;
      dirty = true;
    }
    redraw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("click", onPointer);
  canvas.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length === 1) {
        e.preventDefault();
        onPointer(e);
      }
    },
    { passive: false }
  );

  if (skipBtn) {
    skipBtn.addEventListener("click", function () {
      root.classList.add("is-collapsed");
      running = false;
    });
  }

  window.addEventListener("resize", function () {
    resize();
    redraw();
  });

  // Back-forward cache can restore a full jar — force zero when page is shown again
  window.addEventListener("pageshow", function (ev) {
    clearAllPanalStorage();
    if (ev.persisted) {
      resetHudToZero();
      resize();
      redraw();
    }
  });

  resetHudToZero();
  resize();
  redraw();
  requestAnimationFrame(function (ts) {
    lastTs = ts;
    requestAnimationFrame(frame);
  });

  return {
    getCellCount: () => map.count,
    getFilledCount: () => filledCount,
    getGrid: () => ({ cols: map.cols, rows: map.rows, hexSize }),
    destroy: () => {
      running = false;
    },
  };
}

function boot() {
  clearAllPanalStorage();
  const root = document.querySelector("[data-panal]");
  if (!root) return;
  const api = mountPanal(root);
  if (api && typeof console !== "undefined" && console.info) {
    console.info(
      "[panal]",
      PANAL_ASSET_V,
      "cells=",
      api.getCellCount(),
      "filled=",
      api.getFilledCount()
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
