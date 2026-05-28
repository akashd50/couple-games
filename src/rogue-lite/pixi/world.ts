import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { KnightPlayer, Player } from './entities/player';
import { Enemy } from './entities/enemy';
import { Chaser } from './entities/chaser';
import { Tank } from './entities/tank';
import { HexBoss } from './entities/hex-boss';
import { XpGem } from './entities/xp-gem';
import { CameraSystem } from './systems/camera-system';
import { SpawnerSystem } from './systems/spawner-system';
import { BossSpawnerSystem } from './systems/boss-spawner-system';
import { LevelSystem } from './systems/level-system';
import { ProjectileSystem } from './systems/projectile-system';
import { DeathParticleSystem } from './effects/death-particle';
import { InputManager } from './input-manager';
import { ALL_UPGRADES } from './upgrades/upgrade-registry';
import {
    ArenaConsts, ChaserConsts, EnemyLevelConsts, TankConsts, HexBossConsts,
    KnightConsts, ProjectileConsts, SimConsts, VfxConsts,
} from './constants';
import { wrapAngle } from './common-utils';
import type { Vec2, WorldCallbacks } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager, callbacks);
 *   world.destroy();   // when done
 *
 * Phase 5 additions over Phase 4:
 *   - enemies: Enemy[]  (replaces chasers: Chaser[] — unified for Chaser/Tank/HexBoss)
 *   - ProjectileSystem  — boss radial bursts target the player
 *   - BossSpawnerSystem — fires a HexBoss at 120s, 240s, …
 *   - DeathParticleSystem — particle burst on every enemy death
 *   - CameraSystem.shake() — triggered when boss hits the player
 *   - Boss-death reward: XP-gem burst + player heal
 */
export class World {
    private readonly player: Player;
    /** All regular enemies (Chasers + Tanks).  Boss is tracked separately. */
    private readonly enemies: Enemy[] = [];
    /** Active boss — null if not yet spawned or already dead this interval. */
    private boss: HexBoss | null = null;
    private readonly gems: XpGem[] = [];
    private readonly camera: CameraSystem;
    private readonly worldRoot: Container;

    // ── Layers (bottom → top) ─────────────────────────────────────────────────
    private readonly gemLayer: Container;
    private readonly enemyLayer: Container;
    private readonly projectileLayer: Container;
    private readonly particleLayer: Container;

    // ── Systems ───────────────────────────────────────────────────────────────
    private readonly spawner: SpawnerSystem;
    private readonly bossSpawner: BossSpawnerSystem;
    private readonly levelSystem: LevelSystem;
    private readonly projectileSystem: ProjectileSystem;
    private readonly deathParticles: DeathParticleSystem;

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

        this.particleLayer = new Container();
        this.particleLayer.label = 'particles';
        worldRoot.addChild(this.particleLayer);

        this.enemyLayer = new Container();
        this.enemyLayer.label = 'enemies';
        worldRoot.addChild(this.enemyLayer);

        this.projectileLayer = new Container();
        this.projectileLayer.label = 'projectiles';
        worldRoot.addChild(this.projectileLayer);

        const playerLayer = new Container();
        playerLayer.label = 'players';
        worldRoot.addChild(playerLayer);

        // ── Entities ───────────────────────────────────────────────────────
        this.player = new KnightPlayer(playerLayer);
        this.camera = new CameraSystem(worldRoot, ArenaConsts.SIZE / 2, ArenaConsts.SIZE / 2);

        // ── Systems ────────────────────────────────────────────────────────
        this.spawner = new SpawnerSystem((x, y, type) => {
            const level = EnemyLevelConsts.levelFromTime(this._runTime);
            if (type === 'tank') {
                this.enemies.push(new Tank(this.enemyLayer, x, y, level));
            } else {
                this.enemies.push(new Chaser(this.enemyLayer, x, y, level));
            }
        });

        this.bossSpawner = new BossSpawnerSystem();

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

        this.projectileSystem = new ProjectileSystem(this.projectileLayer);
        this.deathParticles   = new DeathParticleSystem(this.particleLayer);

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
        for (const e of this.enemies) e.destroy();
        this.enemies.length = 0;
        this.boss?.destroy();
        this.boss = null;
        for (const gem of this.gems) gem.destroy();
        this.gems.length = 0;
        this.projectileSystem.destroy();
        this.deathParticles.destroy();
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
        this.player.tryAttack(dt, aimAngle);

        // ── Player movement ────────────────────────────────────────────────
        this.player.update(dt, move, aimAngle);

        const pp = this.player.position;
        const pr = this.player.radius;

        // ── Spawner ────────────────────────────────────────────────────────
        this.spawner.update(dt, this._runTime, this.enemies.length, pp.x, pp.y);

        // ── Boss spawner ───────────────────────────────────────────────────
        this.bossSpawner.update(
            this._runTime,
            this.boss !== null && !this.boss.isDead,
            pp.x, pp.y,
            (x, y) => this.spawnBoss(x, y),
        );

        // ── Regular enemy updates + player-enemy collisions ────────────────
        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            enemy.update(dt, pp.x, pp.y);

            // Player ↔ Enemy contact
            const dx = pp.x - enemy.posX;
            const dy = pp.y - enemy.posY;
            const dist = Math.hypot(dx, dy);

            if (dist < pr + enemy.radius) {
                const nx = dist > 0.001 ? dx / dist : 1;
                const ny = dist > 0.001 ? dy / dist : 0;
                this.player.takeDamage(
                    enemy.contactDamage,
                    nx * enemy.contactKnockback,
                    ny * enemy.contactKnockback,
                );
            }

