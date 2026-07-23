import { el, clear } from "../core/dom.js";

// tabs([{ id, label, render: (panel) => void }], { active }) → element.
// Remembers nothing across page loads; pass `active` to restore.
export function tabs(defs, { active, onChange } = {}) {
  let current = active && defs.some((d) => d.id === active) ? active : defs[0].id;
  const panel = el("div", "tabs-panel");
  const bar = el("div", "tabs-bar");

  function show(id) {
    current = id;
    bar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    clear(panel);
    defs.find((d) => d.id === id).render(panel);
    if (onChange) onChange(id);
  }

  for (const def of defs) {
    bar.append(
      el("button", { dataset: { tab: def.id }, onclick: () => show(def.id) }, def.label)
    );
  }

  const root = el("div", "tabs", bar, panel);
  show(current);
  return root;
}
