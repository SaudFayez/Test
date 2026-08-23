// Snapshot of Batch Roastery Odoo data (roasted-bean demand, stock, production).
// PLACEHOLDER — real snapshot extraction in progress; regenerated from Odoo via MCP.
// See README "Production data snapshot" for the extraction recipe.

export const SNAPSHOT_DATE = "2026-08-23";
export const FIRST_MONTH = "2025-04";
export const LAST_FULL_MONTH = "2026-07";

// { id, name, stockKg, skus: [{productId, name, packKg, qty}],
//   demand: { "YYYY-MM": { sale, pos } },  // kg, missing month = 0
//   produced: { "YYYY-MM": kg } }
export const ORIGINS = [];
