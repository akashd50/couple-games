import type { Player } from './player';
import type { Chaser } from './chaser';
import type { Vec2 } from '../types';
import { AttackResolver, HitInfo } from './attacks';
import { KnightConsts } from '../constants';
import { ShockwaveEffect } from "../effects/shockwave-effect";
import { getDirectionTo, wrapAngle } from "../common-utils";
import { SwingAttackResolver } from "./swing-resolver";

/**
 * Fires a shockwave on every Nth sword swing.
 *
 * Depends on SwingAttackResolver: subscribes to its fire-callback so the attack
 * count accumulates without any fields on the player, and reads effectiveHalfAngle /
 * effectiveRange so the shockwave cone always matches the sword arc (Wide Cleave
 * stacks included).
 *
 * World reads consumePending() each tick to get the pending aim angle, then fires
 * the physics impulse + ShockwaveEffect visual itself.
 *
 * Upgrades:
 *   Shockwave (1 stack) — KnightPlayer.enableShockwave() creates this resolver.
 */
export class ShockwaveResolver extends AttackResolver {
    private _attacksFired = 0;
    private _pendingAngle: number | null = null;
    private readonly _fireListeners: ((angle: number) => void)[] = [];
    /** Active shockwave cone visuals; updated and pruned each tick. */
    protected readonly shockwaveEffects: ShockwaveEffect[] = [];

    constructor(
        private readonly player: Player,
        private readonly swing: SwingAttackResolver
    ) {
        super();
        swing.addFireListener(angle => this.onSwingFired(angle));
    }

    /** Effective cone half-angle — mirrors the sword arc, incl. Wide Cleave stacks. */
    get halfAngle(): number {
        return this.swing.effectiveHalfAngle;
    }

    /** Cone inner radius — matches the sword's effective reach. */
    get innerRadius(): number {
        return this.swing.effectiveRange;
    }

    /**
     * Register a callback invoked each time THIS shockwave fires.
     * AftershockResolver subscribes here to start its delay timer.
     */
    addFireListener(cb: (angle: number) => void): void {
        this._fireListeners.push(cb);
    }

    /**
     * Returns the aim angle at which the shockwave was triggered and clears the
     * pending flag.  Returns null if no shockwave is queued this tick.
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

    private onSwingFired(angle: number): void {
        this._attacksFired++;
        if (this._attacksFired % KnightConsts.swordShockwave.everyN === 0) {
            this._pendingAngle = angle;
            for (const cb of this._fireListeners) {
                cb(angle);
            }
        }
    }

    // ── AttackResolver contract (passive — driven by swing fire callback) ─────
    // tryAttack / checkHit / draw are no-ops; update is not needed either.
    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        const angle = this.consumePending();
        if (angle !== null) {
            this.clearHitSet();
            const shockwave = new ShockwaveEffect(this.player.backgroundFx, this.player.position.x, this.player.position.y, angle,
                this.halfAngle, this.innerRadius, KnightConsts.swordShockwave.range, KnightConsts.swordShockwave.color, KnightConsts.swordShockwave.duration
            );
            this.shockwaveEffects.push(shockwave);
        }

        return angle;
    }

    override checkHit(_player: Player, _chaser: Chaser): HitInfo | undefined {
        const hitInfo = new HitInfo();
        for (const se of this.shockwaveEffects) {
            if (se.isInRange(_chaser)) {
                const dir = getDirectionTo(this.player.position, { x: _chaser.posX, y: _chaser.posY })
                hitInfo
                    .addDamage(KnightConsts.swordShockwave.damage)
                    .addKnockback(dir.x * KnightConsts.swordShockwave.knockback, dir.y * KnightConsts.swordShockwave.knockback);
            }
        }

        return hitInfo;
    }

    override update(_dt: number, _move: Vec2, _aimAngle: number): void {
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

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }
}
