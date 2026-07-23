import { createStore } from "./store.js";

export const settingsStore = createStore("lifeos.settings", {
  userName: "Saud",
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
  waterTargetGlasses: 8,
  calorieTarget: 2200,
});

export const tasksStore = createStore("lifeos.tasks", {
  items: [], // Task: { id, title, notes, priority, due, tags, status, createdAt, completedAt }
});

export const projectsStore = createStore("lifeos.projects", {
  items: [], // Project: { id, name, description, status, category, targetDate, milestones: [{id,title,due,done}] }
});

export const timeStore = createStore("lifeos.time", {
  blocks: [], // TimeBlock: { id, day: 0-6 (Mon=0), start "HH:MM", end "HH:MM", label, category }
  pomodoroSessions: {}, // "YYYY-MM-DD" → completed work sessions
});

export const businessStore = createStore("lifeos.business", {
  goals: [], // { id, title, period, metric, target, current, notes }
  contacts: [], // { id, name, company, role, metAt, lastContact, followUpDate, notes }
  ideas: [], // { id, title, notes, stage }
});

export const lifestyleStore = createStore("lifeos.lifestyle", {
  habits: [], // { id, name, targetPerWeek, createdAt }
  habitLog: {}, // "YYYY-MM-DD" → [habitId]
  events: [], // { id, title, date, location, type, prepNotes, attended }
  reading: [], // { id, title, author, type, status, takeaways }
});

export const healthStore = createStore("lifeos.health", {
  meals: [], // { id, date, type, description, calories, protein }
  water: {}, // "YYYY-MM-DD" → glasses
  routines: [], // { id, name, exercises: [{id, name, sets, reps, weight}] }
  weeklySplit: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
  workoutLog: [], // { id, date, routineId, notes, completedExercises: [exerciseId] }
});

export const ALL_STORES = [
  settingsStore,
  tasksStore,
  projectsStore,
  timeStore,
  businessStore,
  lifestyleStore,
  healthStore,
];
