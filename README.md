# Saud's Life OS

A personal management website covering everything in one place:

- **Dashboard** — today at a glance: due tasks, schedule, habits, water, workout, follow-ups
- **Tasks** — todos with priorities, due dates, tags, and status
- **Projects** — project cards with milestones and auto-computed progress
- **Time** — weekly schedule grid (color-coded blocks) + pomodoro focus timer
- **Business** — quarterly goals, networking contacts with follow-up reminders, ideas pipeline
- **Production** — Batch Roastery roasting plan: per-bean monthly demand history, next-month forecast, stock coverage, and batch/green-bean requirements
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

## Production data snapshot

The **Production** page works from a data snapshot of the Batch Roastery Odoo ERP committed at
`js/data/roasting-data.js` (snapshot date is shown in the page header). The deployed site is fully
static and cannot query Odoo live — to refresh the numbers, ask Claude to regenerate the snapshot
and push. Extraction recipe (via the `batch_main` Odoo MCP):

- **Products**: `product.product` where `categ_id in [37, 38, 50, 47]` (Roasted Coffee Beans 1kg /
  250g / 125g / grams) → per-SKU stock. kg conversion is **by category** (1 / 0.25 / 0.125 / 0.001 kg),
  never by UoM (two 125g SKUs carry UoM "Units").
- **Demand**: `sale.order.line` (same categories, `state in [sale, done]` — excludes draft quotes,
  bucketed by `create_date` month) + `pos.order.line` (same categories, refunds kept as negatives).
  Lines can reference archived products, so aggregation groups by normalized product *name*
  (pack-size suffix stripped, spelling variants aliased, e.g. Chelechle→Chelchle, Mananansi→Mananasi).
- **Production log**: `mrp.production` where `name like "MF/MO"` and `state = done` (roasting MOs;
  `product_qty` is in bags → converted to kg).
- The snapshot month is partial and is excluded from forecasting; the forecast itself is a weighted
  moving average of the last 3 full months with a damped trend, computed client-side in
  `js/pages/production.js` so parameters (growth %, batch size, roast loss %, safety stock) stay tunable.

## Tech notes

- Hash-based routing (`#/tasks`) — works from any subpath, no server rewrites
- One localStorage key per module (`lifeos.tasks`, `lifeos.health`, …) with a schema version in `lifeos.meta` for future migrations
- Tiny homegrown infrastructure: pub/sub store factory, hash router, hyperscript-style DOM helper