            // Player attacks → enemy
            const hitInfo = this.player.checkHit(enemy);
            if (hitInfo.success) {
                enemy.takeDamage(hitInfo.damage, hitInfo.knockback.x, hitInfo.knockback.y);
                this.player.healFromDamageDealt(hitInfo.damage);
            }
        }

        // ── Boss update + collisions ───────────────────────────────────────
        if (this.boss && !this.boss.isDead) {
            this.boss.update(dt, pp.x, pp.y);

            // Boss body ↔ player contact
            const bdx = pp.x - this.boss.posX;
            const bdy = pp.y - this.boss.posY;
            const bdist = Math.hypot(bdx, bdy);
            if (bdist < pr + this.boss.radius) {
                const nx = bdist > 0.001 ? bdx / bdist : 1;
                const ny = bdist > 0.001 ? bdy / bdist : 0;
                const hit = this.player.takeDamage(
                    this.boss.contactDamage,
                    nx * this.boss.contactKnockback,
                    ny * this.boss.contactKnockback,
                );
                if (hit) {
                    this.camera.shake(VfxConsts.SHAKE_INTENSITY, VfxConsts.SHAKE_DURATION);
                }
            }

            // Player attacks → boss
            const bossHit = this.player.checkHit(this.boss);
            if (bossHit.success) {
                this.boss.takeDamage(bossHit.damage, bossHit.knockback.x, bossHit.knockback.y);
                this.player.healFromDamageDealt(bossHit.damage);
            }
        }

        // ── Boss projectiles ↔ player ──────────────────────────────────────
        this.projectileSystem.update(
            dt,
            pp.x, pp.y, pr,
            (kbx, kby, damage) => {
                const hit = this.player.takeDamage(damage, kbx, kby);
                if (hit) {
                    this.camera.shake(VfxConsts.SHAKE_INTENSITY * 0.6, VfxConsts.SHAKE_DURATION * 0.7);
                }
                return hit;
            },
        );

        // ── Death particles update ─────────────────────────────────────────
        this.deathParticles.update(dt);

        // ── Remove dead regular enemies + drop gems + particles ────────────
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isDead) {
                this.onEnemyDeath(enemy);
                enemy.destroy();
                this.enemies.splice(i, 1);
            }
        }

        // ── Handle dead boss ───────────────────────────────────────────────
        if (this.boss?.isDead) {
            this.onBossDeath(this.boss);
            this.boss.destroy();
            this.boss = null;
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

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Spawn a HexBoss at the current enemy level and wire its projectile callback. */
    private spawnBoss(x: number, y: number): void {
        const level = EnemyLevelConsts.levelFromTime(this._runTime);
        this.boss = new HexBoss(this.enemyLayer, x, y, level, (bx, by, dx, dy) => {
            this.projectileSystem.add({
                x: bx, y: by,
                dx, dy,
                speed: ProjectileConsts.SPEED,
                damage: ProjectileConsts.DAMAGE,
                knockback: ProjectileConsts.KNOCKBACK,
                radius: ProjectileConsts.RADIUS,
                color: ProjectileConsts.COLOR,
                lifetime: ProjectileConsts.LIFETIME,
            });
        });
    }

    /**
     * Handle the death of a regular enemy (Chaser or Tank):
     *   - Emit death particles (color varies by type).
     *   - Drop xpDropCount XP gems at the death position.
     */
    private onEnemyDeath(enemy: Enemy): void {
        const color = enemy instanceof Tank ? TankConsts.COLOR : ChaserConsts.COLOR;
        this.deathParticles.emitBurst(
            enemy.posX, enemy.posY,
            color,
            VfxConsts.DEATH_PARTICLE_COUNT,
        );

        for (let i = 0; i < enemy.xpDropCount; i++) {
            // Scatter gems slightly around the death point
            const angle   = (Math.PI * 2 * i) / enemy.xpDropCount;
            const scatter = 18;
            this.gems.push(new XpGem(
                this.gemLayer,
                enemy.posX + Math.cos(angle) * scatter,
                enemy.posY + Math.sin(angle) * scatter,
                enemy.xpGemValue,
            ));
        }
    }

    /**
     * Handle boss death:
     *   - Large particle burst.
     *   - XP-gem burst scattered around the corpse.
     *   - Immediate player heal.
     */
    private onBossDeath(boss: HexBoss): void {
        this.deathParticles.emitBurst(
            boss.posX, boss.posY,
            HexBossConsts.OUTLINE_COLOR,
            VfxConsts.BOSS_DEATH_PARTICLE_COUNT,
            6,   // larger particles
            300, // higher speed
        );

        // Scatter XP gems in a ring — value is level-scaled via boss.xpGemValue
        const gemCount = HexBossConsts.XP_DROP_COUNT;
        for (let i = 0; i < gemCount; i++) {
            const angle   = (Math.PI * 2 * i) / gemCount;
            const scatter = VfxConsts.BOSS_GEM_SCATTER_RADIUS * (0.6 + Math.random() * 0.8);
            this.gems.push(new XpGem(
                this.gemLayer,
                boss.posX + Math.cos(angle) * scatter,
                boss.posY + Math.sin(angle) * scatter,
                boss.xpGemValue,
            ));
        }

        // Heal player
        this.player.healBy(HexBossConsts.HEAL_ON_KILL);
        this.callbacks.onHpChange?.(this.player.hp, this.player.maxHp);
    }
}
