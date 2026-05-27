import type { Player } from './player';
import type { Chaser } from './chaser';
import type { Vec2 } from '../types';
import { Resolver, HitInfo } from './attacks';
import { Props } from '../constants';
import { AuraEffect } from '../effects/aura-effect';
import { getDirectionTo } from "../common-utils";

/**
 * Pulsing damage ring that sweeps outward from the player every aura.duration seconds.
 *
 * Hit detection is NOT handled via the standard checkHit() path because it is
 * radius-band-based rather than single-target.  Instead World reads prevRadius /
 * currentRadius each tick, tests each live enemy against the swept band, and
 * applies damage + knockback directly.  hasHitEnemy / markHitEnemy prevent
 * double-hitting within the same cycle.
 *
 * Graphics:
 *   getGfx() returns [_gfx] — KnightPlayer.enableAura() inserts it at z-index 0
 *   in the player container so the ring renders behind the body and sword arc.
 *
 * Upgrades:
 *   Aura (1 stack) — KnightPlayer.enableAura() creates this resolver.
 */
export class AuraResolver extends Resolver {
    constructor(private readonly player: Player, private readonly props: Props) {
        super();
    }

    override update(dt: number, _move: Vec2, _aimAngle: number): void {
        this.effects[0]?.update(dt, this.player.position);
    }

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }

    // ── AttackResolver contract (passive — world handles hit detection) ───────
    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        if (this.effects.length == 0) {
            const auraEffect = new AuraEffect(this.player.backgroundFx, this.player.position, this.props, true, true);
            auraEffect.onLoop$.subscribe(() => {
                this.clearHitSet();
            });

            this.effects.push(auraEffect);
        }

        return undefined;
    }

    override checkHit(_player: Player, _chaser: Chaser): HitInfo | undefined {
        if (this.effects[0]?.isInRange(_chaser)) {
            const dir = getDirectionTo(this.player.position, { x: _chaser.posX, y: _chaser.posY })
            return new HitInfo()
                .setDamage(this.props.damage)
                .setKnockback(dir.x * this.props.knockback, dir.y * this.props.knockback);
        }

        return undefined;
    }
}
