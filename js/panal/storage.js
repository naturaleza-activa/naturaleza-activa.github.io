import { STORAGE_KEY } from "./palette.js";

/**
 * Progress is in-memory only: resets when the page is closed or reloaded.
 * Clears any legacy localStorage key from earlier builds.
 */
export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Always fresh — no cross-load persistence. */
export function loadProgress() {
  clearProgress();
  return null;
}

/** No-op: do not write progress to disk. */
export function saveProgress() {
  clearProgress();
}
