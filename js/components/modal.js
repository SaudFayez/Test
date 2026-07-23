import { el } from "../core/dom.js";

// Single-overlay modal. Returns { close, body }. Closes on Esc / backdrop click.
export function openModal({ title, content, footer, onClose }) {
  const body = el("div", "modal-body");
  if (content) body.append(content);

  const closeBtn = el("button", { class: "btn btn-ghost btn-icon", "aria-label": "Close" });
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const modal = el(
    "div",
    { class: "modal", role: "dialog", "aria-modal": "true" },
    el("div", "modal-header", el("h2", null, title), closeBtn),
    body,
    footer ? el("div", "modal-footer", footer) : null
  );

  const overlay = el("div", "modal-overlay", modal);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    if (onClose) onClose();
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);

  const firstInput = body.querySelector("input, select, textarea");
  if (firstInput) firstInput.focus();

  return { close, body };
}
