import type { Player } from './player';
import type { Chaser } from './chaser';
import type { Vec2 } from '../types';
import { AttackResolver, HitInfo } from './attacks';
import { ShockwaveResolver } from './shockwave-resolver';
import { KnightConsts } from '../constants';

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

    constructor(private readonly shockwave: ShockwaveResolver) {
        super();
        shockwave.addFireListener(angle => this.onShockwaveFired(angle));
    }

    /** Inherits the cone shape from the upstream ShockwaveResolver. */
    get halfAngle(): number { return this.shockwave.halfAngle; }
    /** Inherits the inner radius from the upstream ShockwaveResolver. */
    get innerRadius(): number { return this.shockwave.innerRadius; }

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

    private onShockwaveFired(angle: number): void {
        // (Re-)start the delay timer.  A new shockwave overrides any in-flight timer.
        this._timerAngle = angle;
        this._timer = KnightConsts.AFTERSHOCK_DELAY;
    }

    override update(dt: number, _move: Vec2, _aimAngle: number): void {
        if (this._timer > 0) {
            this._timer -= dt;
            if (this._timer <= 0) {
                this._pendingAngle = this._timerAngle;
                this._timer = -1;
            }
        }
    }

    // ── AttackResolver contract (passive) ────────────────────────────────────
    override tryAttack(_dt: number, _aimAngle: number): number | undefined { return undefined; }
    override checkHit(_player: Player, _chaser: Chaser): HitInfo | undefined { return undefined; }
    override draw(_dt: number, _move: Vec2, _aimAngle: number): void { }
}
