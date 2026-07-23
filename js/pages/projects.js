import { el, clear, uid, fmtDate } from "../core/dom.js";
import { projectsStore } from "../core/stores.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, textArea, dateInput, select, formRow } from "../components/formField.js";
import { checkToggle, deleteButton } from "../components/listItem.js";
import { progressRing } from "../components/progressRing.js";
import { emptyState } from "../components/emptyState.js";

const STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On hold" },
  { value: "done", label: "Done" },
];
const CATEGORIES = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
];
const STATUS_TONE = { active: "success", "on-hold": "warning", done: "accent", idea: "" };

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = projectsStore.subscribe(draw);
  draw();
  return unsubscribe;
}

export function projectProgress(project) {
  const total = project.milestones.length;
  if (!total) return project.status === "done" ? 100 : 0;
  return Math.round((project.milestones.filter((m) => m.done).length / total) * 100);
}

function view() {
  const { items } = projectsStore.get();
  const active = items.filter((p) => p.status === "active").length;
  const sorted = [...items].sort((a, b) => {
    const order = { active: 0, idea: 1, "on-hold": 2, done: 3 };
    return order[a.status] - order[b.status];
  });

  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el("div", null, el("h1", null, "Projects"), el("div", "subtitle", `${active} active · ${items.length} total`)),
      el("button", { class: "btn btn-primary", onclick: () => openProjectForm() }, "+ New Project")
    ),
    sorted.length
      ? el("div", "card-grid", sorted.map(projectCard))
      : emptyState("▣", "No projects yet", "Create your first project and break it into milestones.")
  );
}

function projectCard(project) {
  const done = project.milestones.filter((m) => m.done).length;
  return el(
    "div",
    { class: "card clickable", onclick: () => openProjectDetail(project.id) },
    el(
      "div",
      "flex-between mb3",
      el(
        "div",
        null,
        el("div", "card-title", project.name),
        el(
          "div",
          "flex mb2",
          el("span", `badge${STATUS_TONE[project.status] ? " badge-" + STATUS_TONE[project.status] : ""}`, statusLabel(project.status)),
          el("span", "badge", categoryLabel(project.category))
        )
      ),
      progressRing(projectProgress(project), { size: 56, stroke: 5, color: "var(--c-projects)" })
    ),
    project.description ? el("div", "card-sub mb2", truncate(project.description, 90)) : null,
    el(
      "div",
      "li-meta",
      el("span", "muted small", `${done}/${project.milestones.length} milestones`),
      project.targetDate ? el("span", "muted small", `Target ${fmtDate(project.targetDate)}`) : null
    )
  );
}

const statusLabel = (v) => STATUSES.find((s) => s.value === v)?.label || v;
const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;
const truncate = (str, n) => (str.length > n ? str.slice(0, n) + "…" : str);

function openProjectDetail(projectId) {
  const body = el("div");
  let modalRef;

  const redraw = () => {
    const project = projectsStore.get().items.find((p) => p.id === projectId);
    if (!project) {
      modalRef?.close();
      return;
    }
    clear(body);

    const milestoneInput = textInput({ placeholder: "Add a milestone…" });
    const addMilestone = () => {
      const title = milestoneInput.value.trim();
      if (!title) return;
      updateProject(projectId, (p) => ({
        ...p,
        milestones: [...p.milestones, { id: uid(), title, due: null, done: false }],
      }));
    };
    milestoneInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addMilestone();
    });

    body.append(
      el(
        "div",
        "flex-between mb3",
        el(
          "div",
          "flex",
          el("span", `badge${STATUS_TONE[project.status] ? " badge-" + STATUS_TONE[project.status] : ""}`, statusLabel(project.status)),
          el("span", "badge", categoryLabel(project.category)),
          project.targetDate ? el("span", "badge", `Target ${fmtDate(project.targetDate)}`) : null
        ),
        progressRing(projectProgress(project), { size: 48, stroke: 5, color: "var(--c-projects)" })
      ),
      project.description ? el("p", "muted small mb4", project.description) : null,
      el("div", "section-title", "Milestones"),
      project.milestones.length
        ? el(
            "div",
            "list mb3",
            project.milestones.map((m) =>
              el(
                "div",
                "list-item",
                checkToggle(m.done, () =>
                  updateProject(projectId, (p) => ({
                    ...p,
                    milestones: p.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)),
                  }))
                ),
                el("div", "li-main", el("div", `li-title${m.done ? " done" : ""}`, m.title)),
                deleteButton(() =>
                  updateProject(projectId, (p) => ({ ...p, milestones: p.milestones.filter((x) => x.id !== m.id) }))
                )
              )
            )
          )
        : el("p", "faint small mb3", "No milestones yet — add the steps that make this project real."),
      el("div", "flex", milestoneInput, el("button", { class: "btn", onclick: addMilestone }, "Add"))
    );
  };

  const project = projectsStore.get().items.find((p) => p.id === projectId);
  if (!project) return;

  const unsubscribe = projectsStore.subscribe(redraw);
  modalRef = openModal({
    title: project.name,
    content: body,
    footer: [
      el("button", { class: "btn btn-danger", onclick: async () => {
        if (await confirmDialog(`Delete project "${project.name}" and its milestones?`, { confirmLabel: "Delete" })) {
          projectsStore.update((s) => ({ ...s, items: s.items.filter((p) => p.id !== projectId) }));
        }
      } }, "Delete"),
      el("button", { class: "btn", onclick: () => { modalRef.close(); openProjectForm(projectsStore.get().items.find((p) => p.id === projectId)); } }, "Edit"),
    ],
    onClose: unsubscribe,
  });
  redraw();
}

function updateProject(projectId, fn) {
  projectsStore.update((s) => ({ ...s, items: s.items.map((p) => (p.id === projectId ? fn(p) : p)) }));
}

function openProjectForm(existing) {
  const name = textInput({ value: existing?.name || "", placeholder: "Project name" });
  const description = textArea({ value: existing?.description || "", placeholder: "What is this project about?" });
  const status = select(STATUSES, { value: existing?.status || "active" });
  const category = select(CATEGORIES, { value: existing?.category || "business" });
  const targetDate = dateInput({ value: existing?.targetDate || "" });

  const saveBtn = el(
    "button",
    {
      class: "btn btn-primary",
      onclick: () => {
        if (!name.value.trim()) {
          name.focus();
          return;
        }
        const record = {
          id: existing?.id || uid(),
          name: name.value.trim(),
          description: description.value.trim(),
          status: status.value,
          category: category.value,
          targetDate: targetDate.value || null,
          milestones: existing?.milestones || [],
        };
        projectsStore.update((s) => ({
          ...s,
          items: existing ? s.items.map((p) => (p.id === existing.id ? record : p)) : [...s.items, record],
        }));
        close();
      },
    },
    existing ? "Save" : "Create Project"
  );

  const { close } = openModal({
    title: existing ? "Edit Project" : "New Project",
    content: el(
      "div",
      null,
      field("Name", name),
      field("Description", description),
      formRow(field("Status", status), field("Category", category)),
      field("Target date", targetDate)
    ),
    footer: saveBtn,
  });
}
