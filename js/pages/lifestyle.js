import { el, clear, uid, todayStr, addDays, fmtDate, weekDates, DAY_NAMES } from "../core/dom.js";
import { lifestyleStore } from "../core/stores.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, textArea, dateInput, numberInput, select, formRow } from "../components/formField.js";
import { listItem, checkToggle, editButton, deleteButton } from "../components/listItem.js";
import { tabs } from "../components/tabs.js";
import { emptyState } from "../components/emptyState.js";

const EVENT_TYPES = [
  { value: "networking", label: "Networking" },
  { value: "conference", label: "Conference" },
  { value: "meetup", label: "Meetup" },
  { value: "dinner", label: "Business dinner" },
  { value: "social", label: "Social" },
];
const READING_TYPES = [
  { value: "book", label: "Book" },
  { value: "article", label: "Article" },
];
const READING_STATUSES = [
  { value: "to-read", label: "To read" },
  { value: "reading", label: "Reading" },
  { value: "done", label: "Done" },
];

let activeTab = "habits";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = lifestyleStore.subscribe(draw);
  draw();
  return unsubscribe;
}

function view() {
  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el("div", null, el("h1", null, "Lifestyle"), el("div", "subtitle", "Habits, events, and what you're reading"))
    ),
    tabs(
      [
        { id: "habits", label: "Habits", render: renderHabits },
        { id: "events", label: "Events", render: renderEvents },
        { id: "reading", label: "Reading List", render: renderReading },
      ],
      { active: activeTab, onChange: (id) => (activeTab = id) }
    )
  );
}

/* ---------------- Habits ---------------- */

export function isHabitDone(habitLog, dateStr, habitId) {
  return (habitLog[dateStr] || []).includes(habitId);
}

export function toggleHabit(dateStr, habitId) {
  lifestyleStore.update((s) => {
    const dayLog = s.habitLog[dateStr] || [];
    const next = dayLog.includes(habitId) ? dayLog.filter((id) => id !== habitId) : [...dayLog, habitId];
    return { ...s, habitLog: { ...s.habitLog, [dateStr]: next } };
  });
}

// Consecutive days checked, counting back from today (today itself may still be pending).
export function computeStreak(habitLog, habitId) {
  let streak = 0;
  let day = todayStr();
  if (!isHabitDone(habitLog, day, habitId)) day = addDays(day, -1);
  while (isHabitDone(habitLog, day, habitId)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

function renderHabits(panel) {
  const { habits, habitLog } = lifestyleStore.get();
  const week = weekDates();
  const today = todayStr();

  panel.append(
    el("div", "flex-between mb4", el("span", "muted", "This week"),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openHabitForm() }, "+ New Habit"))
  );

  if (!habits.length) {
    panel.append(emptyState("↻", "No habits yet", "Add daily habits like reading, prayer-time walks, or no-sugar days."));
    return;
  }

  const table = el(
    "table",
    "habit-matrix",
    el(
      "thead",
      null,
      el(
        "tr",
        null,
        el("th", { style: { textAlign: "left" } }, "Habit"),
        week.map((date, i) => el("th", { class: date === today ? "today" : "" }, `${DAY_NAMES[i]} ${date.slice(8)}`)),
        el("th", null, "Streak"),
        el("th", null, "")
      )
    ),
    el(
      "tbody",
      null,
      habits.map((habit) => {
        const weekCount = week.filter((d) => isHabitDone(habitLog, d, habit.id)).length;
        const hitTarget = weekCount >= habit.targetPerWeek;
        return el(
          "tr",
          null,
          el(
            "td",
            "habit-name",
            habit.name,
            el("div", `habit-streak${hitTarget ? " " : ""}`, `${weekCount}/${habit.targetPerWeek} this week${hitTarget ? " ✓" : ""}`)
          ),
          week.map((date) =>
            el(
              "td",
              { class: date === today ? "today" : "" },
              date > today
                ? el("span", "faint", "·")
                : checkToggle(isHabitDone(habitLog, date, habit.id), () => toggleHabit(date, habit.id))
            )
          ),
          el("td", "habit-streak", `${computeStreak(habitLog, habit.id)}🔥`),
          el("td", null, el("div", "li-actions", editButton(() => openHabitForm(habit)), deleteButton(() => removeHabit(habit))))
        );
      })
    )
  );

  panel.append(el("div", { style: { overflowX: "auto" } }, table));
}

