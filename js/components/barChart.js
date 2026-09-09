import { el } from "../core/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child) node.append(child);
  }
  return node;
}

function tooltip(text) {
  const t = document.createElementNS(SVG_NS, "title");
  t.textContent = text;
  return t;
}

// Tiny inline bar sparkline — no axes, native tooltips per bar.
// values: [{ label, value, dim }]
export function sparkBars(values, { width = 132, height = 28, color = "var(--c-production)" } = {}) {
  const max = Math.max(1e-9, ...values.map((v) => v.value));
  const gap = 2;
  const barW = Math.max(2, (width - gap * (values.length - 1)) / values.length);
  const root = svg("svg", { width, height, class: "spark-bars", role: "img" });
  values.forEach((v, i) => {
    const h = v.value <= 0 ? 1.5 : Math.max(1.5, (v.value / max) * height);
    root.append(
      svg(
        "rect",
        {
          x: i * (barW + gap),
          y: height - h,
          width: barW,
          height: h,
          rx: 1.5,
          fill: v.value <= 0 ? "var(--surface-3)" : color,
          opacity: v.dim ? 0.45 : 1,
        },
        tooltip(`${v.label}: ${v.value.toFixed(1)} kg${v.dim ? " (partial)" : ""}`)
      )
    );
  });
  return root;
}

export function chartLegend(items) {
  return el(
    "div",
    "chart-legend",
    items.map((it) =>
      el("span", "legend-item", el("span", { class: "legend-dot", style: { background: it.color, ...(it.dashed ? { background: "transparent", border: `1.5px dashed ${it.borderColor || "var(--text-dim)"}` } : {}) } }), it.label)
    )
  );
}

// Stacked monthly bar chart (responsive via viewBox).
// months: ["2025-04", ...]; series: [{ label, color, values: number[] }]
// opts: { height, partialLast, forecast: { label, value }, unit }
export function monthlyBarChart(months, series, { height = 190, partialLast = false, forecast = null, unit = "kg" } = {}) {
  const padL = 34;
  const padR = 6;
  const padT = 8;
  const padB = 20;
  const slots = months.length + (forecast ? 1 : 0);
  const slotW = Math.max(18, Math.min(44, Math.round(640 / Math.max(1, slots))));
  const width = padL + padR + slots * slotW;
  const plotH = height - padT - padB;

  const totals = months.map((_, i) => series.reduce((s, sr) => s + Math.max(0, sr.values[i] || 0), 0));
  const max = Math.max(1e-9, ...totals, forecast ? forecast.value : 0);
  const yFor = (v) => padT + plotH * (1 - v / max);

  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "bar-chart", role: "img", preserveAspectRatio: "xMidYMid meet" });

  // Gridlines + value labels at 3 levels.
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    const v = max * frac;
    const y = yFor(v);
    root.append(svg("line", { x1: padL, x2: width - padR, y1: y, y2: y, stroke: "var(--surface-3)", "stroke-width": 1 }));
    root.append(
      svg("text", { x: padL - 5, y: y + 3, "text-anchor": "end", class: "chart-axis-label" }, String(v >= 100 ? Math.round(v) : v.toFixed(1)))
    );
  }
  root.append(svg("line", { x1: padL, x2: width - padR, y1: yFor(0), y2: yFor(0), stroke: "var(--border)", "stroke-width": 1 }));

  const barW = Math.max(6, slotW - 8);
  const labelEvery = Math.max(1, Math.ceil(months.length / 8));

  months.forEach((month, i) => {
    const x = padL + i * slotW + (slotW - barW) / 2;
    const isPartial = partialLast && i === months.length - 1;
    let yCursor = yFor(0);
    for (const sr of series) {
      const v = Math.max(0, sr.values[i] || 0);
      if (v <= 0) continue;
      const h = Math.max(0, (v / max) * plotH);
      yCursor -= h;
      root.append(
        svg(
          "rect",
          // 2px gap between stacked segments, drawn by shrinking each segment from its top.
          { x, y: yCursor + 1, width: barW, height: Math.max(1, h - 2), rx: 2, fill: sr.color, opacity: isPartial ? 0.45 : 1, class: "bar-seg" },
          tooltip(`${fmtMonth(month)} · ${sr.label}: ${v.toFixed(1)} ${unit}${isPartial ? " (partial month)" : ""}`)
        )
      );
    }
    if (i % labelEvery === 0) {
      root.append(
        svg("text", { x: padL + i * slotW + slotW / 2, y: height - 6, "text-anchor": "middle", class: "chart-axis-label" }, fmtMonthShort(month))
      );
    }
  });

  if (forecast) {
    const x = padL + months.length * slotW + (slotW - barW) / 2;
    const h = Math.max(0, (Math.max(0, forecast.value) / max) * plotH);
    root.append(
      svg(
        "rect",
        { x, y: yFor(0) - h, width: barW, height: Math.max(1, h), rx: 2, fill: "var(--c-production-soft)", stroke: "var(--c-production)", "stroke-width": 1.5, "stroke-dasharray": "4 3" },
        tooltip(`${forecast.label}: ${forecast.value.toFixed(1)} ${unit} (forecast)`)
      )
    );
    root.append(svg("text", { x: x + barW / 2, y: height - 6, "text-anchor": "middle", class: "chart-axis-label" }, "fcst"));
  }

  return el("div", "chart-wrap", root);
}

function fmtMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtMonthShort(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" }) + (mo === 1 ? ` '${String(y).slice(2)}` : "");
}
