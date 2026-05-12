# The War Game — Implementation Plan

Companion to `thewargame.md`. This plan is concrete to the existing `couple-games` repo: single-player, frontend-only, lazy-loaded route, themed with the same CSS custom properties as Mirror Sketch.

## Locked decisions

| Topic           | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Renderer        | **PixiJS** (`pixi.js` v8). Used for both the map and explosion effects. |
| Map data        | **Bundled GeoJSON** under `public/thewargame/geo/`, pre-simplified.     |
| Styling         | **SCSS + CSS custom properties** (extend `src/styles.scss` tokens).     |
| State           | Angular **signals** for UI state; **RxJS** for the tick stream.         |
| Persistence     | **`localStorage`** namespaced `thewargame:save:<slot>`. No backend.     |
| Server          | **None.** Single-player. `server/` stays mirror-sketch-only.            |
| Module loading  | Standalone components, lazy-loaded via the router.                      |

## Integration with the existing app

1. **Home card.** Append a `GameCard` to `HomeComponent.games` in `src/home/home.component.ts` (route `/thewargame`, distinct accent color, war/globe emoji).
2. **Route.** Add a lazy-loaded entry in `src/app/app.routes.ts`:
   ```
   { path: 'thewargame', loadComponent: () => import('../thewargame/components/shell/shell.component').then(m => m.ShellComponent) }
   ```
   The wildcard `**` route already falls back to `/`, no change needed.
3. **Theme tokens.** Add wargame-specific tokens to both `:root` and `[data-theme='dark']` in `src/styles.scss` (e.g. `--wg-ocean`, `--wg-land`, `--wg-border`, `--wg-hostile`, `--wg-friendly`, `--wg-fog`). Map colors must work in both themes.
4. **Settings menu.** `<app-settings-menu />` is already mounted globally; the dark-mode toggle works for the new route for free. New game-specific options (autosave, sound) can be added later via the same component or a local in-game menu.

## File layout

```
src/thewargame/
├── thewargame.md                  # design doc (existing)
├── IMPLEMENTATION_PLAN.md         # this file
├── components/
│   ├── shell/                     # top-level route component, hosts everything
│   ├── map-view/                  # Pixi <canvas> host + interaction layer
│   ├── hud/
│   │   ├── clock-bar/             # date + speed controls (top)
│   │   ├── news-ticker/           # bottom event feed
│   │   ├── side-panel/            # tabbed: Resources | Agencies | Tech | Military
│   │   └── region-tooltip/        # hover/click info over a region
│   ├── dialogs/
│   │   ├── build-dialog/          # build/upgrade a hub
│   │   ├── strike-dialog/         # confirm strike target + weapon
│   │   └── tech-tree-dialog/      # branch view
│   └── effects/                   # Angular wrappers around Pixi effects (no DOM)
├── services/
│   ├── game.service.ts            # root signal-based store (nation, regions, money, …)
│   ├── clock.service.ts           # tick stream (RxJS), speed control, day/month/year
│   ├── map.service.ts             # owns Pixi Application + map layers
│   ├── geo.service.ts             # loads bundled GeoJSON, builds province/state index
│   ├── resource.service.ts        # per-tick production, consumption, market price walk
│   ├── construction.service.ts    # build queue, hub levels, costs
│   ├── intel.service.ts           # MVP stub (fog-of-war flag per region)
│   ├── combat.service.ts          # strike resolution, diplomatic fallout
│   ├── effects.service.ts         # explosion/animation manager (Pixi-side)
│   ├── persistence.service.ts     # localStorage save/load, autosave
│   └── rng.service.ts             # seeded PRNG so saves are reproducible
├── models/
│   ├── game.types.ts              # GameState, Nation, Region, ResourceBag, Hub, Unit
│   ├── geo.types.ts               # FeatureCollection wrapper, Region metadata
│   ├── events.types.ts            # NewsEvent, DiplomaticEvent, CombatEvent
│   └── tech.types.ts              # TechNode, TechBranch
├── data/
│   ├── nations.ts                 # USA + Canada static metadata for MVP
│   ├── regions-seed.ts            # starting resources/population per state/province
│   ├── tech-tree.ts               # MVP: ~6 nodes across Military/Industrial
│   ├── hubs.ts                    # hub catalog (costs, effects, max level)
│   ├── weapons.ts                 # ICBM, tactical nuke, air strike specs
│   └── balance.ts                 # tuning constants (tick rates, prices, decay)
├── pixi/
│   ├── map-renderer.ts            # builds region polygons, hover/select overlays
│   ├── camera.ts                  # pan/zoom controller (wheel + drag + pinch)
│   ├── hit-test.ts                # point-in-polygon over GeoJSON in screen space
│   ├── projection.ts              # geo ⇄ world ⇄ screen, equirectangular MVP
│   └── effects/
│       ├── explosion.ts           # nested-circle fireball, configurable size
│       ├── cluster-strike.ts      # multiple explosions w/ stagger (carpet bomb)
│       └── shockwave.ts           # ring expansion
└── styles/
    └── _shared.scss               # alias var(--…) to SCSS variables, same pattern as mirror-sketch
```

