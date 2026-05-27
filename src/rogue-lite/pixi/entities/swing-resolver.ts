import { Graphics } from "pixi.js";
import { Props, KnightConsts } from "../constants";
import { Player } from "./player";
import { Resolver, HitInfo } from "./attacks";
import { Chaser } from "./chaser";
import { isInAttackCone } from "../systems/attack-system";
import { Vec2 } from "../types";
import { lerp } from "../common-utils";

export class SwingAttackResolver extends Resolver {
    /** Counts down to 0; attack fires when it crosses 0. */
    private attackCooldown: number;
    /** Counts down from ATTACK_ARC_DURATION to 0 while the swing arc is visible. */
    private swingTimer = 0;
    /** Aim angle captured when the attack fired (used for the visual). */
    private swingAngle = 0;
    private props: Props;
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

    constructor(
        private readonly player: Player,
        props: Props
    ) {
        super();
        this.props = props;
        this.attackCooldown = props.cooldown * 0.5;
        this.swingGfx = new Graphics();
        this.player.backgroundFx.addChild(this.swingGfx);
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

    override update(dt: number, _move: Vec2, _aimAngle: number) {
        this.swingGfx.position.set(this.player.position.x, this.player.position.y);

        if (this.swingTimer > 0) {
            this.swingTimer = Math.max(0, this.swingTimer - dt);
        }

        const halfAngle = this.effectiveHalfAngle;
        this.arcStart = this.swingAngle - halfAngle;
        this.arcEnd = this.arcStart + 2 * halfAngle * (this.progress ?? 0);
    }

    public multiplyCooldown(mult: number): void {
        this.cooldownMult *= mult;
    }

    public addHalfAngle(delta: number): void {
        this._halfAngleDelta += delta;
    }

    public multiplyRange(factor: number): void {
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

        const { duration, color } = KnightConsts.swing;
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
