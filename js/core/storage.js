// Whole-app backup: export/import/clear across every lifeos.* key.

import { ALL_STORES } from "./stores.js";
import { CURRENT_VERSION, migrateData } from "./migrations.js";
import { todayStr } from "./dom.js";

export function exportAll() {
  const data = {};
  for (const store of ALL_STORES) data[store.key] = store.get();
  const payload = {
    app: "lifeos",
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lifeos-backup-${todayStr()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Overwrites all module data with the backup's contents. Throws on invalid input.
export function importAll(parsed) {
  if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Not a Life OS backup file.");
  }
  const version = Number(parsed.version);
  if (!Number.isInteger(version) || version < 1) throw new Error("Backup file has no valid version.");
  if (version > CURRENT_VERSION) {
    throw new Error(`Backup version ${version} is newer than this app (v${CURRENT_VERSION}).`);
  }

  const migrated = migrateData(parsed.data, version);
  for (const [key, value] of Object.entries(migrated)) {
    if (key.startsWith("lifeos.") && key !== "lifeos.meta") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
  localStorage.setItem(
    "lifeos.meta",
    JSON.stringify({ version: CURRENT_VERSION, createdAt: new Date().toISOString(), lastSavedAt: new Date().toISOString() })
  );
  ALL_STORES.forEach((store) => store.reload());
}

export function clearAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("lifeos.")) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  ALL_STORES.forEach((store) => store.reload());
}
