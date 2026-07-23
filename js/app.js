import { ensureMeta } from "./core/migrations.js";
import { defineRoutes, startRouter } from "./core/router.js";
import { tickPomodoro } from "./core/pomodoro.js";

import * as dashboard from "./pages/dashboard.js";
import * as tasks from "./pages/tasks.js";
import * as projects from "./pages/projects.js";
import * as time from "./pages/time.js";
import * as business from "./pages/business.js";
import * as lifestyle from "./pages/lifestyle.js";
import * as health from "./pages/health.js";
import * as settings from "./pages/settings.js";

ensureMeta();

defineRoutes({
  "/": dashboard.render,
  "/tasks": tasks.render,
  "/projects": projects.render,
  "/time": time.render,
  "/business": business.render,
  "/lifestyle": lifestyle.render,
  "/health": health.render,
  "/settings": settings.render,
});

startRouter(document.getElementById("outlet"));

// Global 1s tick keeps the pomodoro running across page navigation.
setInterval(tickPomodoro, 1000);
