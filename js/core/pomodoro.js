// Global pomodoro engine. Lives outside the router so the timer keeps
// running across page navigation; app.js drives the 1s tick.

import { settingsStore, timeStore } from "./stores.js";
import { todayStr, fmtMins } from "./dom.js";

const BASE_TITLE = document.title;
const listeners = new Set();

const state = {
  running: false,
  phase: "work", // "work" | "break"
  remaining: null, // seconds; null = not initialized yet
};

function phaseDuration(phase) {
  const settings = settingsStore.get();
  const mins = phase === "work" ? settings.pomodoroWorkMin : settings.pomodoroBreakMin;
  return Math.max(1, Number(mins) || (phase === "work" ? 25 : 5)) * 60;
}

function ensureInitialized() {
  if (state.remaining === null) state.remaining = phaseDuration(state.phase);
}

function notify() {
  ensureInitialized();
  listeners.forEach((fn) => fn(state));
  document.title = state.running ? `${fmtMins(state.remaining)} ${state.phase === "work" ? "◉" : "☕"} — Life OS` : BASE_TITLE;
}

export function getPomodoro() {
  ensureInitialized();
  return state;
}

export function subscribePomodoro(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startPomodoro() {
  ensureInitialized();
  state.running = true;
  notify();
}

export function pausePomodoro() {
  state.running = false;
  notify();
}

export function resetPomodoro() {
  state.running = false;
  state.phase = "work";
  state.remaining = phaseDuration("work");
  notify();
}

export function sessionsToday() {
  return timeStore.get().pomodoroSessions[todayStr()] || 0;
}

export function tickPomodoro() {
  if (!state.running) return;
  ensureInitialized();
  state.remaining -= 1;
  if (state.remaining <= 0) {
    if (state.phase === "work") {
      const today = todayStr();
      timeStore.update((s) => ({
        ...s,
        pomodoroSessions: { ...s.pomodoroSessions, [today]: (s.pomodoroSessions[today] || 0) + 1 },
      }));
      state.phase = "break";
      state.remaining = phaseDuration("break");
    } else {
      state.phase = "work";
      state.remaining = phaseDuration("work");
      state.running = false; // break over → wait for the next deliberate start
    }
  }
  notify();
}
