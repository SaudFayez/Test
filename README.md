# Saud's Life OS

A personal management website covering everything in one place:

- **Dashboard** — today at a glance: due tasks, schedule, habits, water, workout, follow-ups
- **Tasks** — todos with priorities, due dates, tags, and status
- **Projects** — project cards with milestones and auto-computed progress
- **Time** — weekly schedule grid (color-coded blocks) + pomodoro focus timer
- **Business** — quarterly goals, networking contacts with follow-up reminders, ideas pipeline
- **Lifestyle** — habits tracker with streaks, events, reading list
- **Health** — meal & water logging, workout routines, weekly training split, workout history

## How it works

Zero-build static site: plain HTML, CSS, and JavaScript ES modules. No frameworks, no npm, no server. All data is stored in your **browser's localStorage** — private to your device.

## Run it

Serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or enable **GitHub Pages** (Settings → Pages → Deploy from a branch) and open the published URL.

## Backups

Your data lives only in the browser you use. Go to **Settings → Export backup (JSON)** regularly to download a backup file. Use **Import backup** on any other device/browser to restore it there.

## Tech notes

- Hash-based routing (`#/tasks`) — works from any subpath, no server rewrites
- One localStorage key per module (`lifeos.tasks`, `lifeos.health`, …) with a schema version in `lifeos.meta` for future migrations
- Tiny homegrown infrastructure: pub/sub store factory, hash router, hyperscript-style DOM helper
