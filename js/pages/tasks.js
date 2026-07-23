import { el, clear, uid, todayStr, relDueLabel } from "../core/dom.js";
import { tasksStore } from "../core/stores.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, textArea, dateInput, select, formRow } from "../components/formField.js";
import { listItem, checkToggle, editButton, deleteButton } from "../components/listItem.js";
import { emptyState } from "../components/emptyState.js";

const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };
const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
];

let statusFilter = "all";
let priorityFilter = "all";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = tasksStore.subscribe(draw);
  draw();
  return unsubscribe;
}

function view() {
  const { items } = tasksStore.get();
  const open = items.filter((t) => t.status !== "done").length;

  const visible = items
    .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
    .filter((t) => (priorityFilter === "all" ? true : t.priority === priorityFilter))
    .sort(compareTasks);

  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el("div", null, el("h1", null, "Tasks"), el("div", "subtitle", `${open} open · ${items.length} total`)),
      el("button", { class: "btn btn-primary", onclick: () => openTaskForm() }, "+ New Task")
    ),
    el(
      "div",
      "filter-chips mb4",
      chip("All", statusFilter === "all", () => setFilters("all", priorityFilter)),
      STATUSES.map((s) => chip(s.label, statusFilter === s.value, () => setFilters(s.value, priorityFilter))),
      el("span", { style: { width: "12px" } }),
      chip("Any priority", priorityFilter === "all", () => setFilters(statusFilter, "all")),
      PRIORITIES.map((p) => chip(p.label, priorityFilter === p.value, () => setFilters(statusFilter, p.value)))
    ),
    visible.length
      ? el("div", "list", visible.map(taskRow))
      : emptyState("✓", "No tasks here", "Create a task or adjust the filters.")
  );
}

function chip(label, active, onclick) {
  return el("button", { class: `chip${active ? " active" : ""}`, onclick }, label);
}

function setFilters(status, priority) {
  statusFilter = status;
  priorityFilter = priority;
  tasksStore.set({}); // trigger re-render through the store
}

function compareTasks(a, b) {
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
}

function taskRow(task) {
  const done = task.status === "done";
  const due = relDueLabel(task.due);
  const meta = [];
  meta.push(priorityBadge(task.priority));
  if (task.status === "doing") meta.push(el("span", "badge badge-accent", "In progress"));
  if (due && !done) meta.push(el("span", `badge${due.tone ? " badge-" + due.tone : ""}`, due.text));
  for (const tag of task.tags || []) meta.push(el("span", "badge", "#" + tag));
  if (task.notes) meta.push(el("span", "faint", task.notes.length > 60 ? task.notes.slice(0, 60) + "…" : task.notes));

  return listItem({
    leading: checkToggle(done, () => toggleDone(task)),
    title: task.title,
    titleDone: done,
    meta,
    actions: [editButton(() => openTaskForm(task)), deleteButton(() => removeTask(task))],
  });
}

function priorityBadge(priority) {
  const tone = priority === "high" ? "danger" : priority === "medium" ? "warning" : "";
  return el("span", `badge${tone ? " badge-" + tone : ""}`, priority);
}

function toggleDone(task) {
  tasksStore.update((s) => ({
    ...s,
    items: s.items.map((t) =>
      t.id === task.id
        ? { ...t, status: t.status === "done" ? "todo" : "done", completedAt: t.status === "done" ? null : new Date().toISOString() }
        : t
    ),
  }));
}

async function removeTask(task) {
  if (!(await confirmDialog(`Delete "${task.title}"?`, { confirmLabel: "Delete" }))) return;
  tasksStore.update((s) => ({ ...s, items: s.items.filter((t) => t.id !== task.id) }));
}

function openTaskForm(existing) {
  const title = textInput({ value: existing?.title || "", placeholder: "What needs doing?" });
  const notes = textArea({ value: existing?.notes || "", placeholder: "Details (optional)" });
  const priority = select(PRIORITIES, { value: existing?.priority || "medium" });
  const due = dateInput({ value: existing?.due || "" });
  const status = select(STATUSES, { value: existing?.status || "todo" });
  const tags = textInput({ value: (existing?.tags || []).join(", "), placeholder: "e.g. batch, personal" });

  const saveBtn = el(
    "button",
    {
      class: "btn btn-primary",
      onclick: () => {
        if (!title.value.trim()) {
          title.focus();
          return;
        }
        save();
        close();
      },
    },
    existing ? "Save" : "Add Task"
  );

  const { close } = openModal({
    title: existing ? "Edit Task" : "New Task",
    content: el(
      "div",
      null,
      field("Title", title),
      field("Notes", notes),
      formRow(field("Priority", priority), field("Due date", due)),
      formRow(field("Status", status), field("Tags (comma-separated)", tags))
    ),
    footer: saveBtn,
  });

  function save() {
    const record = {
      id: existing?.id || uid(),
      title: title.value.trim(),
      notes: notes.value.trim(),
      priority: priority.value,
      due: due.value || null,
      tags: tags.value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      status: status.value,
      createdAt: existing?.createdAt || new Date().toISOString(),
      completedAt: status.value === "done" ? existing?.completedAt || new Date().toISOString() : null,
    };
    tasksStore.update((s) => ({
      ...s,
      items: existing ? s.items.map((t) => (t.id === existing.id ? record : t)) : [...s.items, record],
    }));
  }
}
