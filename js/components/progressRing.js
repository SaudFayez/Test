import { el } from "../core/dom.js";

// SVG progress ring. percent 0-100.
export function progressRing(percent, { size = 64, stroke = 6, color = "var(--accent)", label, sub } = {}) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  const wrap = el("div", { class: "progress-ring", style: { width: size + "px", height: size + "px" } });
  wrap.innerHTML = `
    <svg width="${size}" height="${size}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${center} ${center})" style="transition: stroke-dashoffset 0.25s"/>
    </svg>`;
  const labelEl = el(
    "div",
    { class: "ring-label", style: { fontSize: Math.round(size / 4.5) + "px" } },
    label !== undefined ? label : Math.round(clamped) + "%",
    sub ? el("span", "ring-sub", sub) : null
  );
  wrap.append(labelEl);
  return wrap;
}

export function progressBar(percent, color) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  return el(
    "div",
    "progress-bar",
    el("div", { style: { width: clamped + "%", background: color || "var(--accent)" } })
  );
}
