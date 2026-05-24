import { Color, Container, FillGradient, Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { ArenaConsts, KnightConsts, PhysicsConsts } from '../constants';
import { lerp } from "../common-utils";
import { AttackResolver, getAttackResolver, HitInfo } from "./attacks";
import { Chaser } from "./chaser";

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
    protected attackResolver: AttackResolver;

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

        const r = KnightConsts.radius;
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

    get speed(): number {
        return KnightConsts.speed;
    }

    constructor(parent: Container) {
        super(parent);

        this.attackResolver = getAttackResolver(KnightConsts.autoAttack);
        this.container.addChild(...this.attackResolver.getGfx());

        // Body circle — drawn once, never changes
        const body = new Graphics();
        body.circle(0, 0, KnightConsts.radius).fill({ color: KnightConsts.color });
        this.container.addChild(body);

        // Shield arc — redrawn every sim tick
        this.arcGfx = new Graphics();
        this.container.addChild(this.arcGfx);

        this.drawShieldArc(0);
    }

    override tryAttack(dt: number, aimAngle: number): number {
        return this.attackResolver.tryAttack(dt, aimAngle);
    }

    override checkHit(chaser: Chaser): HitInfo {
        return this.attackResolver.checkHit(this, chaser);
    }

    protected override issueUpdate(dt: number, move: Vec2, aimAngle: number): void {
        this.attackResolver.update(dt, move, aimAngle);
    }

    protected override draw(dt: number, move: Vec2, aimAngle: number) {
        this.drawShieldArc(aimAngle);
        this.attackResolver.draw(dt, move, aimAngle);
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
}