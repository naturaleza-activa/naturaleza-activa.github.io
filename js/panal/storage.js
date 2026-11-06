/**
 * Panal progress must NEVER survive a page close/reload.
 * Wipe every known / matching key on init (legacy keys included).
 */

const KNOWN_KEYS = [
  "na-panal-v1",
  "na-panal-v2",
  "na-panal",
  "panal-progress",
  "panalProgress",
  "naturaleza-panal",
];

const KEY_RE = /panal|honeycomb|na-panal/i;

export function clearAllPanalStorage() {
  wipeStore(localStorage);
  wipeStore(sessionStorage);
}

function wipeStore(store) {
  if (!store) return;
  try {
    for (let i = 0; i < KNOWN_KEYS.length; i++) {
      try {
        store.removeItem(KNOWN_KEYS[i]);
      } catch {
        /* ignore */
      }
    }
    const toRemove = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && KEY_RE.test(k)) toRemove.push(k);
    }
    for (let i = 0; i < toRemove.length; i++) {
      try {
        store.removeItem(toRemove[i]);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* private mode */
  }
}

/** @deprecated kept so old cached bundles calling loadProgress still get null + wipe */
export function loadProgress() {
  clearAllPanalStorage();
  return null;
}

/** @deprecated no-op wipe */
export function saveProgress() {
  clearAllPanalStorage();
}

export function clearProgress() {
  clearAllPanalStorage();
}
