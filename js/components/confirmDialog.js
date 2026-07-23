import { el } from "../core/dom.js";
import { openModal } from "./modal.js";

// Promise<boolean> confirm dialog.
export function confirmDialog(message, { title = "Are you sure?", confirmLabel = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value, close) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      if (close) close();
    };

    const cancelBtn = el("button", { class: "btn", onclick: () => settle(false, close) }, "Cancel");
    const okBtn = el(
      "button",
      { class: danger ? "btn btn-danger" : "btn btn-primary", onclick: () => settle(true, close) },
      confirmLabel
    );

    const { close } = openModal({
      title,
      content: el("p", "muted", message),
      footer: [cancelBtn, okBtn],
      onClose: () => settle(false),
    });
  });
}
