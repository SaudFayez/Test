import { el, clear } from "../core/dom.js";
import { roastingStore } from "../core/stores.js";
import { card, statTile } from "../components/card.js";
import { field, numberInput } from "../components/formField.js";
import { tabs } from "../components/tabs.js";
import { openModal } from "../components/modal.js";
import { progressBar } from "../components/progressRing.js";
import { sparkBars, monthlyBarChart, chartLegend } from "../components/barChart.js";
import { SNAPSHOT_DATE, FIRST_MONTH, LAST_FULL_MONTH, ORIGINS } from "../data/roasting-data.js";

const ACCENT = "var(--c-production)";
const SALE_COLOR = "#cf7a35"; // wholesale / online — validated vs dark surface
const POS_COLOR = "#4f8cff"; // café (POS)
const WEEKS_PER_MONTH = 4.33;

let activeTab = "plan";

/* ---------------- Month helpers ---------------- */

function nextMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

function monthRange(from, to) {
  const out = [];
  for (let m = from; m <= to; m = nextMonth(m)) out.push(m);
  return out;
}

function fmtMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const PARTIAL_MONTH = nextMonth(LAST_FULL_MONTH); // snapshot month, incomplete
const FORECAST_MONTH = nextMonth(PARTIAL_MONTH);
const FULL_MONTHS = monthRange(FIRST_MONTH, LAST_FULL_MONTH);

/* ---------------- Forecast + plan math (pure) ---------------- */

const demandKg = (origin, m) => (origin.demand[m]?.sale || 0) + (origin.demand[m]?.pos || 0);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Weighted moving average of the last 3 full months (weights 1/2/3 oldest→newest),
// damped-trend adjustment when ≥6 months of history exist. Every number is
// surfaced in the UI so the forecast stays hand-checkable.
export function computeForecast(origin, growthPct) {
  const firstIdx = FULL_MONTHS.findIndex((m) => demandKg(origin, m) > 0);
  if (firstIdx === -1) {
    return { base: 0, trend: 1, forecastKg: 0, isNew: true, inactive: true, historyMonths: 0, avg3: 0 };
  }
  const hist = FULL_MONTHS.slice(firstIdx).map((m) => Math.max(0, demandKg(origin, m)));
  const last3 = hist.slice(-3);
  const weights = [1, 2, 3].slice(3 - last3.length);
  const base = last3.reduce((s, v, i) => s + v * weights[i], 0) / weights.reduce((a, b) => a + b, 0);

  let trend = 1;
  if (hist.length >= 6) {
    const prev3 = avg(hist.slice(-6, -3));
    if (prev3 > 0) trend = clamp(1 + (avg(last3) / prev3 - 1) * 0.5, 0.75, 1.25);
  }

  const inactive = last3.every((v) => v === 0);
  const forecastKg = inactive ? 0 : Math.max(0, base * trend * (1 + growthPct / 100));
  return { base, trend, forecastKg, isNew: hist.length < 3, inactive, historyMonths: hist.length, avg3: avg(last3) };
}

export function computePlan(forecastKg, stockKg, { batchSizeKg, roastLossPct, safetyStockWeeks }) {
  const weeklyKg = forecastKg / WEEKS_PER_MONTH;
  const needKg = forecastKg + weeklyKg * safetyStockWeeks;
  const planKg = Math.max(0, needKg - stockKg);
  const batches = planKg > 0 && batchSizeKg > 0 ? Math.ceil(planKg / batchSizeKg) : 0;
  const roastKg = batches * batchSizeKg;
  const greenKg = roastLossPct < 100 ? roastKg / (1 - roastLossPct / 100) : 0;
  const coverageWeeks = weeklyKg > 0 ? stockKg / weeklyKg : null;
  return { needKg, planKg, batches, roastKg, greenKg, coverageWeeks };
}

function computeRows(params) {
  return ORIGINS.map((origin) => {
    const fc = computeForecast(origin, params.growthPct);
    const plan = computePlan(fc.forecastKg, origin.stockKg, params);
    return { origin, ...fc, ...plan };
  }).sort((a, b) => b.planKg - a.planKg || b.forecastKg - a.forecastKg);
}

/* ---------------- Formatting ---------------- */

const fmtKg = (v) => (v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1));

function coverageTone(weeks, safetyWeeks) {
  if (weeks === null) return { color: "var(--text-faint)", label: "—" };
  const label = weeks >= 52 ? ">52 wk" : `${weeks.toFixed(1)} wk`;
  if (weeks < safetyWeeks) return { color: "var(--danger)", label };
  if (weeks < safetyWeeks + 2) return { color: "var(--warning)", label };
  return { color: "var(--success)", label };
}

/* ---------------- Page ---------------- */

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = roastingStore.subscribe(draw);
  draw();
  return unsubscribe;
}

