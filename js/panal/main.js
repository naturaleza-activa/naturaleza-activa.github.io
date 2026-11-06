import { CELL, JAR_GOAL, PALETTE } from "./palette.js";
import {
  axialToPixel,
  buildRectMap,
  hexCorners,
  keyOf,
  mapBounds,
  pixelToAxial,
} from "./hex.js";
export { CURIOSITIES } from "./curiosities.js";
import { createCuriosityDeck } from "./curiosities.js";
import { loadProgress, saveProgress } from "./storage.js";
import { createBees } from "./bees.js";
import { createJar } from "./jar.js";

const TARGET_CELLS = 2000;

export function mountPanal(root) {
  if (!root) return null;

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

  const map = buildRectMap(TARGET_CELLS);
  const index = new Map();
  for (let i = 0; i < map.cells.length; i++) {
    const c = map.cells[i];
    index.set(keyOf(c.q, c.r), c);
  }

  const saved = loadProgress();
  const filled = Object.create(null);
  let filledCount = 0;
  if (saved && saved.filled) {
    Object.keys(saved.filled).forEach((k) => {
      if (saved.filled[k] && index.has(k)) {
        filled[k] = true;
        filledCount++;
      }
    });
  }

  const deck = createCuriosityDeck(saved && saved.curiosityOrder);
  if (saved && typeof saved.curiosityCursor === "number") {
    deck.setCursor(saved.curiosityCursor);
  }

  let hexSize = 10;
  let originX = 0;
  let originY = 0;
  let selectedKey = null;
  let selectUntil = 0;
  let dirty = true;
  let running = true;
  let lastTs = 0;

  const bees = createBees(3, map.cells, index, hexSize);
  const jar = jarCanvas ? createJar(jarCanvas) : null;
  if (jar) jar.setFilledCount(Math.min(filledCount, JAR_GOAL));

  function persist() {
    const deckState = deck.getState();
    saveProgress({
      filled,
      filledCount,
      curiosityOrder: deckState.order,
      curiosityCursor: deckState.cursor,
    });
  }

  function updateHud() {
    const shown = Math.min(filledCount, JAR_GOAL);
    if (countEl) countEl.textContent = String(shown);
    if (progressEl) {
      progressEl.style.width = Math.round((shown / JAR_GOAL) * 100) + "%";
      progressEl.setAttribute("aria-valuenow", String(shown));
    }
    if (ctaWrap) ctaWrap.hidden = shown < JAR_GOAL;
    if (jar) jar.setFilledCount(shown);
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
    const cssW = (board && board.clientWidth) || canvas.clientWidth || 320;
    const cssH = Math.max(280, Math.min(520, Math.round(cssW * 0.72)));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bounds = mapBounds(map.cols, map.rows, 1);
    const pad = 8;
    hexSize = Math.max(
      4.5,
      Math.min((cssW - pad * 2) / bounds.w, (cssH - pad * 2) / bounds.h)
    );
    const real = mapBounds(map.cols, map.rows, hexSize);
    originX = (cssW - real.w) / 2 + hexSize * Math.sqrt(3) * 0.5;
    originY = (cssH - real.h) / 2 + hexSize;

    bees.resize(hexSize);
    if (jar) jar.resize();
    dirty = true;
  }

  function cellColor(state, q, r) {
    if (state === CELL.filled) return PALETTE.amber;
    if (state === CELL.selected) return PALETTE.deep;
    // subtle checker of empty tones
    const tone = ((q * 3 + r * 5) & 1) === 0 ? PALETTE.cream : PALETTE.soft;
    return tone;
  }

  function drawHex(q, r, state) {
    const p = axialToPixel(q, r, hexSize);
    const cx = originX + p.x;
    const cy = originY + p.y;
    const pts = hexCorners(cx, cy, hexSize * 0.96);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = cellColor(state, q, r);
    ctx.fill();
    ctx.strokeStyle =
      state === CELL.filled ? PALETTE.brown : "rgba(112,66,15,0.28)";
    ctx.lineWidth = state === CELL.selected ? 1.4 : 0.6;
    ctx.stroke();
  }

  function redraw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = PALETTE.creamLight;
    ctx.fillRect(0, 0, w, h);

    // soft vignette wash (amber only)
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      hexSize * 2,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.7
    );
    g.addColorStop(0, "rgba(245,206,101,0.22)");
    g.addColorStop(1, "rgba(255,247,213,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const now = performance.now();
    for (let i = 0; i < map.cells.length; i++) {
      const c = map.cells[i];
      const k = keyOf(c.q, c.r);
      let state = CELL.empty;
      if (filled[k]) state = CELL.filled;
      else if (k === selectedKey && now < selectUntil) state = CELL.selected;
      drawHex(c.q, c.r, state);
    }

    bees.draw(ctx, originX, originY);
    if (jar) jar.draw();
    dirty = false;
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - originX;
    const y = clientY - rect.top - originY;
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

    window.setTimeout(
      function () {
        if (filled[hit.key]) return;
        filled[hit.key] = true;
        filledCount++;
        const reward = deck.next();
        showCuriosity(reward.text);
        updateHud();
        persist();
        dirty = true;
      },
      reducedMotion ? 60 : 180
    );
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

  updateHud();
  resize();
  redraw();
  requestAnimationFrame(function (ts) {
    lastTs = ts;
    requestAnimationFrame(frame);
  });

  return {
    getCellCount: () => map.count,
    getFilledCount: () => filledCount,
    destroy: () => {
      running = false;
    },
  };
}

function boot() {
  const root = document.querySelector("[data-panal]");
  if (!root) return;
  const api = mountPanal(root);
  if (api && typeof console !== "undefined" && console.debug) {
    console.debug("[panal] cells=", api.getCellCount());
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