`public/thewargame/geo/`
- `world-low.geo.json` — countries-only, low detail for the global view
- `us-states.geo.json` — 50 states + DC, mid detail
- `ca-provinces.geo.json` — 13 provinces/territories, mid detail
- `cities.geo.json` — major US/Canada cities (points), optional for MVP

## Phase 0 — Scaffolding (no gameplay yet)

Goal: route exists, blank Pixi canvas renders, home card links to it.

- `npm install pixi.js@^8`
- Create `components/shell` with a full-viewport layout: header row (placeholder clock bar), main area (`<map-view>`), right side panel placeholder, bottom news ticker placeholder.
- Add route + home card.
- `MapService` instantiates a `PIXI.Application` lazily inside the shell's `ngAfterViewInit`, destroys on `ngOnDestroy` to avoid the WebGL context leaking on route exit.
- Verify dark-mode toggle still works.

**Acceptance:** Navigate to `/thewargame`, see an empty Pixi canvas with a neutral ocean color, and a "Back to home" link works.

## Phase 1 — Map foundation

Goal: pan/zoom world map, US states + CA provinces drawn with hover highlight and tooltip.

1. **GeoJSON pipeline.**
   - Source: Natural Earth (countries), US Census TIGER cartographic boundaries (states), StatsCan provinces.
   - Pre-simplify with `mapshaper` (`-simplify 8% keep-shapes -clean`) and save to `public/thewargame/geo/`.
   - All files in **WGS84 lon/lat**, no projection baked in.
2. **Projection.** Equirectangular (lon→x, lat→y, scaled to a fixed world bbox). Keep it pluggable — `projection.ts` exports `geoToWorld(lon, lat)` / `worldToGeo(x, y)`. We can swap to Web Mercator later without touching the renderer.
3. **Renderer.**
   - One `PIXI.Container` per layer: `oceanLayer`, `countryLayer`, `subdivisionLayer` (US+CA only), `cityLayer`, `unitLayer`, `effectsLayer`, `overlayLayer` (selection rings, fog).
   - Each region becomes a `PIXI.Graphics` polygon (or `PIXI.Mesh` if perf demands; start with Graphics). Store the originating GeoJSON ring in world coords on a side map keyed by region id, for hit testing without re-reading the source.
   - Hover: redraw with accent fill + 2px accent outline. Selection: persistent ring overlay.
4. **Camera.**
   - Wheel zoom centered on cursor, drag-pan, pinch-zoom on touch. Clamp zoom 0.5×…32×.
   - Apply to root container's `scale`/`position`; do **not** re-project polygons per frame.
5. **Hit testing.** Mouse → world coords → point-in-polygon over the regions whose bbox contains the point. Bbox cache built at load time.
6. **Tooltip.** Angular component (`region-tooltip`) absolutely positioned over the canvas, reading the currently hovered region from a signal in `MapService`. Shows name, population, resources, stability.
7. **Theming.** Map fills come from CSS custom properties read at boot (`getComputedStyle(document.documentElement).getPropertyValue('--wg-land')`). On theme change, re-tint the layers. Listen via a `MutationObserver` on `<html data-theme>`.

**Acceptance:** Smooth pan/zoom on desktop and mobile, hovering any US state or CA province highlights it and shows a tooltip with seed data, clicking selects it (visible ring), dark-mode swaps the palette.

## Phase 2 — Simulation engine

