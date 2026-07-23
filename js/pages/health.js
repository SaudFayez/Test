import { el, clear, uid, todayStr, addDays, fmtDate, dayIndex, DAY_KEYS, DAY_NAMES } from "../core/dom.js";
import { healthStore, settingsStore } from "../core/stores.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { field, textInput, numberInput, select, formRow, textArea } from "../components/formField.js";
import { listItem, checkToggle, editButton, deleteButton } from "../components/listItem.js";
import { progressRing } from "../components/progressRing.js";
import { tabs } from "../components/tabs.js";
import { emptyState } from "../components/emptyState.js";

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

let activeTab = "nutrition";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };
  const unsubscribe = healthStore.subscribe(draw);
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
      el("div", null, el("h1", null, "Health"), el("div", "subtitle", "Fuel and training — stay consistent"))
    ),
    tabs(
      [
        { id: "nutrition", label: "Nutrition", render: renderNutrition },
        { id: "workouts", label: "Workouts", render: renderWorkouts },
      ],
      { active: activeTab, onChange: (id) => (activeTab = id) }
    )
  );
}

/* ================= Nutrition ================= */

export function waterFor(date) {
  return healthStore.get().water[date] || 0;
}

export function addWater(delta) {
  const today = todayStr();
  healthStore.update((s) => ({
    ...s,
    water: { ...s.water, [today]: Math.max(0, (s.water[today] || 0) + delta) },
  }));
}

export function mealsFor(date) {
  return healthStore.get().meals.filter((m) => m.date === date);
}

function renderNutrition(panel) {
  const today = todayStr();
  const settings = settingsStore.get();
  const glasses = waterFor(today);
  const todayMeals = mealsFor(today).sort(
    (a, b) => MEAL_TYPES.findIndex((t) => t.value === a.type) - MEAL_TYPES.findIndex((t) => t.value === b.type)
  );
  const calories = todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const protein = todayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

  panel.append(
    el(
      "div",
      "two-col mb4",
      // Water card
      el(
        "div",
        "card",
        el("div", "flex-between mb3", el("div", "card-title", "Water"), el("span", "muted small", `${glasses}/${settings.waterTargetGlasses} glasses`)),
        el(
          "div",
          "water-row",
          progressRing(Math.round((glasses / settings.waterTargetGlasses) * 100), {
            size: 72, color: "var(--accent)", label: String(glasses), sub: "glasses",
          }),
          el(
            "div",
            null,
            el(
              "div",
              "water-glasses mb3",
              Array.from({ length: settings.waterTargetGlasses }, (_, i) =>
                el("div", `water-glass${i < glasses ? " full" : ""}`)
              )
            ),
            el(
              "div",
              "flex",
              el("button", { class: "btn btn-primary btn-sm", onclick: () => addWater(1) }, "+ Glass"),
              el("button", { class: "btn btn-sm", onclick: () => addWater(-1), disabled: glasses === 0 }, "−")
            )
          )
        )
      ),
      // Calories card
      el(
        "div",
        "card",
        el("div", "flex-between mb3", el("div", "card-title", "Today's intake"), el("span", "muted small", `Target ${settings.calorieTarget} kcal`)),
        el(
          "div",
          "water-row",
          progressRing(Math.round((calories / settings.calorieTarget) * 100), {
            size: 72, color: "var(--c-health)", label: String(calories), sub: "kcal",
          }),
          el(
            "div",
            null,
            el("div", "stat-value", `${protein}g`),
            el("div", "stat-label", "Protein"),
            el("div", "muted small mt3", `${todayMeals.length} meal${todayMeals.length === 1 ? "" : "s"} logged`)
          )
        )
      )
    ),
    el("div", "section-title", el("span", null, "Today's meals"),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openMealForm() }, "+ Log Meal")),
    todayMeals.length
      ? el("div", "list mb4", todayMeals.map(mealRow))
      : el("div", "mb4", emptyState("🍽", "Nothing logged today", "Log meals to keep calories and protein on target."))
  );

  // 7-day history
  const historyRows = [];
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, -i);
    const meals = mealsFor(date);
    const water = waterFor(date);
    if (!meals.length && !water) continue;
    historyRows.push(
      listItem({
        title: fmtDate(date),
        meta: [
          el("span", "badge", `${meals.reduce((s, m) => s + (m.calories || 0), 0)} kcal`),
          el("span", "badge", `${meals.reduce((s, m) => s + (m.protein || 0), 0)}g protein`),
          el("span", "badge", `${water} 💧`),
          el("span", "muted", `${meals.length} meal${meals.length === 1 ? "" : "s"}`),
        ],
      })
    );
  }
  if (historyRows.length) {
    panel.append(el("div", "section-title", "Last 7 days"), el("div", "list", historyRows));
  }
}

