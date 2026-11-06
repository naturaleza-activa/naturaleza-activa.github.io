import { STORAGE_KEY } from "./palette.js";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      filled: data.filled && typeof data.filled === "object" ? data.filled : {},
      curiosityOrder: Array.isArray(data.curiosityOrder) ? data.curiosityOrder : null,
      curiosityCursor: typeof data.curiosityCursor === "number" ? data.curiosityCursor : 0,
      filledCount: typeof data.filledCount === "number" ? data.filledCount : 0,
    };
  } catch {
    return null;
  }
}

export function saveProgress(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        filled: state.filled,
        curiosityOrder: state.curiosityOrder,
        curiosityCursor: state.curiosityCursor,
        filledCount: state.filledCount,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* private mode / quota */
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
