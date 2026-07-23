import { el, clear, uid, todayStr, fmtDate } from "../core/dom.js";
import { businessStore } from "../core/stores.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, textArea, dateInput, numberInput, select, formRow } from "../components/formField.js";
import { listItem, editButton, deleteButton } from "../components/listItem.js";
import { progressBar } from "../components/progressRing.js";
import { tabs } from "../components/tabs.js";
import { emptyState } from "../components/emptyState.js";

const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "researching", label: "Researching" },
  { value: "validating", label: "Validating" },
  { value: "building", label: "Building" },
  { value: "shelved", label: "Shelved" },
];

let activeTab = "goals";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = businessStore.subscribe(draw);
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
      el("div", null, el("h1", null, "Business Development"), el("div", "subtitle", "Goals, network, and the ideas pipeline"))
    ),
    tabs(
      [
        { id: "goals", label: "Goals", render: renderGoals },
        { id: "contacts", label: "Contacts", render: renderContacts },
        { id: "ideas", label: "Ideas Pipeline", render: renderIdeas },
      ],
      { active: activeTab, onChange: (id) => (activeTab = id) }
    )
  );
}

/* ---------------- Goals ---------------- */

function renderGoals(panel) {
  const { goals } = businessStore.get();
  panel.append(
    el("div", "flex-between mb4", el("span", "muted", `${goals.length} goal${goals.length === 1 ? "" : "s"}`),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openGoalForm() }, "+ New Goal")),
    goals.length
      ? el("div", "list", goals.map(goalRow))
      : emptyState("◎", "No business goals yet", "Set a measurable goal for the quarter or year.")
  );
}

function goalRow(goal) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  return el(
    "div",
    "card mb2",
    el(
      "div",
      "flex-between mb2",
      el("div", null, el("div", "card-title", goal.title), el("div", "card-sub", `${goal.period}${goal.notes ? " · " + goal.notes : ""}`)),
      el("div", "li-actions", editButton(() => openGoalForm(goal)), deleteButton(() => removeItem("goals", goal.id, goal.title)))
    ),
    el(
      "div",
      "flex",
      el("div", { style: { flex: 1 } }, progressBar(pct, "var(--c-business)")),
      el("span", "small muted", `${goal.current} / ${goal.target} ${goal.metric} (${pct}%)`)
    )
  );
}

function openGoalForm(existing) {
  const title = textInput({ value: existing?.title || "", placeholder: "e.g. Sign wholesale accounts" });
  const period = textInput({ value: existing?.period || defaultPeriod(), placeholder: "e.g. Q3-2026 or 2026" });
  const metric = textInput({ value: existing?.metric || "", placeholder: "e.g. accounts, SAR revenue" });
  const target = numberInput({ value: existing?.target ?? "", min: 1, placeholder: "10" });
  const current = numberInput({ value: existing?.current ?? 0, min: 0 });
  const notes = textInput({ value: existing?.notes || "", placeholder: "Optional context" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!title.value.trim() || !Number(target.value)) { title.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      title: title.value.trim(),
      period: period.value.trim(),
      metric: metric.value.trim() || "units",
      target: Number(target.value),
      current: Number(current.value) || 0,
      notes: notes.value.trim(),
    };
    upsert("goals", record, existing);
    close();
  } }, existing ? "Save" : "Add Goal");

  const { close } = openModal({
    title: existing ? "Edit Goal" : "New Goal",
    content: el("div", null,
      field("Goal", title),
      formRow(field("Period", period), field("Metric", metric)),
      formRow(field("Target", target), field("Current progress", current)),
      field("Notes", notes)
    ),
    footer: saveBtn,
  });
}

function defaultPeriod() {
  const now = new Date();
  return `Q${Math.floor(now.getMonth() / 3) + 1}-${now.getFullYear()}`;
}

/* ---------------- Contacts ---------------- */

