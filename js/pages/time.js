import { el, clear, uid, todayStr, dayIndex, fmtMins, DAY_NAMES } from "../core/dom.js";
import { timeStore } from "../core/stores.js";
import { getPomodoro, subscribePomodoro, startPomodoro, pausePomodoro, resetPomodoro, sessionsToday } from "../core/pomodoro.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, timeInput, select, formRow } from "../components/formField.js";
import { emptyState } from "../components/emptyState.js";

export const BLOCK_CATEGORIES = [
  { value: "work", label: "Work", color: "#4f8cff" },
  { value: "business", label: "Business", color: "#3ecf8e" },
  { value: "health", label: "Health", color: "#ef5b6e" },
  { value: "social", label: "Social", color: "#ff8bd1" },
  { value: "personal", label: "Personal", color: "#f5b544" },
];

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_PX = 44;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

export function categoryColor(category) {
  return BLOCK_CATEGORIES.find((c) => c.value === category)?.color || "#4f8cff";
}

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubStore = timeStore.subscribe(draw);
  draw();
  return unsubStore;
}

function view() {
  const { blocks } = timeStore.get();
  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el("div", null, el("h1", null, "Time"), el("div", "subtitle", "Weekly schedule and focus sessions")),
      el("button", { class: "btn btn-primary", onclick: () => openBlockForm() }, "+ Time Block")
    ),
    el("div", "two-col mb4", pomodoroCard(), legendCard()),
    el("div", "section-title", "Weekly Schedule"),
    blocks.length
      ? el("div", "schedule-wrap", scheduleGrid(blocks))
      : emptyState("▦", "No time blocks yet", "Block out deep work, gym time, and business hours for the week.")
  );
}

/* ---------------- Pomodoro ---------------- */

function pomodoroCard() {
  const timeEl = el("div", "pomo-time");
  const phaseEl = el("div", "pomo-phase");
  const sessionsEl = el("div", "muted small");
  const startPause = el("button", { class: "btn btn-primary" });

  const update = () => {
    const p = getPomodoro();
    timeEl.textContent = fmtMins(p.remaining);
    phaseEl.textContent = p.phase === "work" ? "Focus" : "Break";
    phaseEl.style.color = p.phase === "work" ? "var(--c-time)" : "var(--success)";
    sessionsEl.textContent = `${sessionsToday()} focus session${sessionsToday() === 1 ? "" : "s"} today`;
    startPause.textContent = p.running ? "Pause" : "Start";
  };

  startPause.addEventListener("click", () => {
    getPomodoro().running ? pausePomodoro() : startPomodoro();
  });

  const card = el(
    "div",
    "card pomodoro-card",
    phaseEl,
    timeEl,
    el("div", "pomo-controls", startPause, el("button", { class: "btn", onclick: resetPomodoro }, "Reset")),
    sessionsEl
  );

  // Widget updates in place on each tick; unsubscribes when removed from DOM.
  const unsub = subscribePomodoro(update);
  const observer = new MutationObserver(() => {
    if (!document.body.contains(card)) {
      unsub();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  update();
  return card;
}

function legendCard() {
  return el(
    "div",
    "card",
    el("div", "card-title mb2", "Categories"),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      BLOCK_CATEGORIES.map((c) =>
        el(
          "div",
          "flex",
          el("span", { style: { width: "12px", height: "12px", borderRadius: "3px", background: c.color, display: "inline-block" } }),
          el("span", "small", c.label)
        )
      )
    ),
    el("p", "faint small mt3", "Click any block in the grid to edit or delete it.")
  );
}

/* ---------------- Schedule grid ---------------- */

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function scheduleGrid(blocks) {
  const todayIdx = dayIndex(todayStr());

  const timesCol = el("div", { class: "sch-times", style: { height: GRID_HEIGHT + "px" } });
  for (let h = START_HOUR + 1; h < END_HOUR; h++) {
    timesCol.append(
      el("span", { class: "sch-hour", style: { top: (h - START_HOUR) * HOUR_PX + "px" } }, `${String(h).padStart(2, "0")}:00`)
    );
  }

  const dayCols = DAY_NAMES.map((_, dayIdx) => {
    const col = el("div", { class: "sch-day", style: { height: GRID_HEIGHT + "px" } });
    for (let h = START_HOUR + 1; h < END_HOUR; h++) {
      col.append(el("div", { class: "hour-line", style: { top: (h - START_HOUR) * HOUR_PX + "px" } }));
    }
    for (const block of blocks.filter((b) => b.day === dayIdx)) {
      const startMin = Math.max(toMinutes(block.start), START_HOUR * 60);
      const endMin = Math.min(toMinutes(block.end), END_HOUR * 60);
      if (endMin <= startMin) continue;
      const color = categoryColor(block.category);
      col.append(
        el(
          "div",
          {
            class: "sch-block",
            style: {
              top: ((startMin - START_HOUR * 60) / 60) * HOUR_PX + "px",
              height: Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 2) + "px",
              background: color + "26",
              borderLeftColor: color,
            },
            title: `${block.label} (${block.start}–${block.end})`,
            onclick: () => openBlockForm(block),
          },
          el("div", null, block.label),
          el("div", "sch-time", `${block.start}–${block.end}`)
        )
      );
    }
    return col;
  });

  return el(
    "div",
    "schedule",
    el("div", "sch-head", ""),
    DAY_NAMES.map((name, i) => el("div", { class: `sch-head${i === todayIdx ? " today" : ""}` }, name)),
    timesCol,
    dayCols
  );
}

/* ---------------- Block form ---------------- */

function openBlockForm(existing) {
  const label = textInput({ value: existing?.label || "", placeholder: "e.g. Deep work, Gym, Café floor" });
  const day = select(DAY_NAMES.map((name, i) => ({ value: String(i), label: name })), { value: String(existing?.day ?? dayIndex(todayStr())) });
  const start = timeInput({ value: existing?.start || "09:00" });
  const end = timeInput({ value: existing?.end || "10:00" });
  const category = select(BLOCK_CATEGORIES, { value: existing?.category || "work" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!label.value.trim() || !start.value || !end.value) { label.focus(); return; }
    if (toMinutes(end.value) <= toMinutes(start.value)) { end.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      day: Number(day.value),
      start: start.value,
      end: end.value,
      label: label.value.trim(),
      category: category.value,
    };
    timeStore.update((s) => ({
      ...s,
      blocks: existing ? s.blocks.map((b) => (b.id === existing.id ? record : b)) : [...s.blocks, record],
    }));
    close();
  } }, existing ? "Save" : "Add Block");

  const footer = [saveBtn];
  if (existing) {
    footer.unshift(
      el("button", { class: "btn btn-danger", onclick: async () => {
        if (await confirmDialog(`Delete "${existing.label}"?`, { confirmLabel: "Delete" })) {
          timeStore.update((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== existing.id) }));
          close();
        }
      } }, "Delete")
    );
  }

  const { close } = openModal({
    title: existing ? "Edit Time Block" : "New Time Block",
    content: el(
      "div",
      null,
      field("Label", label),
      formRow(field("Day", day), field("Category", category)),
      formRow(field("Start", start), field("End", end))
    ),
    footer,
  });
}
