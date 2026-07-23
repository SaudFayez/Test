import { el, svgIcon } from "../core/dom.js";

const PENCIL = '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>';
const TRASH = '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';

export function iconButton(iconPath, onClick, { danger = false, label = "" } = {}) {
  const btn = el(
    "button",
    { class: `btn btn-ghost btn-icon${danger ? " btn-danger" : ""}`, "aria-label": label, title: label, onclick: onClick },
    svgIcon(iconPath)
  );
  return btn;
}

export const editButton = (onClick) => iconButton(PENCIL, onClick, { label: "Edit" });
export const deleteButton = (onClick) => iconButton(TRASH, onClick, { danger: true, label: "Delete" });

// Generic list row: leading element, title + meta badges, trailing actions.
export function listItem({ leading, title, titleDone = false, meta = [], actions = [] }) {
  return el(
    "div",
    "list-item",
    leading || null,
    el(
      "div",
      "li-main",
      el("div", `li-title${titleDone ? " done" : ""}`, title),
      meta.length ? el("div", "li-meta", meta) : null
    ),
    actions.length ? el("div", "li-actions", actions) : null
  );
}

// Round check toggle used for tasks / milestones / habits / exercises.
export function checkToggle(checked, onToggle) {
  const btn = el("button", { class: `check${checked ? " checked" : ""}`, "aria-label": "Toggle done", onclick: onToggle });
  btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  return btn;
}
