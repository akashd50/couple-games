# Rogue-Lite — Design

A browser-based co-op rogue-lite at `/rogue-lite`. Up to **4 players** survive
escalating waves in a bounded arena, choose one upgrade per level, and the run
ends when the team wipes. Pure per-run — no meta progression.

This document supersedes the brainstorm in `project-idea.md` (kept for history).
Locked decisions live here; phasing lives in `IMPLEMENTATION_PLAN.md`.

---

## Locked decisions

| Topic            | Choice                                                                                  |
|------------------|-----------------------------------------------------------------------------------------|
| Renderer         | **PixiJS v8** (already in repo via thewargame). No new dependency.                      |
| Physics          | **Hand-rolled** circle-vs-circle + knockback. No Matter.js — not stacking rigid bodies. |
| Game shape       | **Open bounded arena**, escalating waves over time, periodic boss.                      |
| Run structure    | Death/team-wipe ends the run. Return to lobby. No save/load.                            |
| Networking       | **Solo-first.** Multiplayer is Phase 7+, server-authoritative at ~10 Hz, no prediction. |
| Classes (MVP)    | **Knight only.** Summoner deferred to Phase 6.                                          |
| Platforms        | **Desktop + mobile from day 1.** Twin-stick on touch, WASD + mouse on desktop.          |
| Meta progression | **None.** Every run starts fresh.                                                       |

---

## Core run loop

1. Lobby → pick class (only Knight initially) → ready up → start.
2. You spawn at arena center. Enemies start spawning around the perimeter.
3. **Auto-attack on tick** — no clicking to swing. Movement + aim are the skill.
4. Kill enemies → they drop XP gems. Walk over to collect.
5. Hit the XP threshold → game pauses → choose 1 of 3 random upgrades.
6. Every ~2 minutes, a boss spawns. Kill it for a large XP burst.
7. Difficulty escalates over time (spawn rate + enemy HP + speed).
8. Die → "Run ended" screen with time survived + kills → restart or back to
   lobby.

Auto-attack is the right default for an .io-style loop and works identically on
desktop + touch — movement+positioning is what the player controls.

---

## Knight — class spec

**Visual:** circle with a shield arc indicator showing facing.

**Attack:** sword arc sweeping in front of the Knight. Hits everything in a
60° cone within range. Triggers on a fixed cooldown.

- Minor new things:
- You run faster if you face the same direction that you are aiming
- Taking a hit on shield side you take less damage than from the back.
  **Upgrade pool (pick 1 on level-up; the level-up roller picks 3 from this pool

+ already-owned upgrades that can stack):**

| Upgrade     | Effect                                                                                                                                                                                                                                     |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Wide Cleave | +10° cone angle, +5% range, slows down the sword attack duration i.e. you swing slowly.                                                                                                                                                    |
| Flurry      | -15% attack cooldown.                                                                                                                                                                                                                      |
| Juggernaut  | +25% max HP, +5% body radius, +20% knockback resistance, shows movement speed -10%.                                                                                                                                                        |
| Iron Skin   | -15% incoming damage.                                                                                                                                                                                                                      |
| Aura shield | -5% incoming damage on shield side hit. i.e. better shield damage reduction                                                                                                                                                                |
| Lifesteal   | +5% of damage dealt heals you.                                                                                                                                                                                                             |
| Magnet      | +50% XP-gem pickup radius.                                                                                                                                                                                                                 |
| Shockwave   | Every 5th attack emits an expanding ring that knocks back enemies in range. Shockwave starts past the sword range. cone like shape however it's smaller edge is the same arc and length as the sword swipe's and it expands as it goes.    |
| Aura        | Represented as a circular area around the player, a pulsing smaller circle that expands and fills the circle, the fades and a new circle starts from the player and does the same on a loop. It pushes enemies back and does little damage |

Stacking rules and exact numbers are tuning knobs — locked in code, not here.

---

## Enemies

