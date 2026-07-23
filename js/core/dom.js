// Tiny hyperscript-style DOM builder + shared date/id utilities.

export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (typeof props === "string") {
    node.className = props;
  } else if (props && typeof props === "object" && !(props instanceof Node)) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "value") node.value = value;
      else if (key === "checked") node.checked = true;
      else node.setAttribute(key, value === true ? "" : value);
    }
  } else if (props !== undefined && props !== null) {
    children.unshift(props);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function svgIcon(pathMarkup, size = 16) {
  const wrap = document.createElement("span");
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
  return wrap.firstChild;
}

export function clear(node) {
  node.innerHTML = "";
}

export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const pad = (n) => String(n).padStart(2, "0");

// Local date as YYYY-MM-DD — the single source of "today" across the app.
export function todayStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return todayStr(date);
}

// Monday-based dates of the current week (offset in weeks).
export function weekDates(offsetWeeks = 0) {
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(now.getDate() - day + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return todayStr(d);
  });
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Index into DAY_KEYS for a YYYY-MM-DD string (0 = Monday).
export function dayIndex(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const opts = { month: "short", day: "numeric" };
  if (y !== new Date().getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

export function relDueLabel(dateStr) {
  if (!dateStr) return null;
  const today = todayStr();
  if (dateStr === today) return { text: "Due today", tone: "warning" };
  if (dateStr < today) return { text: `Overdue · ${fmtDate(dateStr)}`, tone: "danger" };
  if (dateStr === addDays(today, 1)) return { text: "Due tomorrow", tone: "accent" };
  return { text: `Due ${fmtDate(dateStr)}`, tone: "" };
}

export function fmtMins(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}
