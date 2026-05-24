import { Color, Container, FillGradient, Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { ArenaConsts, KnightConsts, PhysicsConsts } from '../constants';
import { lerp } from "../common-utils";

/**
 * Knight player entity.
 *
 * Layer order inside container (bottom → top):
 *   swingGfx  — sword-swing arc (fades out)
 *   body      — white circle (static, drawn once)
 *   arcGfx    — blue shield arc (redrawn each tick)
 */
export abstract class Player {
    protected readonly container: Container;
    protected posX: number;
    protected posY: number;

    // Knockback velocity components (decay each tick)
    protected vx = 0;
    protected vy = 0;

    // HP
    protected _hp: number;
    protected readonly _maxHp: number;
    /** Remaining invincibility seconds after a hit. */
    protected iframes = 0;

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

    get radius(): number {
        return KnightConsts.radius;
    }

    get isDead(): boolean {
        return this._hp <= 0;
    }

    // ── Public methods ───────────────────────────────────────────────────────

    /**
     * Check whether an auto-attack should fire this tick.
     * Must be called ONCE per tick, before update().
     *
     * @returns The aim angle if an attack fires; null otherwise.
     */
    tryAttack(dt: number, aimAngle: number): number | null {
        return null;
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

        const r = KnightConsts.radius;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);

        // ── Visuals ──────────────────────────────────────────────────────────
        this.drawVisuals(dt, move, aimAngle);

        // Flash while in iframes: rapid alpha toggle
        this.container.alpha = this.iframes > 0
            ? (Math.sin(this.iframes * 30) > 0 ? 0.3 : 1.0)
            : 1.0;
    }

    protected abstract issueUpdate(dt: number, move: Vec2, aimAngle: number): void;

    protected abstract drawVisuals(dt: number, move: Vec2, aimAngle: number): void;

    /**
     * Apply a hit to the player — only lands if iframes are not active.
     * @param amount  HP to remove.
     * @param kbx     X knockback impulse (world units/s, positive = right).
     * @param kby     Y knockback impulse.
     * @returns true if the hit landed.
     */
    takeDamage(amount: number, kbx: number, kby: number): boolean {
        if (this.iframes > 0 || this._hp <= 0) return false;
        this._hp = Math.max(0, this._hp - amount);
        this.iframes = KnightConsts.iframes;
        this.vx += kbx;
        this.vy += kby;
        return true;
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}

export class KnightPlayer extends Player {
    private readonly arcGfx: Graphics;
    private readonly swingGfx: Graphics;
    /** Counts down to 0; attack fires when it crosses 0. */
    private attackCooldown: number;
    /** Counts down from ATTACK_ARC_DURATION to 0 while the swing arc is visible. */
    private swingTimer = 0;
    /** Aim angle captured when the attack fired (used for the visual). */
    private swingAngle = 0;

    get speed(): number {
        return KnightConsts.speed;
    }

    constructor(parent: Container) {
        super(parent);
        // First attack fires after half a cooldown so the player isn't instant-swinging
        this.attackCooldown = KnightConsts.autoAttack.cooldown * 0.5;

        // Sword swing arc — drawn behind the body
        this.swingGfx = new Graphics();
        this.container.addChild(this.swingGfx);

        // Body circle — drawn once, never changes
        const body = new Graphics();
        body.circle(0, 0, KnightConsts.radius).fill({ color: KnightConsts.color });
        this.container.addChild(body);

        // Shield arc — redrawn every sim tick
        this.arcGfx = new Graphics();
        this.container.addChild(this.arcGfx);

        this.drawShieldArc(0);
    }

    override tryAttack(dt: number, aimAngle: number): number | null {
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
            // += COOLDOWN to preserve any overshoot (keeps timing precise)
            this.attackCooldown += KnightConsts.autoAttack.cooldown;
            this.swingTimer = KnightConsts.autoAttack.duration;
            this.swingAngle = aimAngle;
            return aimAngle;
        }
        return null;
    }

    protected override issueUpdate(dt: number, move: Vec2, aimAngle: number): void {
        if (this.swingTimer > 0) {
            this.swingTimer = Math.max(0, this.swingTimer - dt);
        }
    }

    protected override drawVisuals(dt: number, move: Vec2, aimAngle: number) {
        this.drawShieldArc(aimAngle);
        this.drawSwingArc();
    }

    private drawShieldArc(aimAngle: number): void {
        const g = this.arcGfx;
        g.clear();
        const arcR = KnightConsts.radius + 6;
        const start = aimAngle - KnightConsts.SHIELD_ARC_HALF;
        const end = aimAngle + KnightConsts.SHIELD_ARC_HALF;
        // arc() after clear() starts a fresh path — no stray line from origin.
        g.arc(0, 0, arcR, start, end);
        g.stroke({ color: KnightConsts.SHIELD_COLOR, width: 3, alpha: 1 });
    }

    private drawSwingArc(): void {
        const g = this.swingGfx;
        g.clear();
        if (this.swingTimer <= 0) return;

        const { duration, range, color } = KnightConsts.autoAttack;
        const alpha = this.swingTimer / duration;
        const start = this.swingAngle - (Math.PI / 6); // 30° half-angle
        const end = this.swingAngle + (Math.PI / 6);
        const normalizedSwingTimer = (duration - this.swingTimer) / duration;
        const currEnd = lerp(start, end, normalizedSwingTimer);

        // Swing arc trail
        g.arc(0, 0, range, start, currEnd);
        g.stroke({ color: color, width: 4, alpha });

        // Sword at the leading edge of the swing
        const cos = Math.cos(currEnd);
        const sin = Math.sin(currEnd);
        const perpCos = -Math.sin(currEnd);
        const perpSin = Math.cos(currEnd);

        const hiltDist = KnightConsts.radius + 2;
        const guardDist = KnightConsts.radius + 10;
        const guardWidth = 8;

        // Blade
        g.moveTo(cos * hiltDist, sin * hiltDist);
        g.lineTo(cos * range, sin * range);
        g.stroke({ color: color, width: 3, alpha });

        // Crossguard
        g.moveTo(cos * guardDist + perpCos * guardWidth, sin * guardDist + perpSin * guardWidth);
        g.lineTo(cos * guardDist - perpCos * guardWidth, sin * guardDist - perpSin * guardWidth);
        g.stroke({ color: color, width: 3, alpha });
    }
}