// localStorage-backed pub/sub store factory.
// Loads on creation, deep-merges stored state over defaults (so new fields
// added in later versions are backfilled), and falls back to defaults on
// corrupt JSON instead of white-screening.

const PERSIST_DEBOUNCE_MS = 100;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(base[key]) && isPlainObject(value) ? deepMerge(base[key], value) : value;
  }
  return out;
}

export function createStore(storageKey, defaultState) {
  let state = load();
  let timer = null;
  const listeners = new Set();
  if (localStorage.getItem(storageKey) === null) persist();

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return structuredClone(defaultState);
      return deepMerge(structuredClone(defaultState), JSON.parse(raw));
    } catch (err) {
      console.warn(`lifeos: corrupt data in "${storageKey}", falling back to defaults`, err);
      return structuredClone(defaultState);
    }
  }

  function persist() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        localStorage.setItem(
          "lifeos.meta",
          JSON.stringify({ ...readMeta(), lastSavedAt: new Date().toISOString() })
        );
      } catch (err) {
        console.error(`lifeos: failed to persist "${storageKey}"`, err);
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  return {
    key: storageKey,

    get() {
      return state;
    },

    set(partialOrFn) {
      const next = typeof partialOrFn === "function" ? partialOrFn(state) : { ...state, ...partialOrFn };
      state = next;
      persist();
      notify();
    },

    update(fn) {
      this.set(fn);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    reset() {
      state = structuredClone(defaultState);
      persist();
      notify();
    },

    // Re-read from localStorage (used after import restores raw keys).
    reload() {
      state = load();
      notify();
    },
  };
}

function readMeta() {
  try {
    return JSON.parse(localStorage.getItem("lifeos.meta")) || {};
  } catch {
    return {};
  }
}
