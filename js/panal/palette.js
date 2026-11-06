/** Honeycomb + wood palette — owner spec (no greens, no dark stage). */
export const PALETTE = {
  creamLight: "#FFF7D5",
  cream: "#FFF0A8",
  soft: "#FFE69A",
  mid: "#F5CE65",
  amber: "#DFA02C",
  deep: "#C58B29",
  brown: "#A96819",
  dark: "#70420F",
  // Langstroth wood rails (warm honey-wood only)
  woodLight: "#E8C07A",
  woodMid: "#C9954A",
  woodDeep: "#A56E28",
  woodGrain: "#8B5A1F",
  wax: "#FFE9A0",
  waxDeep: "#F0D070",
};

export const CELL = {
  empty: 0,
  selected: 1,
  filled: 2,
};

export const JAR_GOAL = 20;
/** Legacy key name only — progress is never persisted. */
export const STORAGE_KEY = "na-panal-v1";
/** Bump to force browsers to refetch ES modules after Pages deploys. */
export const PANAL_ASSET_V = "20261106-reset3";
