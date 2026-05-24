import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { Player } from './entities/player';
import { Chaser } from './entities/chaser';
import { CameraSystem } from './systems/camera-system';
import { isInAttackCone } from './systems/attack-system';
import { InputManager } from './input-manager';
import {
    ARENA_SIZE,
    ATTACK_DAMAGE,
    ATTACK_KNOCKBACK,
    CHASER_HIT_DAMAGE,
    CHASER_KNOCKBACK,
    CHASER_SPAWN_COUNT,
    FIXED_STEP,
    MAX_ACCUMULATED_TIME,
    PLAYER_HP,
} from './constants';
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
    private lastNotifiedHp = PLAYER_HP;

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
        this.player = new Player(playerLayer);
        this.camera = new CameraSystem(worldRoot, ARENA_SIZE / 2, ARENA_SIZE / 2);
        this.spawnChasers();

        // ── Ticker ─────────────────────────────────────────────────────────
        this.tickerFn = () => {
            const rawDt = app.ticker.deltaMS / 1000;

            // Advance run time (wall-clock; stops when run ends)
            if (!this.runEnded) {
                this._runTime += rawDt;

                const cappedDt = Math.min(rawDt, MAX_ACCUMULATED_TIME);
                this.accumulator += cappedDt;
                while (this.accumulator >= FIXED_STEP) {
                    this.accumulator -= FIXED_STEP;
                    this.tick(FIXED_STEP);
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
    get runTime(): number { return this._runTime; }

    destroy(): void {
        this.app.ticker.remove(this.tickerFn);
        this.player.destroy();
        for (const chaser of this.chasers) chaser.destroy();
        this.chasers.length = 0;
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /** Spawn CHASER_SPAWN_COUNT enemies distributed around the arena centre. */
    private spawnChasers(): void {
        for (let i = 0; i < CHASER_SPAWN_COUNT; i++) {
            // Spread evenly by angle, randomise radius
            const angle = (i / CHASER_SPAWN_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
            const dist  = 600 + Math.random() * 900;
            const rawX  = ARENA_SIZE / 2 + Math.cos(angle) * dist;
            const rawY  = ARENA_SIZE / 2 + Math.sin(angle) * dist;
            const margin = 40;
            const x = Math.max(margin, Math.min(ARENA_SIZE - margin, rawX));
            const y = Math.max(margin, Math.min(ARENA_SIZE - margin, rawY));
            this.chasers.push(new Chaser(this.enemyLayer, x, y));
        }
    }

    /** One fixed-timestep simulation step. */
    private tick(dt: number): void {
        if (this.runEnded) return;

        const { move, aim } = this.inputManager.read();
        this.lastAim = aim;
        const aimAngle = Math.atan2(aim.y, aim.x);

        // Player auto-attack check (before movement update)
        const attackAngle = this.player.tryAttack(dt, aimAngle);

        // Player movement
        this.player.update(dt, move, aimAngle);

        const pp = this.player.position;
        const pr = this.player.radius;

        // Enemy updates + collisions
        for (const chaser of this.chasers) {
            if (chaser.isDead) continue;

            chaser.update(dt, pp.x, pp.y);

            // ── Player ↔ Chaser overlap ────────────────────────────────────
            const dx   = pp.x - chaser.posX;
            const dy   = pp.y - chaser.posY;
            const dist = Math.hypot(dx, dy);

            if (dist < pr + chaser.radius) {
                // Direction from chaser toward player (push player away)
                const nx = dist > 0.001 ? dx / dist : 1;
                const ny = dist > 0.001 ? dy / dist : 0;
                this.player.takeDamage(
                    CHASER_HIT_DAMAGE,
                    nx * CHASER_KNOCKBACK,
                    ny * CHASER_KNOCKBACK,
                );
            }

            // ── Sword cone hit check ───────────────────────────────────────
            if (attackAngle !== null) {
                if (isInAttackCone(pp.x, pp.y, attackAngle, chaser.posX, chaser.posY, chaser.radius)) {
                    // Knock the chaser away from the player
                    const dx2 = chaser.posX - pp.x;
                    const dy2 = chaser.posY - pp.y;
                    const d2  = Math.hypot(dx2, dy2);
                    const kbx = d2 > 0.001 ? (dx2 / d2) * ATTACK_KNOCKBACK : ATTACK_KNOCKBACK;
                    const kby = d2 > 0.001 ? (dy2 / d2) * ATTACK_KNOCKBACK : 0;
                    chaser.takeDamage(ATTACK_DAMAGE, kbx, kby);
                }
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