function openHabitForm(existing) {
  const name = textInput({ value: existing?.name || "", placeholder: "e.g. Read 20 minutes" });
  const target = numberInput({ value: existing?.targetPerWeek ?? 7, min: 1, max: 7 });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!name.value.trim()) { name.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      name: name.value.trim(),
      targetPerWeek: Math.min(7, Math.max(1, Number(target.value) || 7)),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    lifestyleStore.update((s) => ({
      ...s,
      habits: existing ? s.habits.map((h) => (h.id === existing.id ? record : h)) : [...s.habits, record],
    }));
    close();
  } }, existing ? "Save" : "Add Habit");

  const { close } = openModal({
    title: existing ? "Edit Habit" : "New Habit",
    content: el("div", null, field("Habit", name), field("Target days per week", target)),
    footer: saveBtn,
  });
}

async function removeHabit(habit) {
  if (!(await confirmDialog(`Delete habit "${habit.name}" and its history?`, { confirmLabel: "Delete" }))) return;
  lifestyleStore.update((s) => {
    const habitLog = {};
    for (const [date, ids] of Object.entries(s.habitLog)) {
      const rest = ids.filter((id) => id !== habit.id);
      if (rest.length) habitLog[date] = rest;
    }
    return { ...s, habits: s.habits.filter((h) => h.id !== habit.id), habitLog };
  });
}

/* ---------------- Events ---------------- */

function renderEvents(panel) {
  const { events } = lifestyleStore.get();
  const today = todayStr();
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const past = events.filter((e) => e.date < today).sort((a, b) => (a.date > b.date ? -1 : 1));

  panel.append(
    el("div", "flex-between mb4", el("span", "muted", `${upcoming.length} upcoming`),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openEventForm() }, "+ New Event"))
  );

  if (!events.length) {
    panel.append(emptyState("★", "No events", "Track networking events, conferences, and business dinners."));
    return;
  }

  if (upcoming.length) {
    panel.append(el("div", "section-title", "Upcoming"), el("div", "list mb4", upcoming.map((e) => eventRow(e, false))));
  }
  if (past.length) {
    panel.append(el("div", "section-title", "Past"), el("div", "list", past.map((e) => eventRow(e, true))));
  }
}

function eventRow(event, isPast) {
  const typeLabel = EVENT_TYPES.find((t) => t.value === event.type)?.label || event.type;
  const meta = [
    el("span", `badge${event.date === todayStr() ? " badge-warning" : ""}`, fmtDate(event.date)),
    el("span", "badge", typeLabel),
  ];
  if (event.location) meta.push(el("span", "muted", event.location));
  if (event.prepNotes) meta.push(el("span", "faint", `Prep: ${event.prepNotes}`));
  if (isPast) meta.push(el("span", `badge${event.attended ? " badge-success" : ""}`, event.attended ? "Attended" : "Missed"));

  return listItem({
    leading: isPast
      ? checkToggle(event.attended, () =>
          lifestyleStore.update((s) => ({
            ...s,
            events: s.events.map((e) => (e.id === event.id ? { ...e, attended: !e.attended } : e)),
          }))
        )
      : null,
    title: event.title,
    meta,
    actions: [editButton(() => openEventForm(event)), deleteButton(() => removeEvent(event))],
  });
}

async function removeEvent(event) {
  if (!(await confirmDialog(`Delete event "${event.title}"?`, { confirmLabel: "Delete" }))) return;
  lifestyleStore.update((s) => ({ ...s, events: s.events.filter((e) => e.id !== event.id) }));
}

