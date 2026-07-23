import { el, clear, todayStr, dayIndex, fmtDate, DAY_NAMES } from "../core/dom.js";
import {
  settingsStore, tasksStore, projectsStore, timeStore, businessStore, lifestyleStore, healthStore,
} from "../core/stores.js";
import { sessionsToday } from "../core/pomodoro.js";
import { checkToggle } from "../components/listItem.js";
import { statTile } from "../components/card.js";
import { progressRing } from "../components/progressRing.js";
import { navigate } from "../core/router.js";
import { isHabitDone, toggleHabit, computeStreak } from "./lifestyle.js";
import { followUpsDue } from "./business.js";
import { categoryColor } from "./time.js";
import { waterFor, addWater, mealsFor, routineForDay, workoutEntryFor, toggleExercise } from "./health.js";

export function render(outlet) {
  const container = el("div", "page");
  outlet.append(container);

  const draw = () => {
    clear(container);
    container.append(view());
  };

  const stores = [settingsStore, tasksStore, projectsStore, timeStore, businessStore, lifestyleStore, healthStore];
  const unsubs = stores.map((store) => store.subscribe(draw));
  draw();
  return () => unsubs.forEach((unsub) => unsub());
}

function view() {
  const settings = settingsStore.get();
  const today = todayStr();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const tasks = tasksStore.get().items;
  const openTasks = tasks.filter((t) => t.status !== "done");
  const activeProjects = projectsStore.get().items.filter((p) => p.status === "active");
  const { habits, habitLog } = lifestyleStore.get();
  const bestStreak = habits.reduce((best, h) => Math.max(best, computeStreak(habitLog, h.id)), 0);

  return el(
    "div",
    null,
    el(
      "div",
      "page-header",
      el("div", null, el("h1", null, `${greeting}, ${settings.userName}`), el("div", "subtitle", dateLabel))
    ),
    el(
      "div",
      "stats-row",
      statTile(openTasks.length, "Open tasks", "var(--c-tasks)"),
      statTile(activeProjects.length, "Active projects", "var(--c-projects)"),
      statTile(sessionsToday(), "Focus sessions", "var(--c-time)"),
      statTile(bestStreak ? `${bestStreak}🔥` : "0", "Best streak", "var(--c-lifestyle)")
    ),
    el(
      "div",
      "two-col",
      el("div", null, tasksCard(today), scheduleCard(today), followUpsCard()),
      el("div", null, habitsCard(today), healthCard(today))
    )
  );
}

function dashCard(title, route, ...children) {
  return el(
    "div",
    "card mb4",
    el(
      "div",
      "flex-between mb3",
      el("div", "card-title", title),
      el("button", { class: "btn btn-ghost btn-sm", onclick: () => navigate(route) }, "Open →")
    ),
    children
  );
}

/* ---- Tasks due ---- */
function tasksCard(today) {
  const due = tasksStore
    .get()
    .items.filter((t) => t.status !== "done" && t.due && t.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : 1));

  return dashCard(
    "Tasks due",
    "/tasks",
    due.length
      ? el(
          "div",
          "list",
          due.slice(0, 6).map((task) =>
            el(
              "div",
              "list-item",
              checkToggle(false, () =>
                tasksStore.update((s) => ({
                  ...s,
                  items: s.items.map((t) => (t.id === task.id ? { ...t, status: "done", completedAt: new Date().toISOString() } : t)),
                }))
              ),
              el(
                "div",
                "li-main",
                el("div", "li-title", task.title),
                el("div", "li-meta", el("span", `badge${task.due < today ? " badge-danger" : " badge-warning"}`, task.due < today ? `Overdue · ${fmtDate(task.due)}` : "Today"))
              )
            )
          )
        )
      : el("p", "muted small", "Nothing due today. 🎯")
  );
}

