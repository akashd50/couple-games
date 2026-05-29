import type { Player } from './player';
import type { Enemy } from './enemy';
import type { Vec2 } from '../types';
import { Resolver, HitInfo } from './attacks';
import { ShockwaveResolver } from './shockwave-resolver';
import { KnightConsts } from '../constants';
import { ShockwaveEffect } from "../effects/shockwave-effect";
import { getDirectionTo } from "../common-utils";
import { Entity } from "./entity";

/**
 * Fires a second, smaller shockwave cone aftershock.delay seconds after each
 * primary Shockwave fires.
 *
 * Depends on ShockwaveResolver: subscribes to its fire-callback (rather than
 * SwingAttackResolver directly) so the delay timer starts exactly when the
 * shockwave fires.  Inherits halfAngle and innerRadius from ShockwaveResolver,
 * which in turn reads them from SwingAttackResolver.
 *
 * World reads consumePending() each tick to get the pending aim angle, then
 * fires the delayed physics impulse + ShockwaveEffect visual.
 *
 * Upgrades:
 *   Aftershock (1 stack, requires Shockwave) — KnightPlayer.enableAftershock()
 *   creates this resolver and wires it to the existing ShockwaveResolver.
 */
export class AftershockResolver extends Resolver {
    private _pendingAngle: number | null = null;
    /** Angle stored when the timer started; used when the timer expires. */
    private _timerAngle = 0;
    /** Seconds remaining until the aftershock fires.  −1 = inactive. */
    private _timer = -1;

    constructor(
        private readonly parentEntity: Entity,
        private readonly shockwave: ShockwaveResolver
    ) {
        super();
        shockwave.addFireListener(angle => this.onShockwaveFired(angle));
    }

    /** Inherits the cone shape from the upstream ShockwaveResolver. */
    get halfAngle(): number {
        return this.shockwave.halfAngle;
    }

    /** Inherits the inner radius from the upstream ShockwaveResolver. */
    get innerRadius(): number {
        return this.shockwave.innerRadius;
    }

    /**
     * Returns the aim angle when the delayed blast should fire and clears the flag.
     * Returns null if the timer has not expired this tick.
     *
     * Called by World after parentEntity.update(); safe to call once per tick.
     */
    consumePending(): number | null {
        const a = this._pendingAngle;
        this._pendingAngle = null;
        return a;
    }

    destroy() {
        for (const fx of this.effects) {
            fx.destroy();
        }
        this.effects.length = 0;
    }

    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        const angle = this.consumePending();
        if (angle !== null) {
            this.clearHitSet();
            const shockwave = new ShockwaveEffect(
                this.parentEntity.bgContainer, this.parentEntity.getPosition().x, this.parentEntity.getPosition().y, angle,
                this.halfAngle, this.innerRadius, KnightConsts.aftershock.range, KnightConsts.aftershock.color, KnightConsts.aftershock.duration
            );
            this.effects.push(shockwave);
        }

        return angle;
    }

    override checkHit(enemy: Entity): HitInfo | undefined {
        const hitInfo = new HitInfo();
        for (const se of this.effects) {
            if (se.isInRange(enemy)) {
                const dir = getDirectionTo(this.parentEntity.getPosition(), enemy.getPosition());
                hitInfo
                    .setDamage(KnightConsts.aftershock.damage)
                    .setKnockback(dir.x * KnightConsts.aftershock.knockback, dir.y * KnightConsts.aftershock.knockback);
            }
        }

        return hitInfo;
    }

    private onShockwaveFired(angle: number): void {
        // (Re-)start the delay timer.  A new shockwave overrides any in-flight timer.
        this._timerAngle = angle;
        this._timer = KnightConsts.aftershock.delay;
    }

    override update(_dt: number, _move: Vec2, _aimAngle: number): void {
        if (this._timer > 0) {
            this._timer -= _dt;
            if (this._timer <= 0) {
                this._pendingAngle = this._timerAngle;
                this._timer = -1;
            }
        }

        for (const fx of this.effects) {
            fx.update(_dt);
        }

        for (let i = this.effects.length - 1; i >= 0; i--) {
            if (this.effects[i].isDone) {
                this.effects[i].destroy();
                this.effects.splice(i, 1);
            }
        }
    }

    // ── AttackResolver contract (passive) ────────────────────────────────────
    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }
}
