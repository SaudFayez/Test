// Minimal hash router. Each view is render(outlet) and may return a cleanup
// function (e.g. store unsubscribes) invoked before the next route renders.

let routes = {};
let outlet = null;
let cleanup = null;

export function defineRoutes(map) {
  routes = map;
}

export function currentPath() {
  const hash = location.hash.replace(/^#/, "");
  return hash || "/";
}

export function navigate(path) {
  location.hash = "#" + path;
}

function renderRoute() {
  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.error("lifeos: route cleanup failed", err);
    }
  }
  cleanup = null;

  const path = currentPath();
  const view = routes[path] || routes["/"];
  outlet.innerHTML = "";
  outlet.scrollTop = 0;
  cleanup = view(outlet) || null;

  document.querySelectorAll("#sidebar a[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === path);
  });
}

export function startRouter(outletEl) {
  outlet = outletEl;
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
