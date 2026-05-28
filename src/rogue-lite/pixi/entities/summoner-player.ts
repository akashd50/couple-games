import { Container, Graphics } from 'pixi.js';
import { DustCloudConsts, SummonAreaConsts, SummonerConsts } from '../constants';
import { Player } from './player';
import type { Vec2 } from '../types';
import type { ProjectileSpec } from './projectile';
import { DustCloudSystem } from '../effects/dust-cloud';
import { MinionSystem } from '../systems/minion-system';
import { ProjectileSystem } from "../systems/projectile-system";
import { Enemy } from "./enemy";
import { HitInfo } from "./attacks";
import { CorpseSystem } from "../systems/corpse-system";
import { WorldData } from "../systems/world-data";

/**
 * The Summoner player class.
 *
 * Combat style:
 *  - Ranged: fires glowing triangle projectiles toward the aim direction on a
 *    fixed cooldown (upgradeable via multiplyProjCooldown, addProjDamage, addProjCount).
 *  - Minion army: an ever-present violet summon-area disc shows the corpse-detection
 *    radius.  On a fixed cooldown the system auto-consumes the nearest corpse and
 *    raises a Minion.  Upgradeable via addMinionCap / addSummonRadius.
 *
 * Visual:
 *  - Purple circle body with a bright inner core and two orbiting dots.
 *  - Light purple dust puffs left in the Summoner's wake.
 *  - Dark-violet translucent disc around the Summoner showing the summon area.
 *
 * Upgrade-facing API (all stubs in Player base; full impl here):
 *   multiplyProjCooldown(f)  — faster shots (e.g. Spectral Haste: ×0.85/stack)
 *   addProjDamage(n)         — bonus flat damage (e.g. Arcane Barrage: +10/stack)
 *   addMinionCap(n)          — more simultaneous minions (Legion: +1/stack)
 *   addSummonRadius(n)       — wider corpse detection (Expanded Grave: +30/stack)
 *   addMinionLifesteal(pct)  — heal % of minion damage dealt (Vampiric Link)
 *   empowerMinions(factor)   — (future) multiply minion damage by factor
 */
export class SummonerPlayer extends Player {
    // ── Projectile attack stats ────────────────────────────────────────────────
    private projFireTimer = 0; // seconds until next shot (counts DOWN from cooldown)
    private _projCooldown = SummonerConsts.PROJ_COOLDOWN;
    private _projDamage = SummonerConsts.PROJ_DAMAGE;
    private _projCount = 1;
    /** Spread half-angle between extra projectiles when _projCount > 1. */
    private readonly PROJ_SPREAD = Math.PI / 14;

    // ── Summon stats ──────────────────────────────────────────────────────────
    private _summonRadius = SummonerConsts.SUMMON_RADIUS;

    // ── Minion lifesteal ──────────────────────────────────────────────────────
    private _minionLifestealPct = 0;

    // ── Minion system (lives here so upgrades can mutate cap directly) ────────
    readonly minionSystem: MinionSystem;

    // ── Pixi ──────────────────────────────────────────────────────────────────
    private body: Graphics;
    private readonly orbitGfx: Graphics;
    private readonly summonAreaGfx: Graphics;

    // ── Effects ───────────────────────────────────────────────────────────────
    private readonly dustSystem: DustCloudSystem;
    private orbitAngle = 0;
    private projectileSystem: ProjectileSystem;

