import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { ArenaConsts, KnightConsts, PhysicsConsts, XpGemConsts } from '../constants';
import { AttackResolver, getAttackResolver, HitInfo } from "./attacks";
import { Chaser } from "./chaser";

/**
 * Abstract base for all player classes.
 *
 * Upgrade-facing mutator API — safe to call from upgrade definitions:
 *   addMaxHp(n)               — Juggernaut: grow max HP and heal immediately
 *   addRadiusBonus(n)         — Juggernaut: grow collision/visual radius
 *   addMagnetRadius(n)        — Magnet: expand XP-gem attraction range
 *   multiplyAttackCooldown(f) — Flurry: multiply all cooldowns by factor f
 */
export abstract class Player {
    protected readonly container: Container;
    protected posX: number;
    protected posY: number;

    // ── Knockback velocity ────────────────────────────────────────────────────
    protected vx = 0;
    protected vy = 0;

    // ── HP ────────────────────────────────────────────────────────────────────
    protected _hp: number;
    protected _maxHp: number;
    /** Remaining invincibility seconds after a hit. */
    protected iframes = 0;
    protected attackResolvers: AttackResolver[] = [];

    // ── Upgrade-mutable stats ─────────────────────────────────────────────────
    /** Extra radius added by Juggernaut stacks. */
    protected _radiusBonus = 0;
    /** Gem pickup radius — player must step within this range to collect. */
    protected _pickupRadius = XpGemConsts.BASE_PICKUP_RADIUS;
    /** Magnet attraction range (0 = no attraction). Grown by the Magnet upgrade. */
    protected _magnetRadius = 0;
    /** Product of all Flurry cooldown multipliers applied so far. */
    protected _cooldownMult = 1;

    constructor(parent: Container) {
        this.posX = ArenaConsts.SIZE / 2;
        this.posY = ArenaConsts.SIZE / 2;
        this._hp = KnightConsts.hp;
        this._maxHp = KnightConsts.hp;

        this.container = new Container();
        this.container.label = 'player';
        this.container.position.set(this.posX, this.posY);
        parent.addChild(this.container);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get position(): Vec2 {
        return { x: this.posX, y: this.posY };
    }

    get hp(): number {
        return this._hp;
    }

    get maxHp(): number {
        return this._maxHp;
    }

    /** Current collision and visual radius; grows with Juggernaut stacks. */
    get radius(): number {
        return KnightConsts.radius + this._radiusBonus;
    }

    get pickupRadius(): number { return this._pickupRadius; }
    get magnetRadius(): number { return this._magnetRadius; }

    get isDead(): boolean {
        return this._hp <= 0;
    }

    // ── Upgrade mutators ─────────────────────────────────────────────────────

    /** Increase max HP and immediately heal the same amount (Juggernaut). */
    addMaxHp(amount: number): void {
        this._maxHp += amount;
        this._hp = Math.min(this._hp + amount, this._maxHp);
    }

    /**
     * Grow collision and visual radius by `amount` (Juggernaut).
     * Triggers `onRadiusChanged()` so subclasses can redraw body graphics.
     */
    addRadiusBonus(amount: number): void {
        this._radiusBonus += amount;
        this.onRadiusChanged();
    }

    /** Expand the XP-gem magnet range by `amount` (Magnet). */
    addMagnetRadius(amount: number): void {
        this._magnetRadius += amount;
    }

    /**
     * Multiply all attack resolver cooldowns by `factor` (Flurry).
     * Immediately propagated to every attached `AttackResolver`.
     */
    multiplyAttackCooldown(factor: number): void {
        this._cooldownMult *= factor;
        for (const r of this.attackResolvers) {
            r.setCooldownMult(this._cooldownMult);
        }
    }

    // ── Public methods ───────────────────────────────────────────────────────

    /**
     * Check whether an auto-attack should fire this tick.
     * Must be called ONCE per tick, before update().
     */
    tryAttack(dt: number, aimAngle: number): number {
        return undefined;
    }

    /**
     * Simulate one physics step.
     * @param dt       Fixed sim delta (seconds).
     * @param move     Normalised movement vector from input.
     * @param aimAngle Current aim angle (radians).
     */
    update(dt: number, move: Vec2, aimAngle: number): void {
        // ── Timers ──────────────────────────────────────────────────────────
        if (this.iframes > 0) {
            this.iframes = Math.max(0, this.iframes - dt);
        }

        this.issueUpdate(dt, move, aimAngle);

        // ── Knockback decay ─────────────────────────────────────────────────
        const friction = Math.exp(-PhysicsConsts.KNOCKBACK_FRICTION * dt);
        this.vx *= friction;
        this.vy *= friction;

        // ── Position ────────────────────────────────────────────────────────
        this.posX += (move.x * KnightConsts.speed + this.vx) * dt;
        this.posY += (move.y * KnightConsts.speed + this.vy) * dt;

        // Use current (upgrade-affected) radius for arena clamping
        const r = this.radius;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);

        // ── Visuals ──────────────────────────────────────────────────────────
        this.draw(dt, move, aimAngle);

        // Flash while in iframes: rapid alpha toggle
        this.container.alpha = this.iframes > 0
            ? (Math.sin(this.iframes * 30) > 0 ? 0.3 : 1.0)
            : 1.0;
    }