function mealRow(meal) {
  const typeLabel = MEAL_TYPES.find((t) => t.value === meal.type)?.label || meal.type;
  return listItem({
    title: meal.description,
    meta: [
      el("span", "badge badge-accent", typeLabel),
      meal.calories ? el("span", "badge", `${meal.calories} kcal`) : null,
      meal.protein ? el("span", "badge", `${meal.protein}g protein`) : null,
    ].filter(Boolean),
    actions: [editButton(() => openMealForm(meal)), deleteButton(() => removeMeal(meal))],
  });
}

async function removeMeal(meal) {
  if (!(await confirmDialog(`Delete "${meal.description}"?`, { confirmLabel: "Delete" }))) return;
  healthStore.update((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== meal.id) }));
}

function openMealForm(existing) {
  const type = select(MEAL_TYPES, { value: existing?.type || guessMealType() });
  const description = textInput({ value: existing?.description || "", placeholder: "e.g. Grilled chicken + rice" });
  const calories = numberInput({ value: existing?.calories ?? "", min: 0, placeholder: "kcal" });
  const protein = numberInput({ value: existing?.protein ?? "", min: 0, placeholder: "g" });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!description.value.trim()) { description.focus(); return; }
    const record = {
      id: existing?.id || uid(),
      date: existing?.date || todayStr(),
      type: type.value,
      description: description.value.trim(),
      calories: Number(calories.value) || 0,
      protein: Number(protein.value) || 0,
    };
    healthStore.update((s) => ({
      ...s,
      meals: existing ? s.meals.map((m) => (m.id === existing.id ? record : m)) : [...s.meals, record],
    }));
    close();
  } }, existing ? "Save" : "Log Meal");

  const { close } = openModal({
    title: existing ? "Edit Meal" : "Log Meal",
    content: el("div", null,
      field("Meal", type),
      field("What did you eat?", description),
      formRow(field("Calories (est.)", calories), field("Protein (g)", protein))
    ),
    footer: saveBtn,
  });
}

