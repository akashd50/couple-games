import type { Player } from './player';
import type { Chaser } from './chaser';
import type { Vec2 } from '../types';
import { AttackResolver, HitInfo } from './attacks';
import { ShockwaveResolver } from './shockwave-resolver';
import { KnightConsts } from '../constants';
import { ShockwaveEffect } from "../effects/shockwave-effect";
import { wrapAngle } from "../common-utils";

/**
 * Fires a second, smaller shockwave cone AFTERSHOCK_DELAY seconds after each
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
export class AftershockResolver extends AttackResolver {
    private _pendingAngle: number | null = null;
    /** Angle stored when the timer started; used when the timer expires. */
    private _timerAngle = 0;
    /** Seconds remaining until the aftershock fires.  −1 = inactive. */
    private _timer = -1;
    /** Active shockwave cone visuals; updated and pruned each tick. */
    protected readonly shockwaveEffects: ShockwaveEffect[] = [];

    constructor(
        private readonly player: Player,
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
     * Called by World after player.update(); safe to call once per tick.
     */
    consumePending(): number | null {
        const a = this._pendingAngle;
        this._pendingAngle = null;
        return a;
    }

    destroy() {
        for (const fx of this.shockwaveEffects) {
            fx.destroy();
        }
        this.shockwaveEffects.length = 0;
    }

    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        const angle = this.consumePending();
        if (angle !== null) {
            this.clearHitSet();
            const shockwave = new ShockwaveEffect(
                this.player.backgroundFx, this.player.position.x, this.player.position.y, angle,
                this.halfAngle, this.innerRadius, KnightConsts.SHOCKWAVE_RANGE, 0x88aaff, 0.38
            );
            this.shockwaveEffects.push(shockwave);
        }

        return angle;
    }

    override checkHit(_player: Player, _chaser: Chaser): HitInfo | undefined {
        const hitInfo = new HitInfo();
        for (const se of this.shockwaveEffects) {
            const outerRadius = this.innerRadius + KnightConsts.AFTERSHOCK_RANGE;
            const dx = _chaser.posX - se.x;
            const dy = _chaser.posY - se.y;
            const dist = Math.hypot(dx, dy);
            if (dist > outerRadius + _chaser.radius) {
                continue;
            }

            const enemyAngle = Math.atan2(dy, dx);
            const angleDiff = Math.abs(wrapAngle(enemyAngle - se.aimAngle));
            if (angleDiff > se.halfAngle + 0.15) {
                continue;
            }

            hitInfo.setDamage(KnightConsts.AFTERSHOCK_FORCE);
        }

        return hitInfo;
    }

    private onShockwaveFired(angle: number): void {
        // (Re-)start the delay timer.  A new shockwave overrides any in-flight timer.
        this._timerAngle = angle;
        this._timer = KnightConsts.AFTERSHOCK_DELAY;
    }

    override update(_dt: number, _move: Vec2, _aimAngle: number): void {
        if (this._timer > 0) {
            this._timer -= _dt;
            if (this._timer <= 0) {
                this._pendingAngle = this._timerAngle;
                this._timer = -1;
            }
        }

        for (const fx of this.shockwaveEffects) {
            fx.update(_dt);
        }

        for (let i = this.shockwaveEffects.length - 1; i >= 0; i--) {
            if (this.shockwaveEffects[i].isDone) {
                this.shockwaveEffects[i].destroy();
                this.shockwaveEffects.splice(i, 1);
            }
        }
    }

    // ── AttackResolver contract (passive) ────────────────────────────────────
    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }
}