function view() {
  const params = roastingStore.get();
  const rows = computeRows(params);
  const active = rows.filter((r) => !r.inactive);
  const belowSafety = active.filter((r) => r.coverageWeeks !== null && r.coverageWeeks < params.safetyStockWeeks);
  const totals = {
    forecast: active.reduce((s, r) => s + r.forecastKg, 0),
    plan: active.reduce((s, r) => s + r.planKg, 0),
    batches: active.reduce((s, r) => s + r.batches, 0),
    green: active.reduce((s, r) => s + r.greenKg, 0),
  };

  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el(
        "div",
        null,
        el("h1", null, "Roasting Production Plan"),
        el("div", "subtitle", `Forecast for ${fmtMonth(FORECAST_MONTH)} · data snapshot ${SNAPSHOT_DATE} · demand from wholesale + café sales`)
      )
    ),
    el(
      "div",
      "stats-row",
      statTile(`${fmtKg(totals.forecast)} kg`, `${fmtMonth(FORECAST_MONTH)} demand forecast`, ACCENT),
      statTile(`${fmtKg(totals.plan)} kg`, "To roast (after stock)", ACCENT),
      statTile(totals.batches, `Batches @ ${params.batchSizeKg} kg`, ACCENT),
      statTile(`${fmtKg(totals.green)} kg`, "Green beans needed", ACCENT),
      statTile(belowSafety.length, "Beans below safety stock", belowSafety.length > 0 ? "var(--danger)" : "var(--success)")
    ),
    paramsCard(params),
    tabs(
      [
        { id: "plan", label: "Production Plan", render: (panel) => renderPlanTab(panel, rows, params) },
        { id: "history", label: "Demand History", render: (panel) => renderHistoryTab(panel) },
      ],
      { active: activeTab, onChange: (id) => (activeTab = id) }
    )
  );
}

/* ---------------- Parameters ---------------- */

function paramsCard(params) {
  const numField = (label, key, props = {}) =>
    field(
      label,
      numberInput({
        value: params[key],
        ...props,
        onchange: (e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) roastingStore.update((s) => ({ ...s, [key]: v }));
          else e.target.value = params[key];
        },
      })
    );

  return card(
    { title: "Planning parameters", sub: "Saved automatically — the plan below recalculates as you tune them." },
    el(
      "div",
      "params-grid mt3",
      numField("Demand growth %", "growthPct", { min: -50, max: 200, step: 5 }),
      numField("Batch size (kg)", "batchSizeKg", { min: 1, step: 1 }),
      numField("Roast weight loss %", "roastLossPct", { min: 0, max: 30, step: 0.5 }),
      numField("Safety stock (weeks)", "safetyStockWeeks", { min: 0, max: 12, step: 0.5 })
    )
  );
}

/* ---------------- Plan tab ---------------- */

function renderPlanTab(panel, rows, params) {
  const sparkMonths = FULL_MONTHS.slice(-11).concat(PARTIAL_MONTH);

  const header = el(
    "tr",
    null,
    el("th", null, "Bean"),
    el("th", null, "Last 12 mo"),
    el("th", "num", "Avg 3 mo (kg)"),
    el("th", "num", `${fmtMonth(FORECAST_MONTH)} fcst (kg)`),
    el("th", "num", "Stock (kg)"),
    el("th", null, "Coverage"),
    el("th", "num", "Roast (kg)"),
    el("th", "num", "Batches"),
    el("th", "num", "Green (kg)")
  );

  const body = rows.map((r) => {
    const tone = coverageTone(r.coverageWeeks, params.safetyStockWeeks);
    const covPct = r.coverageWeeks === null ? 0 : clamp((r.coverageWeeks / (params.safetyStockWeeks + 4)) * 100, 0, 100);
    return el(
      "tr",
      { class: r.inactive ? "dim-row" : null, onclick: () => openOriginDetail(r, params) },
      el(
        "td",
        "origin-cell",
        r.origin.name,
        r.isNew && !r.inactive ? el("span", { class: "badge badge-accent", style: { marginLeft: "8px" } }, "new") : null,
        r.inactive ? el("span", { class: "badge", style: { marginLeft: "8px" } }, "inactive") : null
      ),
      el("td", null, sparkBars(sparkMonths.map((m) => ({ label: fmtMonth(m), value: Math.max(0, demandKg(r.origin, m)), dim: m === PARTIAL_MONTH })))),
      el("td", "num", fmtKg(r.avg3)),
      el("td", "num", fmtKg(r.forecastKg)),
      el("td", "num", fmtKg(r.origin.stockKg)),
      el("td", null, el("div", "coverage-cell", progressBar(covPct, tone.color), el("span", { class: "cov-label", style: { color: tone.color } }, tone.label))),
      el("td", { class: `num${r.planKg > 0 ? " plan-hot" : ""}` }, r.planKg > 0 ? fmtKg(r.roastKg) : "—"),
      el("td", "num", r.batches || "—"),
      el("td", "num", r.batches ? fmtKg(r.greenKg) : "—")
    );
  });

  panel.append(
    el("div", "muted small mb3", "Roast = forecast + safety stock − current stock, rounded up to whole batches. Click a bean for the detailed breakdown."),
    el("div", "table-wrap", el("table", "data-table", el("thead", null, header), el("tbody", null, body)))
  );
}