function guessMealType() {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

/* ================= Workouts ================= */

export function routineForDay(dateStr) {
  const { routines, weeklySplit } = healthStore.get();
  const key = DAY_KEYS[dayIndex(dateStr)];
  const routineId = weeklySplit[key];
  return routines.find((r) => r.id === routineId) || null;
}

export function workoutEntryFor(dateStr) {
  return healthStore.get().workoutLog.find((w) => w.date === dateStr) || null;
}

function renderWorkouts(panel) {
  const { routines, weeklySplit, workoutLog } = healthStore.get();
  const today = todayStr();

  // --- Today's workout ---
  const routine = routineForDay(today);
  const entry = workoutEntryFor(today);
  const todayCard = el("div", "card mb4");
  todayCard.append(el("div", "flex-between mb3",
    el("div", "card-title", `Today · ${DAY_NAMES[dayIndex(today)]}`),
    routine && entry && entry.completedExercises.length === routine.exercises.length && routine.exercises.length > 0
      ? el("span", "badge badge-success", "Workout complete 💪")
      : null));

  if (!routine) {
    todayCard.append(el("p", "muted", routines.length ? "Rest day — recovery is part of the program." : "Create a routine below, then assign it in the weekly split."));
  } else {
    const completed = entry?.completedExercises || [];
    todayCard.append(
      el("div", "card-sub mb3", `${routine.name} · ${completed.length}/${routine.exercises.length} exercises done`),
      el(
        "div",
        "list",
        routine.exercises.map((exercise) =>
          el(
            "div",
            "list-item",
            checkToggle(completed.includes(exercise.id), () => toggleExercise(today, routine.id, exercise.id)),
            el(
              "div",
              "li-main",
              el("div", `li-title${completed.includes(exercise.id) ? " done" : ""}`, exercise.name),
              el("div", "li-meta", el("span", "muted", `${exercise.sets} × ${exercise.reps}${exercise.weight ? ` @ ${exercise.weight}kg` : ""}`))
            )
          )
        )
      )
    );
  }
  panel.append(todayCard);

  // --- Weekly split ---
  const routineOptions = [{ value: "", label: "Rest" }, ...routines.map((r) => ({ value: r.id, label: r.name }))];
  panel.append(
    el("div", "section-title", "Weekly split"),
    el(
      "div",
      { class: "card mb4", style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" } },
      DAY_KEYS.map((key, i) => {
        const daySelect = select(routineOptions, { value: weeklySplit[key] || "" });
        daySelect.addEventListener("change", () =>
          healthStore.update((s) => ({
            ...s,
            weeklySplit: { ...s.weeklySplit, [key]: daySelect.value || null },
          }))
        );
        return el("div", "field", el("label", null, DAY_NAMES[i]), daySelect);
      })
    )
  );

  // --- Routines ---
  panel.append(
    el("div", "section-title", el("span", null, "Routines"),
      el("button", { class: "btn btn-primary btn-sm", onclick: () => openRoutineForm() }, "+ New Routine"))
  );
  panel.append(
    routines.length
      ? el("div", "card-grid mb4", routines.map(routineCard))
      : el("div", "mb4", emptyState("🏋", "No routines yet", "Build routines like Push / Pull / Legs, then assign them to days."))
  );

  // --- History ---
  const history = [...workoutLog].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 14);
  if (history.length) {
    panel.append(
      el("div", "section-title", "Recent workouts"),
      el(
        "div",
        "list",
        history.map((w) => {
          const r = routines.find((x) => x.id === w.routineId);
          return listItem({
            title: r ? r.name : "Workout",
            meta: [
              el("span", "badge", fmtDate(w.date)),
              el("span", "badge badge-success", `${w.completedExercises.length}${r ? "/" + r.exercises.length : ""} exercises`),
              w.notes ? el("span", "faint", w.notes) : null,
            ].filter(Boolean),
            actions: [deleteButton(() => removeWorkoutEntry(w))],
          });
        })
      )
    );
  }
}

export function toggleExercise(date, routineId, exerciseId) {
  healthStore.update((s) => {
    const existing = s.workoutLog.find((w) => w.date === date);
    if (!existing) {
      return { ...s, workoutLog: [...s.workoutLog, { id: uid(), date, routineId, notes: "", completedExercises: [exerciseId] }] };
    }
    const completed = existing.completedExercises.includes(exerciseId)
      ? existing.completedExercises.filter((id) => id !== exerciseId)
      : [...existing.completedExercises, exerciseId];
    return { ...s, workoutLog: s.workoutLog.map((w) => (w.id === existing.id ? { ...w, routineId, completedExercises: completed } : w)) };
  });
}

async function removeWorkoutEntry(entry) {
  if (!(await confirmDialog(`Delete workout log for ${fmtDate(entry.date)}?`, { confirmLabel: "Delete" }))) return;
  healthStore.update((s) => ({ ...s, workoutLog: s.workoutLog.filter((w) => w.id !== entry.id) }));
}

function routineCard(routine) {
  return el(
    "div",
    "card",
    el("div", "flex-between mb2",
      el("div", "card-title", routine.name),
      el("div", "li-actions", editButton(() => openRoutineForm(routine)), deleteButton(() => removeRoutine(routine)))),
    routine.exercises.length
      ? el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          routine.exercises.map((exercise) =>
            el("div", "flex-between small",
              el("span", null, exercise.name),
              el("span", "muted", `${exercise.sets}×${exercise.reps}${exercise.weight ? ` @ ${exercise.weight}kg` : ""}`))
          )
        )
      : el("p", "faint small", "No exercises yet.")
  );
}

