import type { Player } from './player';
import type { Enemy } from './enemy';
import type { Vec2 } from '../types';
import { Resolver, HitInfo } from './attacks';
import { KnightConsts } from '../constants';
import { ShockwaveEffect } from "../effects/shockwave-effect";
import { getDirectionTo } from "../common-utils";
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
export class ShockwaveResolver extends Resolver {
    private _attacksFired = 0;
    private _pendingAngle: number | null = null;
    private readonly _fireListeners: ((angle: number) => void)[] = [];

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
        for (const fx of this.effects) {
            fx.destroy();
        }
        this.effects.length = 0;
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
            const shockwave = new ShockwaveEffect(this.player.backgroundFx, this.player.getPosition().x, this.player.getPosition().y, angle,
                this.halfAngle, this.innerRadius, KnightConsts.swordShockwave.range, KnightConsts.swordShockwave.color, KnightConsts.swordShockwave.duration
            );
            this.effects.push(shockwave);
        }

        return angle;
    }

    override checkHit(_player: Player, enemy: Enemy): HitInfo | undefined {
        const hitInfo = new HitInfo();
        for (const se of this.effects) {
            if (se.isInRange(enemy)) {
                const dir = getDirectionTo(this.player.getPosition(), enemy.getPosition());
                hitInfo
                    .addDamage(KnightConsts.swordShockwave.damage)
                    .addKnockback(dir.x * KnightConsts.swordShockwave.knockback, dir.y * KnightConsts.swordShockwave.knockback);
            }
        }

        return hitInfo;
    }

    override update(_dt: number, _move: Vec2, _aimAngle: number): void {
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

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }
}