/* ---------------- Origin detail modal ---------------- */

function openOriginDetail(r, params) {
  const months = FULL_MONTHS.concat(PARTIAL_MONTH);
  const chart = monthlyBarChart(
    months,
    [
      { label: "Wholesale / online", color: SALE_COLOR, values: months.map((m) => r.origin.demand[m]?.sale || 0) },
      { label: "Café (POS)", color: POS_COLOR, values: months.map((m) => r.origin.demand[m]?.pos || 0) },
    ],
    { partialLast: true, forecast: { label: fmtMonth(FORECAST_MONTH), value: r.forecastKg } }
  );

  const producedMonths = Object.keys(r.origin.produced || {}).sort();
  const growthFactor = 1 + params.growthPct / 100;

  openModal({
    title: `${r.origin.name} — plan detail`,
    content: el(
      "div",
      null,
      chartLegend([
        { label: "Wholesale / online", color: SALE_COLOR },
        { label: "Café (POS)", color: POS_COLOR },
        { label: "Forecast", dashed: true, borderColor: "var(--c-production)" },
      ]),
      chart,
      el("div", { class: "formula-note", style: { marginTop: "var(--s3)" } },
        r.inactive
          ? "No demand in the last 3 full months — forecast 0, excluded from the plan."
          : `Forecast = WMA3 ${fmtKg(r.base)} × trend ${r.trend.toFixed(2)} × growth ${growthFactor.toFixed(2)} = ${fmtKg(r.forecastKg)} kg` +
            ` · need ${fmtKg(r.needKg)} kg (incl. ${params.safetyStockWeeks} wk safety) − stock ${fmtKg(r.origin.stockKg)} kg → roast ${fmtKg(r.planKg)} kg` +
            ` → ${r.batches} × ${params.batchSizeKg} kg batches → ${fmtKg(r.greenKg)} kg green @ ${params.roastLossPct}% loss`
      ),
      el("h3", { class: "mt3 mb2", style: { fontSize: "14px" } }, "Stock by pack size"),
      el(
        "div",
        "sku-breakdown",
        r.origin.skus.length
          ? r.origin.skus
              .filter((s) => s.qty > 0)
              .map((s) => el("div", "sku-row", el("span", null, s.name), el("strong", null, `${s.qty % 1 ? s.qty.toFixed(2) : s.qty} × ${s.packKg} kg = ${fmtKg(s.qty * s.packKg)} kg`)))
          : el("span", "faint", "No stock on hand")
      ),
      producedMonths.length
        ? el(
            "div",
            null,
            el("h3", { class: "mt3 mb2", style: { fontSize: "14px" } }, "Roasted (manufacturing orders)"),
            el(
              "div",
              "sku-breakdown",
              producedMonths.map((m) => el("div", "sku-row", el("span", null, fmtMonth(m)), el("strong", null, `${fmtKg(r.origin.produced[m])} kg`)))
            )
          )
        : null
    ),
  });
}

/* ---------------- History tab ---------------- */

function renderHistoryTab(panel) {
  const months = FULL_MONTHS.concat(PARTIAL_MONTH);
  const sumBy = (channel) => months.map((m) => ORIGINS.reduce((s, o) => s + Math.max(0, o.demand[m]?.[channel] || 0), 0));

  const totalChart = monthlyBarChart(
    months,
    [
      { label: "Wholesale / online", color: SALE_COLOR, values: sumBy("sale") },
      { label: "Café (POS)", color: POS_COLOR, values: sumBy("pos") },
    ],
    { partialLast: true }
  );

  const lastFull = LAST_FULL_MONTH;
  const miniMonths = FULL_MONTHS.slice(-11).concat(PARTIAL_MONTH);
  const byRecent = [...ORIGINS].sort((a, b) => demandKg(b, lastFull) - demandKg(a, lastFull));

  panel.append(
    card(
      { title: "All beans — monthly demand (kg)", sub: `${fmtMonth(FIRST_MONTH)} – ${fmtMonth(PARTIAL_MONTH)} · ${fmtMonth(PARTIAL_MONTH)} is a partial month` },
      el("div", "mt3", chartLegend([
        { label: "Wholesale / online", color: SALE_COLOR },
        { label: "Café (POS)", color: POS_COLOR },
      ]), totalChart)
    ),
    el("div", { class: "mini-chart-grid", style: { marginTop: "var(--s4)" } },
      byRecent.map((o) =>
        el(
          "div",
          "mini-chart",
          el("div", "mc-head", el("span", "mc-name", o.name), el("span", "mc-val", `${fmtKg(demandKg(o, lastFull))} kg in ${fmtMonth(lastFull)}`)),
          sparkBars(
            miniMonths.map((m) => ({ label: fmtMonth(m), value: Math.max(0, demandKg(o, m)), dim: m === PARTIAL_MONTH })),
            { width: 220, height: 40 }
          )
        )
      )
    )
  );
}