| Enemy          | Shape    | Behavior                                                              |
|----------------|----------|-----------------------------------------------------------------------|
| Chaser         | Triangle | Wanders until aggro radius, then straight-line chases.                |
| Tank           | Square   | Slower, higher HP, bigger knockback on contact.                       |
| Boss (Phase 5) | Hexagon  | Spawns at ~2-min intervals. Stops to fire 8-projectile radial bursts. |

Damage is collision-based — overlap deducts HP, both parties recoil to prevent
single-frame drain.

---

## Spawner

- Server-tick equivalent (client-side until Phase 7). Every ~1s, evaluate
  `targetEnemyCount(runTime)` vs alive count. Top up the difference.
- Spawns occur **off-camera** around the player, on a ring just past the
  viewport edge.
- Difficulty curve is a function of `runTime`: target count grows roughly
  linearly, enemy stats grow in steps every ~30s. Bosses are scheduled events,
  not random.

---

## Controls

**Desktop:**

- WASD = move.
- Mouse position = aim direction (auto-attack fires in that direction).
- Esc = pause.

**Mobile / touch:**

- Left thumb virtual joystick = move.
- Right thumb virtual joystick = aim.
- Aim joystick at rest = auto-aim at nearest enemy.
- Top-right pause button.

Aim and move are independent on both platforms (twin-stick).

---

## HUD layout

```
┌──────────────────────────────────────────────┐
│ HP ▓▓▓▓▓░░  Lv 4         00:43   Boss in 1:17│
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
│ XP ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────────────┘
```

- HP / level top-left, run timer + next-boss countdown top-right.
- XP bar full-width along the bottom (so eye doesn't have to leave the action).
- Pause + level-up modals overlay the canvas.

---

## Architecture sketch

Modeled on `thewargame/`. Pixi lives in `pixi/`, Angular signals + services
hold mutable state, components render HUD on top of the canvas.

```
src/rogue-lite/                          (rename from rouge-lite/ in Phase 0)
├── rogue-lite.md
├── IMPLEMENTATION_PLAN.md
├── project-idea.md                      (historical)
├── shell/
│   └── shell.component.ts               (lobby ⇄ in-run switch)
├── components/
│   ├── game-canvas/                     (PixiJS host)
│   ├── hud/
│   │   ├── status-bar/
│   │   ├── xp-bar/
│   │   ├── run-timer/
│   │   ├── level-up-modal/
│   │   └── virtual-joystick/            (touch-only)
│   └── run-over/
├── pixi/
│   ├── game-renderer.ts                 (Pixi App + main stage)
│   ├── camera.ts
│   ├── entities/
│   │   ├── player.ts
│   │   ├── enemy.ts
│   │   ├── xp-gem.ts
│   │   └── projectile.ts                (Phase 5 / boss radial-burst)
│   └── systems/
│       ├── input.ts                     (unified WASD + mouse + touch)
│       ├── spawner.ts
│       ├── collision.ts
│       └── knockback.ts
├── services/
│   ├── run.service.ts                   (start/end/reset, run time)
│   ├── game-state.service.ts            (signals: hp, xp, level, paused)
│   ├── upgrades.service.ts              (pool + roll-3 + apply)
│   └── input.service.ts                 (Angular surface for touch HUD)
├── data/
│   ├── upgrades-knight.ts
│   ├── enemies.ts
│   └── waves.ts
└── models/
    └── entity.types.ts
```

The pixi side is plain TS (no Angular dependency) so it can be ported to a
worker or to the server in Phase 7 without rewrites.

---

## What we are intentionally not doing (yet)

- **Client-side prediction + reconciliation.** Co-op among friends at low tick
  feels fine without it.
- **Pathfinding.** Straight-line chase is enough for arena enemies.
- **Persistent save data.** Pure per-run, no localStorage.
- **Sound design.** Not in scope until polish phase.
- **Sprite art.** Shapes only; visual upgrades come last.
- **PvP / friendly fire.** Co-op only.

If/when any of these come back, they need a new entry in this table or an ADR.
