# Rogue-Lite — Implementation Plan

Phased plan that takes the design in `rogue-lite.md` from the current stub
(lobby + empty shell) to a polished co-op runner. Each phase is intended to
end in a **playable build** — no phase leaves the game in a broken state.

Locked decisions live in `rogue-lite.md`; this file is the sequencing.

---

## Phase 0 — Foundation cleanup

**Goal:** clean slate for the rest of the work. No gameplay yet.

- Rename `src/rouge-lite/` → `src/rogue-lite/` (fix the typo while it's
  cheap). Update the route in `src/app/app.routes.ts:35` and the import in
  the shell component.
- Restructure folders to match the layout in `rogue-lite.md`.
- Drop a basic `<game-canvas>` component that mounts a PixiJS `Application`
  with a dark background and a "Hello, world" sprite, so the Pixi loop is
  alive end-to-end.
- Verify the existing lobby still renders.

**Done when:** `/rogue-lite` shows the lobby, hitting "ready" reveals a black
Pixi canvas, no console errors.

---

## Phase 1 — Player + arena + camera

**Goal:** a Knight you can drive around a bounded arena.

- Bounded arena: square play area (e.g. 4000×4000), grid background drawn in
  Pixi `Graphics`.
- `Player` entity (Knight): circle with a small shield arc showing facing.
- Camera follows player, slight lookahead toward aim direction.
- Unified input system:
  - Desktop: WASD move, mouse position = aim.
  - Touch: detect via pointer events; show two virtual joysticks (HTML overlay
    components, not Pixi) — left = move, right = aim.
- Game loop runs at Pixi's ticker; fixed-timestep sim step inside.

**Done when:** you can drive Knight around the arena on both desktop and
mobile, hitting the arena boundary stops you cleanly.

---

## Phase 2 — Combat + first enemies + HP

**Goal:** something to fight, something that can kill you.

- Knight auto-attacks on cooldown — 60° cone sword arc in aim direction.
  Visualize the arc each swing.
- `Chaser` enemy (triangle): wanders idle → aggro at distance → straight-line
  chase. Spawn a handful manually for now.
- Circle-vs-circle collision system.
- HP on player and enemies. Damage on overlap (player ↔ enemy) and on attack
  arc hit. Both sides get knockback recoil.
- HUD: HP bar, run timer.
- Run-over state: HP ≤ 0 → "Run ended" modal with restart + back-to-lobby.

**Done when:** you can kill enemies, enemies can kill you, and you can start
a new run.

---

## Phase 3 — Spawner + XP loop + level-up

**Goal:** the actual rogue-lite shape — XP → choose-1-of-3 → repeat.

- Spawner: every ~1s, top up enemies up to `targetCount(runTime)`. Spawns
  occur on a ring just past the camera viewport.
- XP gems drop on enemy death. Walk over to collect (or attract via radius).
- XP-level curve. Level-up pauses the sim, shows a 3-upgrade modal.
- Implement 3 starter upgrades to validate the system: Flurry (cooldown),
  Juggernaut (HP + size), Magnet (pickup radius).
- HUD: XP bar (bottom of screen), Lv N indicator.

**Done when:** you can survive several minutes, hit Lv 5+, and your build
visibly changes how the Knight plays.

---

## Phase 4 — Full Knight upgrade pool + tuning

**Goal:** the run has real build variety.

- Implement the remaining Knight upgrades from `rogue-lite.md`: Wide Cleave,
  Iron Skin, Lifesteal, Shockwave, Aftershock.
- Stackable upgrades vs. one-shots distinction in the pool data.
- Roller logic: filter out fully-stacked, weight the offer, surface synergy
  hints (e.g. don't offer Aftershock until Shockwave is owned).
- First difficulty pass: enemy stat ramp every ~30s.

**Done when:** two different upgrade paths feel distinctly different to
play, and a clean run reaches ~5 minutes without trivializing the game.

---

## Phase 5 — Variety + boss + game feel

**Goal:** the run loop has highs and lows, not just a flat grind.

- Second enemy: `Tank` (square) — slower, higher HP, larger knockback on you.
- Boss: `Hexagon`, spawns at fixed timestamps (~2 min cadence). Pattern:
  periodic stops to fire 8-projectile radial bursts; charges between bursts.
- Projectile system (needed for the boss; foundation for Summoner later).
- Game feel: hit flash, screenshake on boss hits, particle bursts on enemy
  death.
- Boss-defeat XP burst + a small heal.

**Done when:** the second-minute boss arrives, has a learnable pattern, and
killing it feels satisfying.

---

## Phase 6 — Summoner class + class select

**Goal:** real class variety; the second pillar of the design.

- Class-select step on run start (lobby → choose class → start).
- `Summoner` entity: ranged projectile auto-attack (small triangle bullets).
- Corpse system: enemies leave a fading corpse node for a few seconds on death.
- Minion mechanic: Summoner secondary consumes nearby corpses → friendly
  `Minion` entity (small square) that auto-engages nearest enemy.
- Summoner upgrade pool (~6 upgrades): Legion (+minion cap), Empowered Undead,
  Explosive Demise, Vampiric Link, etc.
- Minion AI: follow Summoner, peel off to attack within range, respawn cap.

**Done when:** Summoner is fully playable end-to-end, has its own build space,
and reads visually distinct from Knight in the arena.

---

## Phase 7 — Co-op multiplayer (up to 4)

**Goal:** play this with up to 3 friends.

- Server-side game loop tick (~10 Hz) running the sim authoritatively in
  `server/`. Port `pixi/systems/` (collision, spawner, knockback) into shared
  TS so server can run it headless.
- Socket events: `rogue:input` (client → server), `rogue:state` (server →
  client at 10 Hz).
- Client renders interpolated remote players + enemies.
- Lobby readyup → all players in same world.
- Shared XP-gem visibility, per-player level + upgrades.
- Drop-in / drop-out handling.
- Revive mechanic for downed allies (replaces game-over until team wipes).

**Open question for this phase (defer):** is XP shared or per-player on
pickup? Decide when we get here based on Phase 4 tuning.

**Done when:** 4 players can join a room, fight together, level up
independently, and a single-player disconnect doesn't break the run.

---

## Phase 8 (stretch) — Polish

- Sound design (attack swing, hits, level-up, boss roar).
- Sprite art beyond shapes if a style emerges.
- Mobile UX polish — joystick deadzones, button hit targets, performance
  budget on low-end Android.
- Accessibility — colorblind-friendly enemy palette, larger HUD text option.

---

## Cross-phase notes

- **Dev-only debug UI** uses `isDevMode()` gating, per the convention in
  `memory/feedback_dev_only_debug_tooling.md`. Spawn-rate sliders, entity
  inspectors, etc., must not ship to prod.
- **Pixi code stays Angular-free** so Phase 7 can reuse it server-side.
- **Each phase ends playable.** No phase should leave the game broken on the
  main branch.