/* ---- Today's schedule ---- */
function scheduleCard(today) {
  const todayIdx = dayIndex(today);
  const blocks = timeStore
    .get()
    .blocks.filter((b) => b.day === todayIdx)
    .sort((a, b) => (a.start < b.start ? -1 : 1));

  return dashCard(
    `Schedule · ${DAY_NAMES[todayIdx]}`,
    "/time",
    blocks.length
      ? el(
          "div",
          "list",
          blocks.map((block) =>
            el(
              "div",
              { class: "list-item", style: { borderLeft: `3px solid ${categoryColor(block.category)}` } },
              el(
                "div",
                "li-main",
                el("div", "li-title", block.label),
                el("div", "li-meta", el("span", "muted", `${block.start}–${block.end}`))
              )
            )
          )
        )
      : el("p", "muted small", "No time blocks scheduled for today.")
  );
}

/* ---- Follow-ups ---- */
function followUpsCard() {
  const due = followUpsDue(businessStore.get().contacts);
  if (!due.length) return null;
  return dashCard(
    "Follow-ups due",
    "/business",
    el(
      "div",
      "list",
      due.slice(0, 5).map((contact) =>
        el(
          "div",
          "list-item",
          el(
            "div",
            "li-main",
            el("div", "li-title", contact.name),
            el("div", "li-meta",
              contact.company ? el("span", "muted", contact.company) : null,
              el("span", "badge badge-danger", `Follow up ${fmtDate(contact.followUpDate)}`))
          )
        )
      )
    )
  );
}

/* ---- Habits today ---- */
function habitsCard(today) {
  const { habits, habitLog } = lifestyleStore.get();
  return dashCard(
    "Habits today",
    "/lifestyle",
    habits.length
      ? el(
          "div",
          "list",
          habits.map((habit) =>
            el(
              "div",
              "list-item",
              checkToggle(isHabitDone(habitLog, today, habit.id), () => toggleHabit(today, habit.id)),
              el(
                "div",
                "li-main",
                el("div", `li-title${isHabitDone(habitLog, today, habit.id) ? " done" : ""}`, habit.name),
                el("div", "li-meta", el("span", "muted", `${computeStreak(habitLog, habit.id)}🔥 streak`))
              )
            )
          )
        )
      : el("p", "muted small", "No habits yet — set some up in Lifestyle.")
  );
}

/* ---- Health today ---- */
function healthCard(today) {
  const settings = settingsStore.get();
  const glasses = waterFor(today);
  const meals = mealsFor(today);
  const calories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const routine = routineForDay(today);
  const entry = workoutEntryFor(today);
  const completed = entry?.completedExercises?.length || 0;

  return dashCard(
    "Health today",
    "/health",
    el(
      "div",
      { style: { display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" } },
      el(
        "div",
        { style: { textAlign: "center" } },
        progressRing(Math.round((glasses / settings.waterTargetGlasses) * 100), { size: 60, color: "var(--accent)", label: String(glasses), sub: "water" })
      ),
      el(
        "div",
        { style: { textAlign: "center" } },
        progressRing(Math.round((calories / settings.calorieTarget) * 100), { size: 60, color: "var(--c-health)", label: String(calories), sub: "kcal" })
      ),
      el("button", { class: "btn btn-sm", onclick: () => addWater(1) }, "+ Water")
    ),
    routine
      ? el(
          "div",
          null,
          el("div", "flex-between mb2",
            el("span", { style: { fontWeight: 600 } }, `Workout: ${routine.name}`),
            completed === routine.exercises.length && routine.exercises.length > 0
              ? el("span", "badge badge-success", "Done 💪")
              : el("span", "badge", `${completed}/${routine.exercises.length}`)),
          el(
            "div",
            "list",
            routine.exercises.slice(0, 5).map((exercise) =>
              el(
                "div",
                { class: "flex", style: { padding: "2px 0" } },
                checkToggle((entry?.completedExercises || []).includes(exercise.id), () => toggleExercise(today, routine.id, exercise.id)),
                el("span", `small${(entry?.completedExercises || []).includes(exercise.id) ? " faint" : ""}`, ` ${exercise.name} · ${exercise.sets}×${exercise.reps}`)
              )
            )
          )
        )
      : el("p", "muted small", "Rest day — no workout scheduled.")
  );
}
