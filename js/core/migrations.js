// Schema versioning. Bump CURRENT_VERSION and add a MIGRATIONS entry whenever
// a stored shape changes. Each migration receives the full { key → parsed
// state } map of lifeos.* data and returns the upgraded map.

export const CURRENT_VERSION = 1;

export const MIGRATIONS = {
  // 1: identity — v1 is the initial schema.
  1: (allData) => allData,
};

const META_KEY = "lifeos.meta";

export function ensureMeta() {
  let meta;
  try {
    meta = JSON.parse(localStorage.getItem(META_KEY));
  } catch {
    meta = null;
  }
  if (!meta || typeof meta.version !== "number") {
    meta = { version: CURRENT_VERSION, createdAt: new Date().toISOString(), lastSavedAt: null };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return meta;
  }
  if (meta.version < CURRENT_VERSION) {
    migrateStorage(meta.version);
    meta.version = CURRENT_VERSION;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }
  return meta;
}

export function migrateData(allData, fromVersion) {
  let data = allData;
  for (let v = fromVersion + 1; v <= CURRENT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) data = step(data);
  }
  return data;
}

function migrateStorage(fromVersion) {
  const allData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("lifeos.") && key !== META_KEY) {
      try {
        allData[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        // Corrupt module data is dropped by migration; stores fall back to defaults.
      }
    }
  }
  const migrated = migrateData(allData, fromVersion);
  for (const [key, value] of Object.entries(migrated)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