Goal: clock runs, ticks emit, resources accumulate, news ticker reflects events.

1. **`ClockService`**
   - `state$: BehaviorSubject<{ date: Date; speed: 0|1|5|20; paused: boolean }>`.
   - Drive with `requestAnimationFrame`. Real-time-to-game-time: `1 tick = 1 in-game day`, base rate `1 tick/sec` at 1×, scaled by speed. Pause halts emission but keeps RAF running for animations.
   - Expose `tick$: Observable<TickEvent>` and `date()` signal for templates.
2. **`GameService`** — root store, signal-based.
   - `nation = signal<Nation>(...)`, `regions = signal<Map<RegionId, RegionState>>`.
   - `subscribe(tick$)` once at construction; on each tick, fan out to `ResourceService.applyTick`, `ConstructionService.advance`, `IntelService.gather`, etc.
3. **`ResourceService`**
   - Per region: yield = `baseYield(resource) * efficiency(hubLevel) * stabilityFactor`.
   - National totals are computed via `computed()` over `regions`.
   - Market prices: random walk bounded by scarcity (`price *= 1 ± noise * (1 − stockRatio)`). Cap per-tick delta.
4. **News ticker.** `NewsService` exposes `events$` (capped to last 50). `ResourceService`, `CombatService`, etc. push entries. Component renders a scrolling marquee with type-icons.
5. **Speed controls.** A small reactive form in `clock-bar` writes to `ClockService.setSpeed`. Keyboard: `Space`=pause, `1`/`2`/`3`=speeds.
6. **Determinism.** All randomness flows through `RngService` (seeded mulberry32). Seed is part of the save.

**Acceptance:** Start a new game, press play, watch the date advance at 1×/5×/20×, see Oil/Gold counters tick up, see periodic "market jitter" news entries.

## Phase 3 — Command UI

Goal: usable HUD for building, researching, and seeing what the empire is doing.

1. **Layout** (mobile-first, like Mirror Sketch).
   - **Top bar:** date, speed, national money, alert badge.
   - **Right side panel** (collapsible drawer below 720 px): tabbed — Resources, Agencies, Tech, Military.
   - **Bottom:** news ticker.
   - **Region drawer:** opens when a region is selected; lists hubs, build slots, garrison, stability.
2. **Build flow.**
   - In a selected region, click an empty slot → opens `build-dialog` with hub catalog (Intel Agency, Research Lab, Defense Plant, Mine, Refinery).
   - Show cost (money + resources) and effect summary. Confirm queues a build via `ConstructionService` (real-time days to complete).
   - Existing hubs show an "Upgrade to L{n+1}" button.
3. **Research.**
   - `tech-tree-dialog` renders nodes as a SVG-in-Angular graph. Click a node, allocate research points generated per tick by Research Lab levels. Locked branches are dimmed.
4. **Agencies tab** drives `IntelService` (MVP stub: a single "Intel Coverage" % per foreign region; spend money to push it up).
5. **Reactive forms** for speed controls, search-by-region (`<input>` filters tooltip/region list), and build-dialog confirmation.
6. **Keyboard.** `Esc` closes dialogs, `Tab` cycles side-panel tabs, `/` focuses region search.

**Acceptance:** Player can pick a state, build an Oil Refinery, watch construction progress over in-game days, and see Oil output rise on completion. Player can spend research points to unlock one Phase-4-relevant tech (e.g. "Tactical Nuke Doctrine").

## Phase 4 — Combat & events

Goal: launch a strike on a Canadian province, see explosions, watch diplomatic fallout in the ticker.

1. **Weapon catalog** (`data/weapons.ts`): Air Strike (cheap, low damage, low PR hit), Tactical Nuke (gated by tech, mid damage, big PR hit), ICBM (gated by silo + tech, high damage, severe PR hit, longer travel time).
2. **Strike flow.**
   - Player selects own military hub (e.g. an Airfield in Montana) → "Launch Strike" → enters targeting mode (cursor turns into crosshair).
   - Click target region → `strike-dialog` confirms weapon, target, ETA, predicted PR delta.
   - `CombatService.launch(...)` creates a `StrikeOrder` with arrival tick; renders a missile/airplane icon traveling along a great-circle path in the `unitLayer`.
