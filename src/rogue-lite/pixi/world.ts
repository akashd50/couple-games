import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { KnightPlayer, Player } from './entities/player';
import { SummonerPlayer } from './entities/summoner-player';
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
import { CorpseSystem } from './systems/corpse-system';
import { DeathParticleSystem } from './effects/death-particle';
import { InputManager } from './input-manager';
import { ALL_UPGRADES } from './upgrades/upgrade-registry';
import {
    ArenaConsts, ChaserConsts, EnemyLevelConsts, TankConsts, HexBossConsts,
    KnightConsts, ProjectileConsts, SimConsts, VfxConsts,
} from './constants';
import { wrapAngle } from './common-utils';
import type { PlayerClass, Vec2, WorldCallbacks } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager, callbacks, playerClass);
 *   world.destroy();   // when done
 *
 * Phase 6 additions over Phase 5:
 *   - playerClass param: 'knight' | 'summoner'
 *   - SummonerPlayer entity (ranged + minion army)
 *   - CorpseSystem: enemies leave fading nodes when Summoner is playing
 *   - MinionSystem (owned by SummonerPlayer): auto-summons minions from corpses
 *   - playerProjectileSystem: second ProjectileSystem for Summoner bullets → enemies
 *   - minionLayer: Container between enemyLayer and playerLayer
 *   - Dust-cloud VFX on both player classes (managed inside each Player subclass)
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
    private readonly corpseLayer: Container;   // corpses between gems and enemies
    private readonly enemyLayer: Container;
    private readonly minionLayer: Container;   // friendly minions above enemies
    private readonly projectileLayer: Container;
    private readonly particleLayer: Container;

    // ── Systems ───────────────────────────────────────────────────────────────
    private readonly spawner: SpawnerSystem;
    private readonly bossSpawner: BossSpawnerSystem;
    private readonly levelSystem: LevelSystem;
    private readonly projectileSystem: ProjectileSystem;        // enemy → player
    private readonly playerProjectileSystem: ProjectileSystem;  // Summoner → enemies
    private readonly deathParticles: DeathParticleSystem;
    /** Only created when playerClass === 'summoner'. */
    private readonly corpseSystem: CorpseSystem | null;

    private accumulator = 0;
    private lastAim: Vec2 = { x: 1, y: 0 };
    private _runTime = 0;
    private runEnded = false;
    private isPaused = false;
    private lastNotifiedHp: number;

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
        playerClass: PlayerClass = 'knight',
    ) {
        this.worldRoot = worldRoot;

        // ── Layers (bottom → top) ──────────────────────────────────────────
        worldRoot.addChild(buildArena());

        this.gemLayer = new Container();
        this.gemLayer.label = 'gems';
        worldRoot.addChild(this.gemLayer);

        this.corpseLayer = new Container();
        this.corpseLayer.label = 'corpses';
        worldRoot.addChild(this.corpseLayer);

        this.particleLayer = new Container();
        this.particleLayer.label = 'particles';
        worldRoot.addChild(this.particleLayer);

        this.enemyLayer = new Container();
        this.enemyLayer.label = 'enemies';
        worldRoot.addChild(this.enemyLayer);

        this.minionLayer = new Container();
        this.minionLayer.label = 'minions';
        worldRoot.addChild(this.minionLayer);

        this.projectileLayer = new Container();
        this.projectileLayer.label = 'projectiles';
        worldRoot.addChild(this.projectileLayer);

        const playerLayer = new Container();
        playerLayer.label = 'players';
        worldRoot.addChild(playerLayer);

        // ── Player ─────────────────────────────────────────────────────────
        if (playerClass === 'summoner') {
            this.player = new SummonerPlayer(
                playerLayer,
                this.minionLayer,
                (spec) => this.playerProjectileSystem.add(spec),
            );
        } else {
            this.player = new KnightPlayer(playerLayer);
        }

        this.lastNotifiedHp = this.player.hp;

        // ── Corpse system (Summoner only) ──────────────────────────────────
        this.corpseSystem = playerClass === 'summoner'
            ? new CorpseSystem(this.corpseLayer)
            : null;

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
            playerClass,
        );

        this.projectileSystem = new ProjectileSystem(this.projectileLayer);
        this.playerProjectileSystem = new ProjectileSystem(this.projectileLayer);
        this.deathParticles = new DeathParticleSystem(this.particleLayer);

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
        this.playerProjectileSystem.destroy();
        this.deathParticles.destroy();
        this.corpseSystem?.destroy();
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

            // Player attacks → enemy (melee / resolvers)
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

            // Player attacks → boss (melee / resolvers)
            const bossHit = this.player.checkHit(this.boss);
            if (bossHit.success) {
                this.boss.takeDamage(bossHit.damage, bossHit.knockback.x, bossHit.knockback.y);
                this.player.healFromDamageDealt(bossHit.damage);
            }
        }

        // ── Enemy projectiles (boss bursts) ↔ player ──────────────────────
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

        // ── Summoner-specific systems ──────────────────────────────────────
        if (this.player instanceof SummonerPlayer) {
            const summoner = this.player;
            const allEnemies: Enemy[] = [
                ...this.enemies,
                ...(this.boss && !this.boss.isDead ? [this.boss] : []),
            ];

            // Player projectiles → enemies
            this.playerProjectileSystem.updateAgainstEnemies(
                dt,
                allEnemies,
                (enemy, kbx, kby, damage) => {
                    if (enemy.isDead) return false;
                    enemy.takeDamage(damage, kbx, kby);
                    summoner.healFromDamageDealt(damage);
                    return true;
                },
            );

            // Corpse fading
            this.corpseSystem?.update(dt);

            // Auto-summon from nearby corpses
            if (this.corpseSystem) {
                summoner.minionSystem.trySummon(
                    dt,
                    pp.x, pp.y,
                    summoner.summonRadius,
                    this.corpseSystem,
                );
            }

            // Minion AI + lifesteal
            const minionDamage = summoner.minionSystem.update(dt, pp.x, pp.y, allEnemies);
            if (minionDamage > 0 && summoner.minionLifestealPct > 0) {
                summoner.healBy(minionDamage * summoner.minionLifestealPct);
            }
        }

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
     *   - (Summoner) Spawn a corpse node.
     */
    private onEnemyDeath(enemy: Enemy): void {
        const color = enemy instanceof Tank ? TankConsts.COLOR : ChaserConsts.COLOR;
        this.deathParticles.emitBurst(
            enemy.posX, enemy.posY,
            color,
            VfxConsts.DEATH_PARTICLE_COUNT,
        );

        for (let i = 0; i < enemy.xpDropCount; i++) {
            const angle   = (Math.PI * 2 * i) / enemy.xpDropCount;
            const scatter = 18;
            this.gems.push(new XpGem(
                this.gemLayer,
                enemy.posX + Math.cos(angle) * scatter,
                enemy.posY + Math.sin(angle) * scatter,
                enemy.xpGemValue,
            ));
        }

        // Summoner: leave a corpse for minion summoning
        this.corpseSystem?.addCorpse(enemy.posX, enemy.posY, enemy.level);
    }

    /**
     * Handle boss death:
     *   - Large particle burst.
     *   - XP-gem burst scattered around the corpse.
     *   - Immediate player heal.
     *   - (Summoner) Spawn a high-level corpse.
     */
    private onBossDeath(boss: HexBoss): void {
        this.deathParticles.emitBurst(
            boss.posX, boss.posY,
            HexBossConsts.OUTLINE_COLOR,
            VfxConsts.BOSS_DEATH_PARTICLE_COUNT,
            6,
            300,
        );

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

        this.player.healBy(HexBossConsts.HEAL_ON_KILL);
        this.callbacks.onHpChange?.(this.player.hp, this.player.maxHp);

        // Summoner: the boss corpse grants a high-level minion
        this.corpseSystem?.addCorpse(boss.posX, boss.posY, boss.level);
    }
}