async function removeRoutine(routine) {
  if (!(await confirmDialog(`Delete routine "${routine.name}"?`, { confirmLabel: "Delete" }))) return;
  healthStore.update((s) => {
    const weeklySplit = { ...s.weeklySplit };
    for (const key of DAY_KEYS) if (weeklySplit[key] === routine.id) weeklySplit[key] = null;
    return { ...s, routines: s.routines.filter((r) => r.id !== routine.id), weeklySplit };
  });
}

function openRoutineForm(existing) {
  const name = textInput({ value: existing?.name || "", placeholder: "e.g. Push Day" });
  let exercises = (existing?.exercises || []).map((e) => ({ ...e }));
  const exerciseList = el("div", "mb3");

  const redrawExercises = () => {
    clear(exerciseList);
    if (!exercises.length) {
      exerciseList.append(el("p", "faint small mb3", "No exercises yet — add your lifts below."));
    }
    exercises.forEach((exercise, index) => {
      exerciseList.append(
        el(
          "div",
          { class: "flex mb2", style: { alignItems: "center" } },
          el("span", { class: "small", style: { flex: 1, fontWeight: 600 } }, exercise.name),
          el("span", "muted small", `${exercise.sets}×${exercise.reps}${exercise.weight ? ` @ ${exercise.weight}kg` : ""}`),
          deleteButton(() => {
            exercises.splice(index, 1);
            redrawExercises();
          })
        )
      );
    });
  };

  const exName = textInput({ placeholder: "Exercise", style: { flex: 2 } });
  const exSets = numberInput({ placeholder: "Sets", min: 1, value: 3, style: { width: "64px" } });
  const exReps = numberInput({ placeholder: "Reps", min: 1, value: 10, style: { width: "64px" } });
  const exWeight = numberInput({ placeholder: "kg", min: 0, style: { width: "64px" } });
  const addExercise = () => {
    if (!exName.value.trim()) { exName.focus(); return; }
    exercises.push({
      id: uid(),
      name: exName.value.trim(),
      sets: Number(exSets.value) || 3,
      reps: Number(exReps.value) || 10,
      weight: Number(exWeight.value) || 0,
    });
    exName.value = "";
    exWeight.value = "";
    redrawExercises();
    exName.focus();
  };
  exName.addEventListener("keydown", (e) => { if (e.key === "Enter") addExercise(); });

  const saveBtn = el("button", { class: "btn btn-primary", onclick: () => {
    if (!name.value.trim()) { name.focus(); return; }
    const record = { id: existing?.id || uid(), name: name.value.trim(), exercises };
    healthStore.update((s) => ({
      ...s,
      routines: existing ? s.routines.map((r) => (r.id === existing.id ? record : r)) : [...s.routines, record],
    }));
    close();
  } }, existing ? "Save" : "Create Routine");

  const { close } = openModal({
    title: existing ? "Edit Routine" : "New Routine",
    content: el(
      "div",
      null,
      field("Routine name", name),
      el("div", "field", el("label", null, "Exercises"), exerciseList),
      el("div", "flex", exName, exSets, exReps, exWeight, el("button", { class: "btn btn-sm", onclick: addExercise }, "Add"))
    ),
    footer: saveBtn,
  });
  redrawExercises();
}
