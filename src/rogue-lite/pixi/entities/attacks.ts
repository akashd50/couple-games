import { Chaser } from "./chaser";
import { AttackProps, KnightConsts } from "../constants";
import { Player } from "./player";
import { isInAttackCone } from "../systems/attack-system";
import { Vec2 } from "../types";
import { lerp } from "../common-utils";
import { Graphics } from "pixi.js";

export class HitInfo {
    damage: number;
    knockback: Vec2;
    success: boolean;

    constructor() {
        this.knockback = { x: 0, y: 0 };
        this.damage = 0;
        this.success = false;
    }

    add(h: HitInfo) {
        if (h === undefined) {
            return;
        }

        this.success = this.success || h.success;
        this.damage += h.damage ?? 0;
        this.knockback.x += h.knockback?.x ?? 0;
        this.knockback.y += h.knockback?.y ?? 0;
    }

    setDamage(d: number): HitInfo {
        this.damage += d;
        this.success = true;
        return this;
    }

    setKnockback(x: number, y: number): HitInfo {
        this.knockback.x = x;
        this.knockback.y = y;
        this.success = true;
        return this;
    }

    addDamage(d: number): HitInfo {
        this.damage += d;
        this.success = true;
        return this;
    }

    addKnockback(x: number, y: number): HitInfo {
        this.knockback.x += x;
        this.knockback.y += y;
        this.success = true;
        return this;
    }
}

export abstract class AttackResolver {
    protected hitSet = new Set<Chaser>();

    abstract checkHit(player: Player, chaser: Chaser): HitInfo | undefined;

    abstract tryAttack(dt: number, aimAngle: number): number | undefined;

    abstract update(dt: number, move: Vec2, aimAngle: number): void;

    abstract draw(dt: number, move: Vec2, aimAngle: number): void;

    getGfx(): Graphics[] {
        return [];
    }

    /** Mark `c` as struck so it is not hit again this cycle. */
    markHitEnemy(c: Chaser): void {
        this.hitSet.add(c);
    }

    /** Returns true if `c` was already struck during the current pulse cycle. */
    hasHitEnemy(c: Chaser): boolean {
        return this.hitSet.has(c);
    }

    protected clearHitSet() {
        this.hitSet.clear();
    }

    /**
     * Apply a cooldown multiplier from an upgrade (e.g. Flurry).
     * Default implementation is a no-op — only resolvers that have a
     * cooldown concept need to override this.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setCooldownMult(_mult: number): void { /* no-op by default */
    }

    /**
     * Widen the attack cone by `delta` radians (half-angle).
     * Used by the Wide Cleave upgrade. Default: no-op.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addHalfAngle(_delta: number): void { /* no-op by default */
    }

    /**
     * Multiply the attack range by `factor`.
     * Used by the Wide Cleave upgrade. Default: no-op.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    multiplyRange(_factor: number): void { /* no-op by default */
    }
}

export class SwingAttackResolver extends AttackResolver {
    /** Counts down to 0; attack fires when it crosses 0. */
    private attackCooldown: number;
    /** Counts down from ATTACK_ARC_DURATION to 0 while the swing arc is visible. */
    private swingTimer = 0;
    /** Aim angle captured when the attack fired (used for the visual). */
    private swingAngle = 0;
    private props: AttackProps;
    /** Accumulated cooldown multiplier from upgrades (Flurry stacks multiply). */
    private cooldownMult = 1;
    private arcStart: number;
    private arcEnd: number;
    private readonly swingGfx: Graphics;

    // ── Phase 4: Wide Cleave mutation fields ──────────────────────────────────
    /** Extra half-angle (radians) added by Wide Cleave stacks. */
    private _halfAngleDelta = 0;
    /** Range multiplier accumulated from Wide Cleave stacks. */
    private _rangeMult = 1;
    /** Callbacks invoked each time a swing fires; used by ShockwaveResolver. */
    private readonly _fireListeners: ((angle: number) => void)[] = [];

    constructor(props: AttackProps) {
        super();
        this.props = props;
        this.attackCooldown = props.cooldown * 0.5;
        this.swingGfx = new Graphics();
    }