function openEventForm(existing) {
  const title = textInput({ value: existing?.title || "", placeholder: "Event name" });
  const date = dateInput({ value: existing?.date || todayStr() });
  const type = select(EVENT_TYPES, { value: existing?.type || "networking" });
  const location = textInput({ value: existing?.location || "" });
  const prepNotes = textArea({ value: existing?.prepNotes || "", placeholder: "Who to meet, what to bring…" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!title.value.trim() || !date.value) { title.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      title: title.value.trim(),
      date: date.value,
      type: type.value,
      location: location.value.trim(),
      prepNotes: prepNotes.value.trim(),
      attended: existing?.attended || false,
    };
    lifestyleStore.update((s) => ({
      ...s,
      events: existing ? s.events.map((e) => (e.id === existing.id ? record : e)) : [...s.events, record],
    }));
    close();
  } }, existing ? "Save" : "Add Event");

  const { close } = openModal({
    title: existing ? "Edit Event" : "New Event",
    content: el("div", null,
      field("Title", title),
      formRow(field("Date", date), field("Type", type)),
      field("Location", location),
      field("Prep notes", prepNotes)
    ),
    footer: saveBtn,
  });
}

/* ---------------- Reading list ---------------- */

function renderReading(panel) {
  const { reading } = lifestyleStore.get();
  const order = { reading: 0, "to-read": 1, done: 2 };
  const sorted = [...reading].sort((a, b) => order[a.status] - order[b.status]);

  panel.append(
    el("div", "flex-between mb4",
      el("span", "muted", `${reading.filter((r) => r.status !== "done").length} in queue`),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openReadingForm() }, "+ Add Item"))
  );

  if (!reading.length) {
    panel.append(emptyState("📖", "Reading list is empty", "Add books and articles that sharpen your business game."));
    return;
  }

  panel.append(el("div", "list", sorted.map(readingRow)));
}

function readingRow(item) {
  const statusSelect = select(READING_STATUSES, { value: item.status, style: { width: "auto", padding: "4px 8px", fontSize: "13px" } });
  statusSelect.addEventListener("change", () =>
    lifestyleStore.update((s) => ({
      ...s,
      reading: s.reading.map((r) => (r.id === item.id ? { ...r, status: statusSelect.value } : r)),
    }))
  );

  const meta = [el("span", "badge", READING_TYPES.find((t) => t.value === item.type)?.label || item.type)];
  if (item.author) meta.push(el("span", "muted", item.author));
  if (item.takeaways) meta.push(el("span", "faint", `Takeaway: ${item.takeaways}`));

  return listItem({
    title: item.title,
    titleDone: item.status === "done",
    meta,
    actions: [statusSelect, editButton(() => openReadingForm(item)), deleteButton(() => removeReading(item))],
  });
}

async function removeReading(item) {
  if (!(await confirmDialog(`Delete "${item.title}"?`, { confirmLabel: "Delete" }))) return;
  lifestyleStore.update((s) => ({ ...s, reading: s.reading.filter((r) => r.id !== item.id) }));
}

function openReadingForm(existing) {
  const title = textInput({ value: existing?.title || "", placeholder: "Title" });
  const author = textInput({ value: existing?.author || "" });
  const type = select(READING_TYPES, { value: existing?.type || "book" });
  const status = select(READING_STATUSES, { value: existing?.status || "to-read" });
  const takeaways = textArea({ value: existing?.takeaways || "", placeholder: "Key takeaways…" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!title.value.trim()) { title.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      title: title.value.trim(),
      author: author.value.trim(),
      type: type.value,
      status: status.value,
      takeaways: takeaways.value.trim(),
    };
    lifestyleStore.update((s) => ({
      ...s,
      reading: existing ? s.reading.map((r) => (r.id === existing.id ? record : r)) : [...s.reading, record],
    }));
    close();
  } }, existing ? "Save" : "Add");

  const { close } = openModal({
    title: existing ? "Edit Item" : "Add to Reading List",
    content: el("div", null,
      field("Title", title),
      field("Author", author),
      formRow(field("Type", type), field("Status", status)),
      field("Key takeaways", takeaways)
    ),
    footer: saveBtn,
  });
}
