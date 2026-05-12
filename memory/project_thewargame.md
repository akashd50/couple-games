---
name: The War Game (couple-games)
description: Second game in the repo — single-player Grand Strategy Simulation. Design doc + implementation plan live in src/thewargame/.
type: project
---

The War Game is the second game added to the couple-games repo (after Mirror Sketch). Unlike Mirror Sketch, it is **single-player and frontend-only** — no socket server, no rooms.

**Why:** Project owner wanted a separate ambitious solo game hosted in the same Angular app. The design doc (`src/thewargame/thewargame.md`) targets a Grand Strategy Simulation: geopolitics, resource management, espionage, conventional + strategic warfare, with MVP focused on USA as playable faction and high-detail US + Canada sub-national map.

**How to apply:**

- **Source of truth for the design**: `src/thewargame/thewargame.md` (the user authored this — treat as spec).
- **Source of truth for the build plan**: `src/thewargame/IMPLEMENTATION_PLAN.md` (phased Phase 0–5 plan with file layout, locked decisions, risks, sizing).
- **Locked decisions (do not re-litigate without the user)**:
  - Renderer: **PixiJS v8** (also handles explosion VFX — nested expanding circles, no textures)
  - Map data: **bundled pre-simplified GeoJSON** in `public/thewargame/geo/` (Natural Earth + US Census TIGER + StatsCan, simplified with mapshaper)
  - Styling: **SCSS + existing CSS custom properties** (extend `:root` and `[data-theme='dark']` in `src/styles.scss` with `--wg-*` tokens)
  - State: Angular **signals** for UI, **RxJS** for the tick stream
  - Persistence: **localStorage**, namespaced `thewargame:save:<slot>`, versioned blob
  - Backend: **none** — `server/` stays mirror-sketch-only
  - Routing: lazy-loaded standalone components at `/thewargame`
- **Integration points**:
  - Add a `GameCard` to `HomeComponent.games` in `src/home/home.component.ts`
  - Add a lazy route in `src/app/app.routes.ts`
  - `<app-settings-menu />` is already mounted globally — dark-mode toggle works for free
- **Status**: Design doc + implementation plan exist; **no code written yet**. Phase 0 (scaffolding) is the next step.