    public checkHit(chaser: Chaser): HitInfo {
        return undefined;
    }

    protected abstract issueUpdate(dt: number, move: Vec2, aimAngle: number): void;

    protected abstract draw(dt: number, move: Vec2, aimAngle: number): void;

    /**
     * Called whenever `_radiusBonus` changes (i.e. Juggernaut was picked).
     * Subclasses override to redraw body graphics at the new radius.
     */
    protected onRadiusChanged(): void { /* override in subclass */ }

    /**
     * Apply a hit — only lands if iframes are not active.
     * @param amount  HP to remove.
     * @param kbx     X knockback impulse (world units/s).
     * @param kby     Y knockback impulse.
     * @returns true if the hit landed.
     */
    takeDamage(amount: number, kbx: number, kby: number): boolean {
        if (this.iframes > 0 || this._hp <= 0) return false;
        this._hp = Math.max(0, this._hp - amount);
        this.iframes = KnightConsts.iframesAfterDamage;
        this.vx += kbx;
        this.vy += kby;
        return true;
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}

export class KnightPlayer extends Player {
    /** Stored so it can be redrawn when radius changes (Juggernaut). */
    private body: Graphics;
    private readonly arcGfx: Graphics;

    constructor(parent: Container) {
        super(parent);

        this.attackResolvers.push(getAttackResolver(KnightConsts.autoAttack));
        this.container.addChild(...this.attackResolvers.flatMap(a => a.getGfx()));

        // Body circle — stored for redraw on radius change
        this.body = new Graphics();
        this.drawBody();
        this.container.addChild(this.body);

        // Shield arc — redrawn every sim tick
        this.arcGfx = new Graphics();
        this.container.addChild(this.arcGfx);

        this.drawShieldArc(0);
    }

    override tryAttack(dt: number, aimAngle: number): number {
        for (const a of this.attackResolvers) {
            a.tryAttack(dt, aimAngle);
        }
        return 0;
    }

    override checkHit(chaser: Chaser): HitInfo {
        const hitInfo = new HitInfo();
        for (const a of this.attackResolvers) {
            hitInfo.add(a.checkHit(this, chaser));
        }
        return hitInfo;
    }

    protected override onRadiusChanged(): void {
        this.drawBody();
    }

    protected override issueUpdate(dt: number, move: Vec2, aimAngle: number): void {
        for (const a of this.attackResolvers) {
            a.update(dt, move, aimAngle);
        }
    }

    protected override draw(dt: number, move: Vec2, aimAngle: number) {
        this.drawShieldArc(aimAngle);
        for (const a of this.attackResolvers) {
            a.draw(dt, move, aimAngle);
        }
    }

    private drawBody(): void {
        this.body.clear();
        this.body.circle(0, 0, this.radius).fill({ color: KnightConsts.color });
    }

    private drawShieldArc(aimAngle: number): void {
        const g = this.arcGfx;
        g.clear();
        const arcR = this.radius + 6;
        const start = aimAngle - KnightConsts.SHIELD_ARC_HALF;
        const end = aimAngle + KnightConsts.SHIELD_ARC_HALF;
        // arc() after clear() starts a fresh path — no stray line from origin.
        g.arc(0, 0, arcR, start, end);
        g.stroke({ color: KnightConsts.SHIELD_COLOR, width: 3, alpha: 1 });
    }
}
