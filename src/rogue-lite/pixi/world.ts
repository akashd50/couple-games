import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { KnightPlayer, Player } from './entities/player';
import { Chaser } from './entities/chaser';
import { XpGem } from './entities/xp-gem';
import { CameraSystem } from './systems/camera-system';
import { SpawnerSystem } from './systems/spawner-system';
import { LevelSystem } from './systems/level-system';
import { ShockwaveEffect } from './effects/shockwave-effect';
import { ShockwaveResolver } from './entities/shockwave-resolver';
import { AftershockResolver } from './entities/aftershock-resolver';
import { AuraResolver } from './entities/aura-resolver';
import { InputManager } from './input-manager';
import { ALL_UPGRADES } from './upgrades/upgrade-registry';
import { ArenaConsts, ChaserConsts, KnightConsts, SimConsts, SpawnerConsts } from './constants';
import { wrapAngle } from './common-utils';
import type { Vec2, WorldCallbacks } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager, callbacks);
 *   world.destroy();   // when done
 *
 * Attack world-effects:
 *   After player.update() each tick, this class iterates player.resolvers and
 *   handles world-space effects by resolver type:
 *     ShockwaveResolver   → fireShockwave() on consumePending()
 *     AftershockResolver  → fireShockwave() on consumePending()
 *     AuraResolver        → damage + knockback enemies inside the swept radius band
 *
 *   All other per-entity hit detection uses player.checkHit(chaser) which
 *   delegates to each resolver's checkHit() implementation.
 */
export class World {
    private readonly player: Player;
    private readonly chasers: Chaser[] = [];
    private readonly gems: XpGem[] = [];
    private readonly camera: CameraSystem;
    private readonly worldRoot: Container;

    private readonly enemyLayer: Container;
    private readonly gemLayer: Container;

    private readonly spawner: SpawnerSystem;
    private readonly levelSystem: LevelSystem;

    private accumulator = 0;
    private lastAim: Vec2 = { x: 1, y: 0 };
    private _runTime = 0;
    private runEnded = false;
    private isPaused = false;
    private lastNotifiedHp = KnightConsts.hp;

    private readonly tickerFn: () => void;

    getLevelSystem(): LevelSystem {
        return this.levelSystem;
    }

    constructor(
        private readonly app: Application,
        worldRoot: Container,
        host: HTMLElement,
        private readonly inputManager: InputManager,
        private readonly callbacks: WorldCallbacks = {},
    ) {
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
            const ramps = Math.floor(this._runTime / SpawnerConsts.COUNT_RAMP_INTERVAL);
            const hpMult = 1 + ramps * ChaserConsts.HP_RAMP_PER_INTERVAL;
            const speedMult = 1 + ramps * ChaserConsts.SPEED_RAMP_PER_INTERVAL;
            this.chasers.push(new Chaser(this.enemyLayer, x, y, { hpMult, speedMult }));
        });

        this.levelSystem = new LevelSystem(
            ALL_UPGRADES,
            (level, choices) => {
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

            if (!this.runEnded && !this.isPaused) {
                this._runTime += rawDt;
                const cappedDt = Math.min(rawDt, SimConsts.MAX_ACCUMULATED_TIME);
                this.accumulator += cappedDt;
                while (this.accumulator >= SimConsts.FIXED_STEP) {
                    this.accumulator -= SimConsts.FIXED_STEP;
                    this.tick(SimConsts.FIXED_STEP);
                }
            }

            this.camera.update(rawDt, this.player.position, this.lastAim,
                host.clientWidth, host.clientHeight);
        };

        app.ticker.add(this.tickerFn);
    }

    get runTime(): number {
        return this._runTime;
    }

    /**
     * Apply the chosen upgrade and resume the simulation.
     * Called by GameRenderer after the Angular component relays the player's pick.
     */
    selectUpgrade(id: string): void {
        if (this.runEnded) return;
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
        if (this.runEnded || this.isPaused) return;

        // Resolve player screen position for aim input
        const wp = this.player.position;
        const playerScreenX = wp.x + this.worldRoot.position.x;
        const playerScreenY = wp.y + this.worldRoot.position.y;

        const { move, aim } = this.inputManager.read(playerScreenX, playerScreenY);
        this.lastAim = aim;
        const aimAngle = Math.atan2(aim.y, aim.x);

        // ── Player auto-attack ─────────────────────────────────────────────
        // Fires the swing; SwingAttackResolver callbacks chain to
        // ShockwaveResolver (and optionally AftershockResolver) synchronously.
        this.player.tryAttack(dt, aimAngle);

        // ── Player movement ────────────────────────────────────────────────
        // issueUpdate() ticks all resolver update() methods, which advances
        // the AftershockResolver timer and the AuraResolver phase.
        this.player.update(dt, move, aimAngle);

        const pp = this.player.position;
        const pr = this.player.radius;

        // ── Spawner ────────────────────────────────────────────────────────
        this.spawner.update(dt, this._runTime, this.chasers.length, pp.x, pp.y);

        // ── Enemy updates + collisions ─────────────────────────────────────
        for (const chaser of this.chasers) {
            if (chaser.isDead) continue;

            chaser.update(dt, pp.x, pp.y);

            // Player ↔ Chaser contact
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
                this.player.healFromDamageDealt(hitInfo.damage);
            }
        }

        // ── Remove dead chasers + drop XP gems ────────────────────────────
        for (let i = this.chasers.length - 1; i >= 0; i--) {
            if (this.chasers[i].isDead) {
                const c = this.chasers[i];
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
            if (collected) this.levelSystem.addXp(gem.value);
        }

        for (let i = this.gems.length - 1; i >= 0; i--) {
            if (this.gems[i].isCollected) this.gems.splice(i, 1);
        }

        // ── Player death ───────────────────────────────────────────────────
        if (this.player.isDead) {
            this.runEnded = true;
            this.isPaused = false;
            this.callbacks.onRunEnd?.();
            return;
        }

        // ── HP change notification ─────────────────────────────────────────
        const currentHp = this.player.hp;
        const currentMaxHp = this.player.maxHp;
        if (currentHp !== this.lastNotifiedHp) {
            this.lastNotifiedHp = currentHp;
            this.callbacks.onHpChange?.(currentHp, currentMaxHp);
        }
    }
}
