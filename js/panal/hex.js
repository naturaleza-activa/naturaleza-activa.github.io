/**
 * Pointy-top axial hex math + fixed rectangular map.
 * Hit-testing is pure math — no per-cell DOM.
 */

const SQRT3 = Math.sqrt(3);

/** Neighbors in axial (q, r) for pointy-top. */
export const AXIAL_DIRS = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];

/** Default Langstroth-style comb: 64×32 = 2048 cells (~2.1:1). */
export const GRID_COLS = 64;
export const GRID_ROWS = 32;

export function keyOf(q, r) {
  return q + "," + r;
}

export function parseKey(key) {
  const parts = key.split(",");
  return { q: +parts[0], r: +parts[1] };
}

/**
 * Fixed odd-r (pointy-top) rectangular map with alternating row offset.
 */
export function buildGridMap(cols, rows) {
  const c = cols | 0;
  const rCount = rows | 0;
  const cells = [];
  for (let row = 0; row < rCount; row++) {
    for (let col = 0; col < c; col++) {
      // odd-r offset → axial
      const q = col - ((row - (row & 1)) >> 1);
      const r = row;
      cells.push({ q, r, col, row });
    }
  }
  return { cells, cols: c, rows: rCount, count: cells.length };
}

/** @deprecated use buildGridMap — kept for callers expecting ~targetCount sizing */
export function buildRectMap(targetCount) {
  if (targetCount >= 2000 && targetCount <= 2100) {
    return buildGridMap(GRID_COLS, GRID_ROWS);
  }
  const cols = Math.max(8, Math.round(Math.sqrt(targetCount * 1.15)));
  const rows = Math.max(8, Math.ceil(targetCount / cols));
  return buildGridMap(cols, rows);
}

export function axialToPixel(q, r, size) {
  const x = size * SQRT3 * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

export function pixelToAxial(x, y, size) {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return axialRound(q, r);
}

export function axialRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    });
  }
  return pts;
}

export function mapBounds(cols, rows, size) {
  const w = size * SQRT3 * (cols + 0.5);
  const h = size * (1.5 * rows + 0.5);
  return { w, h, aspect: w / h };
}

export function neighborsOf(q, r, index) {
  const out = [];
  for (let i = 0; i < AXIAL_DIRS.length; i++) {
    const nq = q + AXIAL_DIRS[i][0];
    const nr = r + AXIAL_DIRS[i][1];
    if (index.has(keyOf(nq, nr))) out.push({ q: nq, r: nr });
  }
  return out;
}
