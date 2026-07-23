import { el } from "../core/dom.js";

export function card({ title, sub, body, clickable = false, onClick } = {}, ...children) {
  return el(
    "div",
    { class: `card${clickable ? " clickable" : ""}`, onclick: onClick },
    title ? el("div", "card-title", title) : null,
    sub ? el("div", "card-sub", sub) : null,
    body || null,
    children
  );
}

export function statTile(value, label, color) {
  return el(
    "div",
    "stat-tile",
    el("div", { class: "stat-value", style: color ? { color } : null }, String(value)),
    el("div", "stat-label", label)
  );
}