3. **Explosion VFX** (`pixi/effects/explosion.ts`).
   - Procedural, no textures. Nested expanding circles with easing:
     - Inner: bright white → yellow → orange, scales 0→1 over 200 ms, then fades.
     - Mid: orange → red ring, 0→1.4 over 500 ms, alpha 1→0.
     - Outer: dark smoke ring, 0→2 over 1200 ms, alpha 0.6→0.
     - Shockwave: thin white ring, 0→2.5 over 800 ms, alpha 0.8→0.
   - `cluster-strike.ts` schedules N explosions with jittered positions and 80 ms stagger for carpet bombing.
   - All effects driven by `ClockService`'s RAF loop; pause freezes them so the simulation feels consistent.
4. **Damage model (MVP).** Region's `population` and `stability` drop by weapon-dependent amounts. Destroys 1 random hub on direct nuke.
5. **Diplomatic state.** `nation.relations: Record<NationId, number>` in `[-100, 100]`. Strikes drop the target relation by weapon-specific amount; news ticker emits "USA launches strike on Saskatchewan. Relations: -45."
6. **Save after strike.** Persistence service writes after every combat event so a tab refresh doesn't lose the moment.

**Acceptance:** Build an airfield in Montana, launch an air strike on Alberta, see the missile cross the map, watch the explosion play, see the news ticker entry, and see relations drop. Tactical Nuke is locked until the tech is researched.

## Phase 5 — Post-MVP backlog (not in scope yet)

- More playable factions (UK, China, Russia) — needs nation-agnostic AI.
- AI for non-player nations (simple FSM: build, research, react to strikes).
- Full tech tree with Fantasy tier (orbital lasers, teleportation).
- Trade & embargoes, debt markets, inflation.
- Naval and ground unit movement with pathfinding.
- Multiplayer (would reintroduce the socket server).
- Save slots UI + import/export to a JSON blob.

## Risks & mitigations

| Risk                                                              | Mitigation                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PixiJS bundle pushes initial budget over `1 MB` (`angular.json`). | Route is lazy-loaded; check actual chunk size in Phase 0 and, if needed, raise the **lazy chunk** budget rather than the initial bundle.  |
| GeoJSON file sizes balloon the static site.                       | Pre-simplify aggressively; target ≤ 300 KB per region file. Gzipped served by Render.                                                     |
| Pixi WebGL context leaks across SPA navigations.                  | Always `app.destroy(true, { children: true, texture: true })` in the shell's `ngOnDestroy`.                                               |
| Frame drops at 20× speed.                                         | Decouple sim ticks from RAF: batch up to N ticks per frame, render once. Limit per-tick allocations (reuse Point/Rect objects).           |
| Theme change mid-game leaves wrong-color polygons.                | Listen for `data-theme` mutation, re-tint via `Graphics.tint` rather than re-issuing draw commands.                                       |
| Save format churn during development.                             | Version the save blob (`{ version: 1, … }`). On mismatch, show a "save outdated" toast and start fresh rather than crashing.              |

## Phase order & rough sizing

| Phase | Title              | Effort  | Player-visible deliverable                              |
| ----- | ------------------ | ------- | ------------------------------------------------------- |
| 0     | Scaffolding        | ~0.5 d  | Route works, blank Pixi canvas                          |
| 1     | Map foundation     | ~2–3 d  | Pan/zoom world + US/CA hover + tooltip                  |
| 2     | Simulation engine  | ~1–2 d  | Clock runs, resources accumulate, ticker shows events   |
| 3     | Command UI         | ~2–3 d  | Build hubs, research one tech, side panel + dialogs     |
| 4     | Combat & VFX       | ~1–2 d  | Launch strikes, see explosions, see diplomatic fallout  |

Total MVP: ~7–11 focused days.

## What I'll need from you between phases

- After **Phase 1**: a sanity check on map appearance + region coverage (do you want territories like Puerto Rico / DC drawn? US-only Canadian-style sub-regions?).
- After **Phase 2**: confirmation on whether the tick rate feels right (1 day = 1 second at 1× is the proposed default).
- After **Phase 3**: which 4–6 tech nodes to ship in the MVP tree (proposed seeds in `data/tech-tree.ts`).
- After **Phase 4**: balance pass — weapon damage, PR hits, build costs.

---

Ready to start Phase 0 on your green light.
