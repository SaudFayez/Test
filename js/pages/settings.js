import { el, clear } from "../core/dom.js";
import { settingsStore } from "../core/stores.js";
import { exportAll, importAll, clearAll } from "../core/storage.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, numberInput } from "../components/formField.js";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);
  clear(container);
  container.append(view());
  // No store subscription: inputs write to the store directly and hold their own state.
}

function view() {
  const settings = settingsStore.get();
  const status = el("p", "muted small mt3");

  const bind = (input, key, isNumber = false) => {
    input.addEventListener("change", () => {
      const value = isNumber ? Math.max(1, Number(input.value) || 1) : input.value.trim();
      settingsStore.set({ [key]: value });
      status.textContent = "Saved.";
      setTimeout(() => (status.textContent = ""), 1500);
    });
    return input;
  };

  const nameInput = bind(textInput({ value: settings.userName }), "userName");
  const workMin = bind(numberInput({ value: settings.pomodoroWorkMin, min: 1, max: 120 }), "pomodoroWorkMin", true);
  const breakMin = bind(numberInput({ value: settings.pomodoroBreakMin, min: 1, max: 60 }), "pomodoroBreakMin", true);
  const waterTarget = bind(numberInput({ value: settings.waterTargetGlasses, min: 1, max: 20 }), "waterTargetGlasses", true);
  const calorieTarget = bind(numberInput({ value: settings.calorieTarget, min: 500, max: 10000 }), "calorieTarget", true);

  // Import
  const fileInput = el("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const ok = await confirmDialog(
        "Importing will overwrite ALL current data with the backup's contents. Continue?",
        { title: "Import backup", confirmLabel: "Overwrite & Import" }
      );
      if (!ok) return;
      importAll(parsed);
      status.textContent = "Backup imported successfully.";
    } catch (err) {
      status.textContent = `Import failed: ${err.message}`;
    }
  });

  return el(
    "div",
    null,
    el("div", "page-header", el("div", null, el("h1", null, "Settings"), el("div", "subtitle", "Preferences and data backup"))),
    el(
      "div",
      "two-col",
      el(
        "div",
        "card",
        el("div", "card-title mb3", "Preferences"),
        field("Display name", nameInput),
        el("div", "form-row",
          field("Pomodoro focus (min)", workMin),
          field("Pomodoro break (min)", breakMin)),
        el("div", "form-row",
          field("Water target (glasses/day)", waterTarget),
          field("Calorie target (kcal/day)", calorieTarget)),
        status
      ),
      el(
        "div",
        "card",
        el("div", "card-title mb3", "Data"),
        el("p", "muted small mb4", "All your data lives in this browser's local storage. Export a backup regularly — and import it on another device to move your data."),
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" } },
          el("button", { class: "btn btn-primary", onclick: exportAll }, "⬇ Export backup (JSON)"),
          el("button", { class: "btn", onclick: () => fileInput.click() }, "⬆ Import backup"),
          el("button", { class: "btn btn-danger", onclick: async () => {
            const first = await confirmDialog("Delete ALL Life OS data from this browser?", { confirmLabel: "Continue" });
            if (!first) return;
            const second = await confirmDialog("This cannot be undone unless you have a backup. Really delete everything?", {
              title: "Final confirmation", confirmLabel: "Delete Everything",
            });
            if (second) {
              clearAll();
              status.textContent = "All data cleared.";
            }
          } }, "Clear all data"),
          fileInput
        )
      )
    )
  );
}
