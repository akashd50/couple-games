import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { KnightPlayer, Player } from './entities/player';
import { Chaser } from './entities/chaser';
import { XpGem } from './entities/xp-gem';
import { CameraSystem } from './systems/camera-system';
import { SpawnerSystem } from './systems/spawner-system';
import { LevelSystem } from './systems/level-system';
import { InputManager } from './input-manager';
import { ALL_UPGRADES } from './upgrades/upgrade-registry';
import { ArenaConsts, ChaserConsts, KnightConsts, SimConsts } from './constants';
import type { Vec2, WorldCallbacks } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager, callbacks);
 *   // ... run plays ...
 *   world.destroy();
 *
 * Phase 3 additions:
 *   - SpawnerSystem: tops up enemy count every second; ramps over time.
 *   - XpGem entities: drop on Chaser death; collected by walking over them.
 *   - LevelSystem: XP → level-up → 3-upgrade modal (sim pauses until pick).
 *   - isPaused: set on level-up, cleared when the player picks an upgrade.
 */
export class World {
    private readonly player: Player;
    private readonly chasers: Chaser[] = [];
    private readonly gems: XpGem[] = [];
    private readonly camera: CameraSystem;
    /** Retained so tick() can convert player world-pos → screen-pos for aim. */
    private readonly worldRoot: Container;

    private readonly enemyLayer: Container;
    private readonly gemLayer: Container;

    private readonly spawner: SpawnerSystem;
    private readonly levelSystem: LevelSystem;

    private accumulator = 0;
    private lastAim: Vec2 = { x: 1, y: 0 };
    private _runTime = 0;
    private runEnded = false;
    /** True while the sim is paused waiting for the player to pick an upgrade. */
    private isPaused = false;
    private lastNotifiedHp = KnightConsts.hp;

    private readonly tickerFn: () => void;

    constructor(
        private readonly app: Application,
        worldRoot: Container,
        host: HTMLElement,
        private readonly inputManager: InputManager,
        private readonly callbacks: WorldCallbacks = {},
    ) {
        // Retain worldRoot so tick() can resolve the player's screen position.
        this.worldRoot = worldRoot;

        // ── Layers (bottom → top) ──────────────────────────────────────────
        worldRoot.addChild(buildArena());

        this.gemLayer = new Container();
        this.gemLayer.label = 'gems';
        worldRoot.addChild(this.gemLayer);

        this.enemyLayer = new Container();
        this.enemyLayer.label = 'enemies';
        worldRoot.addChild(this.enemyLayer);

        const playerLayer = new Container();
        playerLayer.label = 'players';
        worldRoot.addChild(playerLayer);

        // ── Entities ───────────────────────────────────────────────────────
        this.player = new KnightPlayer(playerLayer);
        this.camera = new CameraSystem(worldRoot, ArenaConsts.SIZE / 2, ArenaConsts.SIZE / 2);

        // ── Systems ────────────────────────────────────────────────────────
        this.spawner = new SpawnerSystem((x, y) => {
            this.chasers.push(new Chaser(this.enemyLayer, x, y));
        });

        this.levelSystem = new LevelSystem(
            ALL_UPGRADES,
            (level, choices) => {
                // Pause the sim synchronously before notifying Angular
                this.isPaused = true;
                this.callbacks.onLevelUp?.(level, choices);
            },
            (xp, xpToNext, level) => {
                this.callbacks.onXpChange?.(xp, xpToNext, level);
            },
        );

        // ── Ticker ─────────────────────────────────────────────────────────
        this.tickerFn = () => {
            const rawDt = app.ticker.deltaMS / 1000;

            // Advance run time and sim only when running (not ended, not paused)
            if (!this.runEnded && !this.isPaused) {
                this._runTime += rawDt;

                const cappedDt = Math.min(rawDt, SimConsts.MAX_ACCUMULATED_TIME);
                this.accumulator += cappedDt;
                while (this.accumulator >= SimConsts.FIXED_STEP) {
                    this.accumulator -= SimConsts.FIXED_STEP;
                    this.tick(SimConsts.FIXED_STEP);
                }
            }

            // Camera runs every render frame for smooth interpolation
            this.camera.update(
                rawDt,
                this.player.position,
                this.lastAim,
                host.clientWidth,
                host.clientHeight,
            );
        };

        app.ticker.add(this.tickerFn);
    }

    /** Seconds elapsed since the run started. */
    get runTime(): number {
        return this._runTime;
    }