function renderContacts(panel) {
  const { contacts } = businessStore.get();
  const today = todayStr();
  const sorted = [...contacts].sort((a, b) => {
    const fa = a.followUpDate || "9999";
    const fb = b.followUpDate || "9999";
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });

  panel.append(
    el("div", "flex-between mb4", el("span", "muted", `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openContactForm() }, "+ New Contact")),
    sorted.length
      ? el("div", "list", sorted.map((c) => contactRow(c, today)))
      : emptyState("☎", "No contacts yet", "Log people you meet — and never miss a follow-up.")
  );
}

export function followUpsDue(contacts) {
  const today = todayStr();
  return contacts.filter((c) => c.followUpDate && c.followUpDate <= today);
}

function contactRow(contact, today) {
  const meta = [];
  if (contact.company || contact.role) meta.push(el("span", "muted", [contact.role, contact.company].filter(Boolean).join(" @ ")));
  if (contact.metAt) meta.push(el("span", "badge", `Met: ${contact.metAt}`));
  if (contact.lastContact) meta.push(el("span", "badge", `Last contact ${fmtDate(contact.lastContact)}`));
  if (contact.followUpDate) {
    const overdue = contact.followUpDate <= today;
    meta.push(el("span", `badge${overdue ? " badge-danger" : " badge-accent"}`, `Follow up ${fmtDate(contact.followUpDate)}`));
  }
  if (contact.notes) meta.push(el("span", "faint", contact.notes));

  return listItem({
    title: contact.name,
    meta,
    actions: [
      contact.followUpDate && contact.followUpDate <= today
        ? el("button", { class: "btn btn-sm", title: "Mark followed up today", onclick: () => markFollowedUp(contact) }, "Done ✓")
        : null,
      editButton(() => openContactForm(contact)),
      deleteButton(() => removeItem("contacts", contact.id, contact.name)),
    ].filter(Boolean),
  });
}

function markFollowedUp(contact) {
  businessStore.update((s) => ({
    ...s,
    contacts: s.contacts.map((c) => (c.id === contact.id ? { ...c, lastContact: todayStr(), followUpDate: null } : c)),
  }));
}

function openContactForm(existing) {
  const name = textInput({ value: existing?.name || "", placeholder: "Full name" });
  const company = textInput({ value: existing?.company || "" });
  const role = textInput({ value: existing?.role || "" });
  const metAt = textInput({ value: existing?.metAt || "", placeholder: "e.g. Coffee expo Riyadh" });
  const lastContact = dateInput({ value: existing?.lastContact || "" });
  const followUpDate = dateInput({ value: existing?.followUpDate || "" });
  const notes = textArea({ value: existing?.notes || "", placeholder: "Context, interests, next steps…" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!name.value.trim()) { name.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      name: name.value.trim(),
      company: company.value.trim(),
      role: role.value.trim(),
      metAt: metAt.value.trim(),
      lastContact: lastContact.value || null,
      followUpDate: followUpDate.value || null,
      notes: notes.value.trim(),
    };
    upsert("contacts", record, existing);
    close();
  } }, existing ? "Save" : "Add Contact");

  const { close } = openModal({
    title: existing ? "Edit Contact" : "New Contact",
    content: el("div", null,
      field("Name", name),
      formRow(field("Company", company), field("Role", role)),
      field("Where you met", metAt),
      formRow(field("Last contact", lastContact), field("Follow up on", followUpDate)),
      field("Notes", notes)
    ),
    footer: saveBtn,
  });
}

/* ---------------- Ideas pipeline ---------------- */

function renderIdeas(panel) {
  const { ideas } = businessStore.get();
  panel.append(
    el("div", "flex-between mb4", el("span", "muted", "Move ideas through the pipeline with ‹ ›"),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openIdeaForm() }, "+ New Idea")),
    ideas.length
      ? el("div", "kanban", STAGES.map((stage) => kanbanColumn(stage, ideas.filter((i) => i.stage === stage.value))))
      : emptyState("💡", "No ideas yet", "Capture business ideas and move them from Idea to Building.")
  );
}

function kanbanColumn(stage, ideas) {
  return el(
    "div",
    "kanban-col",
    el("h3", null, stage.label, el("span", null, String(ideas.length))),
    ideas.map((idea) => kanbanCard(idea))
  );
}

function kanbanCard(idea) {
  const stageIdx = STAGES.findIndex((s) => s.value === idea.stage);
  const move = (delta) => {
    const next = STAGES[stageIdx + delta];
    if (!next) return;
    businessStore.update((s) => ({
      ...s,
      ideas: s.ideas.map((i) => (i.id === idea.id ? { ...i, stage: next.value } : i)),
    }));
  };
  return el(
    "div",
    "kanban-card",
    el("div", { style: { fontWeight: 600 } }, idea.title),
    idea.notes ? el("div", "faint small", idea.notes) : null,
    el(
      "div",
      "kc-actions",
      el("button", { class: "btn btn-ghost btn-sm", disabled: stageIdx === 0, onclick: () => move(-1), title: "Move back" }, "‹"),
      el("div", "flex", editButton(() => openIdeaForm(idea)), deleteButton(() => removeItem("ideas", idea.id, idea.title))),
      el("button", { class: "btn btn-ghost btn-sm", disabled: stageIdx === STAGES.length - 1, onclick: () => move(1), title: "Move forward" }, "›")
    )
  );
}

function openIdeaForm(existing) {
  const title = textInput({ value: existing?.title || "", placeholder: "The idea in one line" });
  const notes = textArea({ value: existing?.notes || "", placeholder: "Why it could work, next validation step…" });
  const stage = select(STAGES, { value: existing?.stage || "idea" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!title.value.trim()) { title.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      title: title.value.trim(),
      notes: notes.value.trim(),
      stage: stage.value,
    };
    upsert("ideas", record, existing);
    close();
  } }, existing ? "Save" : "Add Idea");

  const { close } = openModal({
    title: existing ? "Edit Idea" : "New Idea",
    content: el("div", null, field("Idea", title), field("Notes", notes), field("Stage", stage)),
    footer: saveBtn,
  });
}

/* ---------------- Shared helpers ---------------- */

function upsert(collection, record, existing) {
  businessStore.update((s) => ({
    ...s,
    [collection]: existing
      ? s[collection].map((item) => (item.id === existing.id ? record : item))
      : [...s[collection], record],
  }));
}

async function removeItem(collection, id, label) {
  if (!(await confirmDialog(`Delete "${label}"?`, { confirmLabel: "Delete" }))) return;
  businessStore.update((s) => ({ ...s, [collection]: s[collection].filter((item) => item.id !== id) }));
}
