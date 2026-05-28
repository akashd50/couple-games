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

✅ **Phase 2 complete** (2026-05-24)

---

## Phase 3 — Spawner + XP loop + level-up

**Goal:** the actual rogue-lite shape — XP → choose-1-of-3 → repeat.

- Spawner: every ~1s, top up enemies up to `targetCount(runTime)`. Spawns
  occur on a ring just past the camera viewport.
- XP gems drop on enemy death. Walk over to collect (or attract via radius).
- XP-level curve. Level-up pauses the sim, shows a 3-upgrade modal.
- Implement 3 starter upgrades to validate the system: Flurry (cooldown),
  Juggernaut (HP + size), Magnet (pickup radius).
- Make the powerup system easily extendable, such that in the future we can
  build upgrade trees and choose upgrades that build on top of each other, or
  some upgrades that appear conditionally when certain conditions are met whether its
  level or existence of certain things.
- HUD: XP bar (top of the screen) should be above the hp bar and extend the full length of display, contains the level
  in the center, Lv N indicator.

**Done when:** you can survive several minutes, hit Lv 5+, and your build
visibly changes how the Knight plays.

✅ **Phase 3 complete** (2026-05-24)

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

✅ **Phase 5 complete** (2026-05-27)

**New files:**

- `pixi/entities/enemy.ts` — abstract `Enemy` base class (posX/posY, vx/vy, flashTimer, applyKnockback)
- `pixi/entities/tank.ts` — blue-purple square; slow/tanky, first appears at 60s
- `pixi/entities/hex-boss.ts` — hexagon boss; CHARGE→TELEGRAPH→BURST→RECOVER FSM, fires 8-way projectiles
- `pixi/entities/projectile.ts` — generic projectile entity (reusable for Phase 6 Summoner)
- `pixi/systems/projectile-system.ts` — manages active projectiles with pluggable hit handler
- `pixi/systems/boss-spawner-system.ts` — spawns boss at 120s/240s/…, one alive at a time
- `pixi/effects/death-particle.ts` — radial particle burst on enemy death

**Key architecture change:** All resolvers/effects now use `Enemy` (not `Chaser`) for hit-set and checkHit.
`Resolver.hitSet: Set<Enemy>`, `Effect.isInRange(enemy: Enemy)`, `Player.checkHit(enemy: Enemy)`.

**New constants:** `TankConsts`, `HexBossConsts`, `BossSpawnerConsts`, `ProjectileConsts`, `VfxConsts`

---

## Phase 6 — Summoner class + class select

**Goal:** real class variety; the second pillar of the design.

- Class-select step on run start (lobby → choose class → start).
- `Summoner` entity: ranged projectile auto-attack (small triangle bullets glowy looking to make them feel like magic,
  should leave a faint trail that dissipates quickly).
- Corpse system: enemies leave a fading corpse node for a few seconds on death (only visible to summoner + they also
  leave the xp gems).
- Minion mechanic: Summoner secondary consumes nearby corpses → friendly
  `Minion` entity (small square) that auto-engages nearest enemy. Always shows a circular area around the summoner (it
  should be a dark violet'ish color, dark line around the edge and translucent glowy area) and
  on a fixed cooldown it will consume corpses to summon minions. The summons stats are based on the dead enemy and its
  level. If the capacity is full, it will kill the least powerful minion (minions will have a constant level derived
  from the level of the enemy that spawned the minion)
- Summoner upgrade pool (~6 upgrades): Legion (+minion cap), Empowered Undead,
  Explosive Demise, Vampiric Link, etc.
- Minion AI: follow Summoner, peel off to attack within range, respawn cap.
- Another vibe addition, summoner should leave a light purple dust clouds as she walks (dissipate quickly, maybe
  circular clouds that reduce in size/alpha overtime)
- Knight should emit similar dust clouds as he walks.

**Done when:** Summoner is fully playable end-to-end, has its own build space,
and reads visually distinct from Knight in the arena.

✅ **Phase 6 complete** (2026-05-27)

**New files:**

- `pixi/effects/dust-cloud.ts` — `DustCloudSystem`: puff particle emitter used by both Knight and Summoner while walking
- `pixi/entities/corpse.ts` — `Corpse`: fading disc left on enemy death; consumed by Summoner's minion system
- `pixi/entities/minion.ts` — `Minion`: friendly purple-square unit; level-scaled HP + damage; FOLLOW / ATTACK AI states
- `pixi/systems/corpse-system.ts` — `CorpseSystem`: manages active Corpse nodes, provides range-sorted lookup
- `pixi/systems/minion-system.ts` — `MinionSystem`: minion pool + auto-summon cooldown; owned by SummonerPlayer
- `pixi/entities/summoner-player.ts` — `SummonerPlayer extends Player`: ranged triangle projectiles with trail, orbiting dots, summon area ring, dust clouds, minion upgrade stubs

**Key architecture changes:**

- **Class-select screen** added to `GameCanvasComponent`: shown on run start, triggers `startGame(playerClass)` which then inits Pixi — renderer/world are never created until the player has chosen.
- **`Player` base**: `_baseSpeed` protected field (replacing hard-coded `KnightConsts.speed` in `update()`); `_prevPosX/_prevPosY` for dust delta; no-op upgrade stubs (`multiplyProjCooldown`, `addProjDamage`, `addMinionCap`, `addSummonRadius`, `addMinionLifesteal`, `empowerMinions`) so typed `UpgradeDefinition.apply(player)` compiles without casts.
- **`Enemy` abstract contract** extended with `abstract readonly level: number`; Chaser / Tank / HexBoss each implement `get level()`.
- **`Projectile` + `ProjectileSpec`** extended with optional `shape: 'circle' | 'triangle'` and `trailColor`; triangle bullets draw via `drawTriangle()` and record a trailing dot ring buffer.
- **`ProjectileSystem`** gains `updateAgainstEnemies(dt, enemies, onHit)` — used by Summoner's player-owned `playerProjectileSystem` to hit enemies.
- **`UpgradeDefinition`** gains optional `playerClass?: PlayerClass` field; `LevelSystem.rollChoices()` filters by class so Knight-only and Summoner-only upgrades never cross.
- **`World`** conditionally creates `CorpseSystem` (Summoner only), `minionLayer` container, and `playerProjectileSystem`; `lastNotifiedHp` init reads `this.player.hp` instead of a hard-coded constant; `onEnemyDeath` / `onBossDeath` feed `corpseSystem?.addCorpse(...)`.
- **`GameRenderer`** stores `currentClass`, exposes `getStartHp()`, threads class into `World` + `restart()`.

**New constants:** `SummonerConsts`, `MinionConsts`, `CorpseConsts`, `SummonAreaConsts`, `DustCloudConsts`

**Summoner upgrade pool (6 upgrades):** Legion (+minion cap), Spectral Haste (proj cooldown), Arcane Barrage (+proj damage), Expanded Grave (+summon radius), Vampiric Link (+minion lifesteal), Empowered Undead (requires Legion → +proj count +minion cap)

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