    constructor(
        parent: Container,
        minionLayer: Container,
        projectileLayer: Container,
    ) {
        super(parent);
        this.projectileSystem = new ProjectileSystem(projectileLayer);

        // Override HP/speed from base (Summoner has different stats than Knight)
        this._hp = SummonerConsts.hp;
        this._maxHp = SummonerConsts.hp;
        this._baseSpeed = SummonerConsts.speed;

        // ── Minion system ─────────────────────────────────────────────────
        this.minionSystem = new MinionSystem(minionLayer, SummonerConsts.BASE_MINION_CAP);

        // ── Dust puffs ────────────────────────────────────────────────────
        this.dustSystem = new DustCloudSystem(
            this.backgroundFxContainer,
            DustCloudConsts.SUMMONER_COLOR,
        );

        // ── Summon area (world-space disc, drawn in backgroundFxContainer) ─
        this.summonAreaGfx = new Graphics();
        this.backgroundFxContainer.addChild(this.summonAreaGfx);

        // ── Body ──────────────────────────────────────────────────────────
        this.body = new Graphics();
        this.drawBody();
        this.container.addChild(this.body);

        // ── Orbit detail (two small dots that circle the body) ────────────
        this.orbitGfx = new Graphics();
        this.container.addChild(this.orbitGfx);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    override get radius(): number {
        return SummonerConsts.radius + this._radiusBonus;
    }

    get summonRadius(): number {
        return this._summonRadius;
    }

    get minionLifestealPct(): number {
        return this._minionLifestealPct;
    }

    // ── Upgrade mutators (override Player stubs) ──────────────────────────────

    override multiplyProjCooldown(factor: number): void {
        this._projCooldown *= factor;
    }

    override addProjDamage(amount: number): void {
        this._projDamage += amount;
    }

    /** +1 extra projectile per shot (spread in a fan). */
    addProjCount(n: number): void {
        this._projCount = Math.min(this._projCount + n, 5); // cap at 5-way spread
    }

    override addMinionCap(n: number): void {
        this.minionSystem.increaseCap(n);
    }

    override addSummonRadius(n: number): void {
        this._summonRadius += n;
    }

    override addMinionLifesteal(pct: number): void {
        this._minionLifestealPct += pct;
    }

    override healFromDamageDealt(damage: number): void {
        super.healFromDamageDealt(damage);

        if (this.minionLifestealPct <= 0) return;
        this.healBy(damage * this.minionLifestealPct);
    }

    // empowerMinions is deferred — MinionSystem would need a damage multiplier field

    // ── Core loop ────────────────────────────────────────────────────────────

    override checkHit(enemy: Enemy): HitInfo {
        const hitInfo = this.projectileSystem.checkHit(enemy);
        this.minionSystem.checkHit(enemy, hitInfo);
        return hitInfo;
    }

    override tryAttack(dt: number, aimAngle: number): void {
        this.projFireTimer = Math.max(0, this.projFireTimer - dt);
        if (this.projFireTimer > 0) return;
        this.projFireTimer = this._projCooldown;
        this.fireProjectiles(aimAngle);
    }

    protected override issueUpdate(dt: number, _move: Vec2, _aimAngle: number): void {
        this.orbitAngle += dt * 2.4; // rotate orbit dots
        this.projectileSystem.tUpdate(dt);

        this.minionSystem.update(dt, this.position.x, this.position.y, [...WorldData.enemies, ...(WorldData.boss ? [WorldData.boss] : [])]);
        this.minionSystem.trySummon(dt, this.position.x, this.position.y, this.summonRadius, WorldData.corpseSystem);
    }

    protected override draw(dt: number, _move: Vec2, _aimAngle: number): void {
        this.drawOrbit();
        this.drawSummonArea();

        // Dust puffs — speed from actual position delta
        const speed = dt > 0
            ? Math.hypot(this.position.x - this._prevPosX, this.position.y - this._prevPosY) / dt
            : 0;
        this.dustSystem.update(dt, this.position.x, this.position.y, speed);
    }

    protected override onRadiusChanged(): void {
        this.drawBody();
    }

    override destroy(): void {
        this.dustSystem.destroy();
        this.minionSystem.destroy();
        this.projectileSystem.destroy();
        super.destroy();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private fireProjectiles(aimAngle: number): void {
        // Fan out multiple projectiles symmetrically around the aim angle
        const halfSpread = ((this._projCount - 1) / 2) * this.PROJ_SPREAD;

        for (let i = 0; i < this._projCount; i++) {
            const angle = aimAngle - halfSpread + i * this.PROJ_SPREAD;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const spawnDist = this.radius + SummonerConsts.PROJ_RADIUS + 2;

            this.projectileSystem.add({
                x: this.position.x + dx * spawnDist,
                y: this.position.y + dy * spawnDist,
                dx, dy,
                speed: SummonerConsts.PROJ_SPEED,
                damage: this._projDamage,
                knockback: SummonerConsts.PROJ_KNOCKBACK,
                radius: SummonerConsts.PROJ_RADIUS,
                color: SummonerConsts.PROJ_COLOR,
                lifetime: SummonerConsts.PROJ_LIFETIME,
                trailColor: SummonerConsts.PROJ_TRAIL_COLOR,
                shape: 'triangle',
            });
        }
    }

    private drawBody(): void {
        const g = this.body;
        g.clear();
        const r = this.radius;
        // Soft outer glow
        g.circle(0, 0, r * 1.4).fill({ color: SummonerConsts.color, alpha: 0.11 });
        // Main disc
        g.circle(0, 0, r).fill({ color: SummonerConsts.color });
        // Bright inner core
        g.circle(0, 0, r * 0.38).fill({ color: 0xdd99ff, alpha: 0.80 });
    }

    private drawOrbit(): void {
        const g = this.orbitGfx;
        g.clear();
        const orbitR = this.radius + 9;
        const dotR = 3.5;
        // Two diametrically opposite dots
        for (let k = 0; k < 2; k++) {
            const a = this.orbitAngle + k * Math.PI;
            const x = Math.cos(a) * orbitR;
            const y = Math.sin(a) * orbitR;
            g.circle(x, y, dotR + 1.5).fill({ color: SummonerConsts.color, alpha: 0.22 });
            g.circle(x, y, dotR).fill({ color: 0xee99ff });
        }
    }

    private drawSummonArea(): void {
        const g = this.summonAreaGfx;
        g.clear();
        // Track player world position
        g.position.set(this.position.x, this.position.y);

        const r = this._summonRadius;
        // Translucent fill
        g.circle(0, 0, r).fill({
            color: SummonAreaConsts.COLOR,
            alpha: SummonAreaConsts.ALPHA,
        });
        // Dark violet outline ring
        g.circle(0, 0, r).stroke({
            color: SummonAreaConsts.OUTLINE_COLOR,
            width: 2,
            alpha: SummonAreaConsts.OUTLINE_ALPHA,
        });
    }
}
