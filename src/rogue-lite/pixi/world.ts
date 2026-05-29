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
import { PlayerClass, Vec2, WorldCallbacks } from './types';
import { WorldData } from "./systems/world-data";
import { Entity } from "./entities/entity";
import { Minion } from "./entities/knight-minion";

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
    private accumulator = 0;
    private lastAim = new Vec2(1, 0);
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
                this.projectileLayer
            );
        } else {
            this.player = new KnightPlayer(playerLayer);
        }

        this.lastNotifiedHp = this.player.hp;

        // ── Corpse system (Summoner only) ──────────────────────────────────
        WorldData.corpseSystem = playerClass === 'summoner'
            ? new CorpseSystem(this.corpseLayer)
            : null;

        this.camera = new CameraSystem(worldRoot, ArenaConsts.SIZE / 2, ArenaConsts.SIZE / 2);

        // ── Systems ────────────────────────────────────────────────────────
        this.spawner = new SpawnerSystem((x, y, type) => {
            const level = EnemyLevelConsts.levelFromTime(this._runTime);
            if (type === 'tank') {
                WorldData.enemies.push(new Tank(this.enemyLayer, x, y, level));
            } else {
                WorldData.enemies.push(new Chaser(this.enemyLayer, x, y, level));
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
        WorldData.deathParticles = new DeathParticleSystem(this.particleLayer);

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

            this.camera.update(rawDt, this.player.getPosition(), this.lastAim, host.clientWidth, host.clientHeight);
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
        for (const e of WorldData.enemies) e.destroy();
        WorldData.enemies.length = 0;
        WorldData.boss?.destroy();
        WorldData.boss = null;
        for (const gem of this.gems) gem.destroy();
        this.gems.length = 0;
        this.projectileSystem.destroy();
        WorldData.deathParticles.destroy();
        WorldData.corpseSystem?.destroy();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /** One fixed-timestep simulation step. */
    private tick(dt: number): void {
        if (this.runEnded || this.isPaused) return;

        // Resolve player screen position for aim input
        const wp = this.player.getPosition();
        const playerScreenX = wp.x + this.worldRoot.position.x;
        const playerScreenY = wp.y + this.worldRoot.position.y;

        const { move, aim } = this.inputManager.read(playerScreenX, playerScreenY);
        this.lastAim = aim;
        const aimAngle = Math.atan2(aim.y, aim.x);

        // ── Player auto-attack ─────────────────────────────────────────────
        this.player.tryAttack(dt, aimAngle);

        // ── Player movement ────────────────────────────────────────────────
        this.player.update(dt, move, aimAngle);

        const pp = this.player.getPosition();
        const pr = this.player.getRadius();

        // ── Spawner ────────────────────────────────────────────────────────
        this.spawner.update(dt, this._runTime, WorldData.enemies.length, pp.x, pp.y);

        // ── Boss spawner ───────────────────────────────────────────────────
        this.bossSpawner.update(
            this._runTime,
            WorldData.boss && !WorldData.boss.isDead,
            pp.x, pp.y,
            (x, y) => this.spawnBoss(x, y),
        );

        // ── Live minions (needed before enemy loop for nearest-entity targeting) ──
        // Re-used below in the Summoner section without an extra filter pass.
        const liveMinions: Minion[] = this.player instanceof SummonerPlayer
            ? this.player.minionSystem.getLiveMinions()
            : [];

        // ── Regular enemy updates + player-enemy collisions ────────────────
        for (const enemy of WorldData.enemies) {
            if (enemy.isDead) continue;

            // Enemies target the nearest entity — player or any live minion —
            // so minions naturally act as meatshields.
            let targetX = pp.x;
            let targetY = pp.y;
            if (liveMinions.length > 0) {
                let minDist = Math.hypot(pp.x - enemy.getPosition().x, pp.y - enemy.getPosition().y);
                for (const m of liveMinions) {
                    const md = Math.hypot(...enemy.getPosition().to(m.getPosition()).list());
                    if (md < minDist) {
                        minDist = md;
                        targetX = m.getPosition().x;
                        targetY = m.getPosition().y;
                    }
                }
            }
            enemy.update(dt, targetX, targetY);

            // Player ↔ Enemy contact
            const dx = pp.x - enemy.getPosition().x;
            const dy = pp.y - enemy.getPosition().y;
            const dist = Math.hypot(dx, dy);

            if (dist < pr + enemy.getRadius()) {
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
        if (WorldData.boss && !WorldData.boss.isDead) {
            // Boss also targets the nearest entity (player or live minion)
            let bossTargetX = pp.x;
            let bossTargetY = pp.y;
            if (liveMinions.length > 0) {
                let minBossDist = Math.hypot(pp.x - WorldData.boss.getPosition().x, pp.y - WorldData.boss.getPosition().y);
                for (const m of liveMinions) {
                    const md = Math.hypot(...WorldData.boss.getPosition().to(m.getPosition()).list());
                    if (md < minBossDist) {
                        minBossDist = md;
                        bossTargetX = m.getPosition().x;
                        bossTargetY = m.getPosition().y;
                    }
                }
            }
            WorldData.boss.update(dt, bossTargetX, bossTargetY);

            // Boss body ↔ player contact
            const bdx = pp.x - WorldData.boss.getPosition().x;
            const bdy = pp.y - WorldData.boss.getPosition().y;
            const bdist = Math.hypot(bdx, bdy);
            if (bdist < pr + WorldData.boss.getRadius()) {
                const nx = bdist > 0.001 ? bdx / bdist : 1;
                const ny = bdist > 0.001 ? bdy / bdist : 0;
                const hit = this.player.takeDamage(
                    WorldData.boss.contactDamage,
                    nx * WorldData.boss.contactKnockback,
                    ny * WorldData.boss.contactKnockback,
                );
                if (hit) {
                    this.camera.shake(VfxConsts.SHAKE_INTENSITY, VfxConsts.SHAKE_DURATION);
                }
            }

            // Player attacks → boss (melee / resolvers)
            const bossHit = this.player.checkHit(WorldData.boss);
            if (bossHit.success) {
                WorldData.boss.takeDamage(bossHit.damage, bossHit.knockback.x, bossHit.knockback.y);
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
        WorldData.corpseSystem?.update(dt);

        // ── Collision separation (push overlapping entities apart) ────────────
        this.separateEntities();

        // ── Death particles update ─────────────────────────────────────────
        WorldData.deathParticles.update(dt);

        // ── Remove dead regular enemies + drop gems + particles ────────────
        for (let i = WorldData.enemies.length - 1; i >= 0; i--) {
            const enemy = WorldData.enemies[i];
            if (enemy.isDead) {
                this.onEnemyDeath(enemy);
                enemy.destroy();
                WorldData.enemies.splice(i, 1);
            }
        }

        // ── Handle dead boss ───────────────────────────────────────────────
        if (WorldData.boss?.isDead) {
            this.onBossDeath(WorldData.boss);
            WorldData.boss.destroy();
            WorldData.boss = null;
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
        WorldData.boss = new HexBoss(this.enemyLayer, x, y, level, (bx, by, dx, dy) => {
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
        const pos = enemy.getPosition();
        const color = enemy instanceof Tank ? TankConsts.COLOR : ChaserConsts.COLOR;
        WorldData.deathParticles.emitBurst(
            pos.x, pos.y,
            color,
            VfxConsts.DEATH_PARTICLE_COUNT,
        );

        for (let i = 0; i < enemy.xpDropCount; i++) {
            const angle = (Math.PI * 2 * i) / enemy.xpDropCount;
            const scatter = 18;
            this.gems.push(new XpGem(
                this.gemLayer,
                pos.x + Math.cos(angle) * scatter,
                pos.y + Math.sin(angle) * scatter,
                enemy.xpGemValue,
            ));
        }

        // Summoner: leave a corpse for minion summoning.
        // Chaser enemies → ChaserMinion; Tank / unknown → KnightMinion.
        const corpseType = enemy instanceof Chaser ? 'chaser' : 'knight';
        WorldData.corpseSystem?.addCorpse(pos.x, pos.y, enemy.level, corpseType);
    }

    /**
     * Handle boss death:
     *   - Large particle burst.
     *   - XP-gem burst scattered around the corpse.
     *   - Immediate player heal.
     *   - (Summoner) Spawn a high-level corpse.
     */
    private onBossDeath(boss: HexBoss): void {
        const pos = boss.getPosition();
        WorldData.deathParticles.emitBurst(
            pos.x, pos.y,
            HexBossConsts.OUTLINE_COLOR,
            VfxConsts.BOSS_DEATH_PARTICLE_COUNT,
            6,
            300,
        );

        const gemCount = HexBossConsts.XP_DROP_COUNT;
        for (let i = 0; i < gemCount; i++) {
            const angle = (Math.PI * 2 * i) / gemCount;
            const scatter = VfxConsts.BOSS_GEM_SCATTER_RADIUS * (0.6 + Math.random() * 0.8);
            this.gems.push(new XpGem(
                this.gemLayer,
                pos.x + Math.cos(angle) * scatter,
                pos.y + Math.sin(angle) * scatter,
                boss.xpGemValue,
            ));
        }

        this.player.healBy(HexBossConsts.HEAL_ON_KILL);
        this.callbacks.onHpChange?.(this.player.hp, this.player.maxHp);

        // Summoner: the boss corpse grants a high-level KnightMinion
        WorldData.corpseSystem?.addCorpse(pos.x, pos.y, boss.level, 'knight');
    }

    // ── Collision separation ──────────────────────────────────────────────────

    /**
     * Push-apart pass run once per sim tick after all entity movement.
     *
     * Pairs resolved (3 iterations each for stability):
     *   enemy  ↔ enemy       — equal push
     *   enemy  ↔ boss        — enemy absorbs 90 %, boss 10 % (boss is heavy)
     *   minion ↔ minion      — equal push
     *   minion ↔ enemy       — equal push
     *   minion ↔ boss        — minion absorbs 90 %, boss 10 %
     *   player ↔ enemy       — equal push; player position synced immediately
     *   player ↔ boss        — player absorbs 70 %, boss 30 %
     *
     * Enemies and minions have posX/posY mutated directly; the sprite lags at
     * most one tick (≈16 ms at 60 fps — imperceptible).  The player sprite is
     * synced in the same frame via Player.nudge().
     */
    private separateEntities(): void {
        const ITERS = 3;

        const liveEnemies = WorldData.enemies.filter(e => !e.isDead);
        const boss: HexBoss | null = (WorldData.boss && !WorldData.boss.isDead) ? WorldData.boss : null;

        // Collect live minions when the player is a Summoner.
        const liveMinions: Minion[] = [];
        if (this.player instanceof SummonerPlayer) {
            liveMinions.push(...this.player.minionSystem.getLiveMinions());
        }

        // Proxy object lets us feed the player into pushApart without exposing
        // protected posX/posY, then apply the net delta at the end.
        const pp = this.player.getPosition();

        for (let iter = 0; iter < ITERS; iter++) {
            // ── Enemy ↔ Enemy ──────────────────────────────────────────────
            for (let i = 0; i < liveEnemies.length; i++) {
                for (let j = i + 1; j < liveEnemies.length; j++) {
                    World.pushApart(liveEnemies[i], liveEnemies[j], 0.5);
                }
            }

            // ── Enemy ↔ Boss ───────────────────────────────────────────────
            if (boss) {
                for (const e of liveEnemies) {
                    World.pushApart(e, boss, 0.9); // boss barely yields
                }
            }

            // ── Minion ↔ Minion ────────────────────────────────────────────
            for (let i = 0; i < liveMinions.length; i++) {
                for (let j = i + 1; j < liveMinions.length; j++) {
                    World.pushApart(liveMinions[i], liveMinions[j], 0.5);
                }
            }

            // ── Minion ↔ Enemy ─────────────────────────────────────────────
            for (const minion of liveMinions) {
                for (const enemy of liveEnemies) {
                    World.pushApart(minion, enemy, 0.5);
                }
            }

            // ── Minion ↔ Boss ──────────────────────────────────────────────
            if (boss) {
                for (const minion of liveMinions) {
                    World.pushApart(minion, boss, 0.9);
                }
            }

            // ── Player ↔ Enemy ─────────────────────────────────────────────
            for (const enemy of liveEnemies) {
                World.pushApart(this.player, enemy, 0.5);
            }

            // ── Player ↔ Boss ──────────────────────────────────────────────
            if (boss) {
                World.pushApart(this.player, boss, 0.7);
            }
        }

        // Apply accumulated player delta (nudge handles arena clamping + sprite sync).
        const pdx = this.player.getPosition().x - pp.x;
        const pdy = this.player.getPosition().y - pp.y;
        if (Math.abs(pdx) + Math.abs(pdy) > 0.001) {
            this.player.nudge(pdx, pdy);
        }

        // Clamp enemies and minions to arena bounds after separation.
        const S = ArenaConsts.SIZE;
        for (const e of liveEnemies) {
            const pos = e.getPosition();
            pos.set(Math.max(e.getRadius(), Math.min(S - e.getRadius(), pos.x)), Math.max(e.getRadius(), Math.min(S - e.getRadius(), pos.y)));
        }
        if (boss) {
            const pos = boss.getPosition();
            pos.set(Math.max(boss.getRadius(), Math.min(S - boss.getRadius(), pos.x)), Math.max(boss.getRadius(), Math.min(S - boss.getRadius(), pos.y)));
        }
        for (const m of liveMinions) {
            m.getPosition().x = Math.max(m.getRadius(), Math.min(S - m.getRadius(), m.getPosition().x));
            m.getPosition().y = Math.max(m.getRadius(), Math.min(S - m.getRadius(), m.getPosition().y));
        }
    }

    /**
     * Resolve overlap between two circular entities.
     *
     * @param a       First entity (posX, posY, radius — all public/mutable).
     * @param b       Second entity.
     * @param shareA  Fraction of the overlap depth pushed onto `a`.
     *                `b` absorbs the remaining (1 − shareA).
     */
    private static pushApart(
        a: Entity,
        b: Entity,
        shareA: number,
    ): void {
        const posA = a.getPosition();
        const posB = b.getPosition();
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.getRadius() + b.getRadius();
        if (dist >= minDist) return;   // not overlapping

        const depth = minDist - dist;
        // Normal pointing from a → b; fall back to +x when perfectly coincident.
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;

        posA.set(-nx * depth * shareA, -ny * depth * shareA);
        posB.set(nx * depth * (1 - shareA), ny * depth * (1 - shareA));
    }
}