    /** Effective half-angle after all Wide Cleave stacks. */
    get effectiveHalfAngle(): number {
        return this.props.halfAngle + this._halfAngleDelta;
    }

    /** Effective sword range after all Wide Cleave stacks. */
    get effectiveRange(): number {
        return this.props.range * this._rangeMult;
    }

    get progress(): number | undefined {
        if (this.swingTimer <= 0) {
            return undefined;
        }
        return (this.props.duration - this.swingTimer) / this.props.duration;
    }

    override getGfx(): Graphics[] {
        return [this.swingGfx];
    }

    override update(dt: number, _move: Vec2, _aimAngle: number) {
        if (this.swingTimer > 0) {
            this.swingTimer = Math.max(0, this.swingTimer - dt);
        }

        const halfAngle = this.effectiveHalfAngle;
        this.arcStart = this.swingAngle - halfAngle;
        this.arcEnd = this.arcStart + 2 * halfAngle * (this.progress ?? 0);
    }

    override setCooldownMult(mult: number): void {
        this.cooldownMult = mult;
    }

    override addHalfAngle(delta: number): void {
        this._halfAngleDelta += delta;
    }

    override multiplyRange(factor: number): void {
        this._rangeMult *= factor;
    }

    override tryAttack(dt: number, aimAngle: number): number | undefined {
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
            // += scaled COOLDOWN to preserve any overshoot; multiplier from Flurry upgrade
            this.attackCooldown += this.props.cooldown * this.cooldownMult;
            this.swingTimer = this.props.duration;
            this.swingAngle = aimAngle;
            this.clearHitSet();
            for (const cb of this._fireListeners) cb(aimAngle);
            return aimAngle;
        }
        return undefined;
    }

    /**
     * Register a callback invoked each time a swing fires.
     * ShockwaveResolver subscribes here to count attacks without any state on the player.
     */
    addFireListener(cb: (angle: number) => void): void {
        this._fireListeners.push(cb);
    }

    override checkHit(player: Player, chaser: Chaser): HitInfo | undefined {
        if (this.swingTimer <= 0 || this.hitSet.has(chaser)) {
            return undefined;
        }

        if (isInAttackCone(
            player.position.x, player.position.y,
            this.arcStart, this.arcEnd,
            chaser.posX, chaser.posY, chaser.radius,
            this.effectiveRange,
        )) {
            const dx2 = chaser.posX - player.position.x;
            const dy2 = chaser.posY - player.position.y;
            const d2 = Math.hypot(dx2, dy2);
            const kbx = d2 > 0.001 ? (dx2 / d2) * this.props.knockback : this.props.knockback;
            const kby = d2 > 0.001 ? (dy2 / d2) * this.props.knockback : 0;
            this.hitSet.add(chaser);

            return {
                damage: this.props.damage,
                knockback: { x: kbx, y: kby },
                success: true,
            } as HitInfo;
        }

        return undefined;
    }

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
        const g = this.swingGfx;
        g.clear();
        if (this.swingTimer <= 0) {
            return;
        }

        const { duration, color } = KnightConsts.autoAttack;
        const effectiveRange = this.effectiveRange;
        const effectiveHalfAngle = this.effectiveHalfAngle;

        const alpha = this.swingTimer / duration;
        const start = this.swingAngle - effectiveHalfAngle;
        const end = this.swingAngle + effectiveHalfAngle;
        const normalizedSwingTimer = (duration - this.swingTimer) / duration;
        const currEnd = lerp(start, end, normalizedSwingTimer);

        // Swing arc trail
        g.arc(0, 0, effectiveRange, start, currEnd);
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
        g.lineTo(cos * effectiveRange, sin * effectiveRange);
        g.stroke({ color: color, width: 3, alpha });

        // Crossguard
        g.moveTo(cos * guardDist + perpCos * guardWidth, sin * guardDist + perpSin * guardWidth);
        g.lineTo(cos * guardDist - perpCos * guardWidth, sin * guardDist - perpSin * guardWidth);
        g.stroke({ color: color, width: 3, alpha });
    }
}

export function getAttackResolver(attack: AttackProps): AttackResolver {
    switch (attack.type) {
        case "swing":
            return new SwingAttackResolver(attack);
    }
}
