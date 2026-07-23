import { el } from "../core/dom.js";

export function emptyState(icon, title, hint) {
  return el(
    "div",
    "empty-state",
    el("div", "es-icon", icon),
    el("div", "es-title", title),
    hint ? el("div", "es-hint", hint) : null
  );
}