    /**
     * Apply the chosen upgrade and resume the simulation.
     * Called by GameRenderer after the Angular component relays the player's
     * selection from the level-up modal.
     */
    selectUpgrade(id: string): void {
        if (this.runEnded) return; // guard: don't act on stale modal events
        this.levelSystem.applyUpgrade(id, this.player);
        this.isPaused = false;
    }

    destroy(): void {
        this.app.ticker.remove(this.tickerFn);
        this.player.destroy();
        for (const chaser of this.chasers) chaser.destroy();
        this.chasers.length = 0;
        for (const gem of this.gems) gem.destroy();
        this.gems.length = 0;
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /** One fixed-timestep simulation step. */
    private tick(dt: number): void {
        // Defensive early-return — a level-up inside this frame can set
        // isPaused mid-loop; the next iteration will bail here.
        if (this.runEnded || this.isPaused) return;

        // Convert the player's world position to screen (CSS pixel) space using
        // the worldRoot offset the camera set on the previous render frame.
        // This keeps aim correct even when the camera is clamped at the arena
        // boundary and the player is no longer centred on screen.
        const wp = this.player.position;
        const playerScreenX = wp.x + this.worldRoot.position.x;
        const playerScreenY = wp.y + this.worldRoot.position.y;

        const { move, aim } = this.inputManager.read(playerScreenX, playerScreenY);
        this.lastAim = aim;
        const aimAngle = Math.atan2(aim.y, aim.x);

        // ── Player auto-attack ─────────────────────────────────────────────
        this.player.tryAttack(dt, aimAngle);

        // ── Player movement ────────────────────────────────────────────────
        this.player.update(dt, move, aimAngle);

        const pp = this.player.position;
        const pr = this.player.radius;

        // ── Spawner ────────────────────────────────────────────────────────
        this.spawner.update(dt, this._runTime, this.chasers.length, pp.x, pp.y);

        // ── Enemy updates + collisions ─────────────────────────────────────
        for (const chaser of this.chasers) {
            if (chaser.isDead) continue;

            chaser.update(dt, pp.x, pp.y);

            // Player ↔ Chaser overlap
            const dx = pp.x - chaser.posX;
            const dy = pp.y - chaser.posY;
            const dist = Math.hypot(dx, dy);

            if (dist < pr + chaser.radius) {
                const nx = dist > 0.001 ? dx / dist : 1;
                const ny = dist > 0.001 ? dy / dist : 0;
                this.player.takeDamage(
                    ChaserConsts.HIT_DAMAGE,
                    nx * ChaserConsts.KNOCKBACK,
                    ny * ChaserConsts.KNOCKBACK,
                );
            }

            const hitInfo = this.player.checkHit(chaser);
            if (hitInfo.success) {
                chaser.takeDamage(hitInfo.damage, hitInfo.knockback.x, hitInfo.knockback.y);
            }
        }

        // ── Remove dead chasers + drop XP gems ────────────────────────────
        for (let i = this.chasers.length - 1; i >= 0; i--) {
            if (this.chasers[i].isDead) {
                const c = this.chasers[i];
                // Drop gem before destroying so we still have the position
                this.gems.push(new XpGem(this.gemLayer, c.posX, c.posY));
                c.destroy();
                this.chasers.splice(i, 1);
            }
        }

        // ── XP gem updates ─────────────────────────────────────────────────
        const pickupR = this.player.pickupRadius;
        const magnetR = this.player.magnetRadius;

        for (const gem of this.gems) {
            if (gem.isCollected) continue;
            const collected = gem.update(dt, pp.x, pp.y, pickupR, magnetR);
            if (collected) {
                this.levelSystem.addXp(gem.value);
                // isPaused may now be true if a level-up triggered —
                // the defensive check at the top handles the next iteration.
            }
        }

        // Remove collected gems (containers already destroyed by XpGem.update)
        for (let i = this.gems.length - 1; i >= 0; i--) {
            if (this.gems[i].isCollected) {
                this.gems.splice(i, 1);
            }
        }

        // ── Check player death ─────────────────────────────────────────────
        if (this.player.isDead) {
            this.runEnded = true;
            this.isPaused = false; // dismiss any in-flight level-up
            this.callbacks.onRunEnd?.();
            return;
        }

        // ── Notify HP changes ──────────────────────────────────────────────
        const currentHp = this.player.hp;
        if (currentHp !== this.lastNotifiedHp) {
            this.lastNotifiedHp = currentHp;
            this.callbacks.onHpChange?.(currentHp);
        }
    }
}
