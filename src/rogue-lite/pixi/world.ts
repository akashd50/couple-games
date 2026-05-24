import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { KnightPlayer, Player } from './entities/player';
import { Chaser } from './entities/chaser';
import { CameraSystem } from './systems/camera-system';
import { isInAttackCone } from './systems/attack-system';
import { InputManager } from './input-manager';
import { ArenaConsts, ChaserConsts, KnightConsts, SimConsts } from './constants';
import type { Vec2, WorldCallbacks } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager, callbacks);
 *   // ... run plays ...
 *   world.destroy();
 */
export class World {
    private readonly player: Player;
    private readonly chasers: Chaser[] = [];
    private readonly camera: CameraSystem;
    private readonly enemyLayer: Container;

    private accumulator = 0;
    private lastAim: Vec2 = { x: 1, y: 0 };
    private _runTime = 0;
    private runEnded = false;
    private lastNotifiedHp = KnightConsts.hp;

    private readonly tickerFn: () => void;

    constructor(
        private readonly app: Application,
        worldRoot: Container,
        host: HTMLElement,
        private readonly inputManager: InputManager,
        private readonly callbacks: WorldCallbacks = {},
    ) {
        // ── Layers (bottom → top) ──────────────────────────────────────────
        worldRoot.addChild(buildArena());

        this.enemyLayer = new Container();
        this.enemyLayer.label = 'enemies';
        worldRoot.addChild(this.enemyLayer);

        const playerLayer = new Container();
        playerLayer.label = 'players';
        worldRoot.addChild(playerLayer);

        // ── Entities ───────────────────────────────────────────────────────
        this.player = new KnightPlayer(playerLayer);
        this.camera = new CameraSystem(worldRoot, ArenaConsts.SIZE / 2, ArenaConsts.SIZE / 2);
        this.spawnChasers();

        // ── Ticker ─────────────────────────────────────────────────────────
        this.tickerFn = () => {
            const rawDt = app.ticker.deltaMS / 1000;

            // Advance run time (wall-clock; stops when run ends)
            if (!this.runEnded) {
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

    destroy(): void {
        this.app.ticker.remove(this.tickerFn);
        this.player.destroy();
        for (const chaser of this.chasers) chaser.destroy();
        this.chasers.length = 0;
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /** Spawn {@link ChaserConsts.SPAWN_COUNT} enemies distributed around the arena centre. */
    private spawnChasers(): void {
        for (let i = 0; i < ChaserConsts.SPAWN_COUNT; i++) {
            // Spread evenly by angle, randomise radius
            const angle = (i / ChaserConsts.SPAWN_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
            const dist = 600 + Math.random() * 900;
            const rawX = ArenaConsts.SIZE / 2 + Math.cos(angle) * dist;
            const rawY = ArenaConsts.SIZE / 2 + Math.sin(angle) * dist;
            const margin = 40;
            const x = Math.max(margin, Math.min(ArenaConsts.SIZE - margin, rawX));
            const y = Math.max(margin, Math.min(ArenaConsts.SIZE - margin, rawY));
            this.chasers.push(new Chaser(this.enemyLayer, x, y));
        }
    }

    /** One fixed-timestep simulation step. */
    private tick(dt: number): void {
        if (this.runEnded) return;

        const { move, aim } = this.inputManager.read();
        this.lastAim = aim;
        const aimAngle = Math.atan2(aim.y, aim.x);

        // Player auto-attack: advance cooldown; non-null return = new swing started
        this.player.tryAttack(dt, aimAngle);

        // Player movement
        this.player.update(dt, move, aimAngle);

        const pp = this.player.position;
        const pr = this.player.radius;

        // Enemy updates + collisions
        for (const chaser of this.chasers) {
            if (chaser.isDead) continue;

            chaser.update(dt, pp.x, pp.y);

            // ── Player ↔ Chaser overlap ────────────────────────────────────
            const dx = pp.x - chaser.posX;
            const dy = pp.y - chaser.posY;
            const dist = Math.hypot(dx, dy);

            if (dist < pr + chaser.radius) {
                // Direction from chaser toward player (push player away)
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
                // Knock the chaser away from the player
                chaser.takeDamage(hitInfo.damage, hitInfo.knockback.x, hitInfo.knockback.y);
            }
        }

        // Remove dead chasers (iterate backwards to splice safely)
        for (let i = this.chasers.length - 1; i >= 0; i--) {
            if (this.chasers[i].isDead) {
                this.chasers[i].destroy();
                this.chasers.splice(i, 1);
            }
        }

        // ── Check player death ─────────────────────────────────────────────
        if (this.player.isDead) {
            this.runEnded = true;
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
