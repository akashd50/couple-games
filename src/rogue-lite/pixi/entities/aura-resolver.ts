import type { Player } from './player';
import type { Enemy } from './enemy';
import type { Vec2 } from '../types';
import { Resolver, HitInfo } from './attacks';
import { IProps } from '../constants';
import { AuraEffect } from '../effects/aura-effect';
import { getDirectionTo } from "../common-utils";
import { applyMultiplier } from "../props-utils";

/**
 * Pulsing damage ring that sweeps outward from the player.
 *
 * With `props.cooldown = 0` a single ring cycles continuously (original behaviour).
 * With `props.cooldown > 0` a new ring is spawned every `cooldown` seconds so
 * multiple rings can be active and sweeping at the same time.
 *
 * Hit detection:
 *   Per-pulse hit sets inside AuraEffect ensure each ring can strike an enemy
 *   at most once per pass, while still allowing overlapping rings to
 *   independently deal damage.  For this reason hasHitEnemy() always returns
 *   false — the resolver-level hit set is intentionally bypassed in favour of
 *   AuraEffect's finer-grained per-pulse tracking.
 *
 * Upgrades:
 *   Aura (1 stack) — KnightPlayer.enableAura() creates this resolver.
 */
export class AuraResolver extends Resolver {
    constructor(
        private readonly player: Player,
        private readonly props: IProps
    ) {
        super();
    }

    override update(dt: number, _move: Vec2, _aimAngle: number): void {
        this.effects[0]?.update(dt, this.player.getPosition(), applyMultiplier(this.props, this.multiplier));
    }

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
    }

    // ── AttackResolver contract (passive — world handles hit detection) ───────
    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        if (this.effects.length === 0) {
            const auraEffect = new AuraEffect(
                this.player.backgroundFx,
                this.player.getPosition(),
                applyMultiplier(this.props, this.multiplier),
                true,  // loop
                true,  // track player position
            );
            this.effects.push(auraEffect);
        }

        return undefined;
    }

    /**
     * Always returns `false`.
     *
     * Normally the player skips a resolver if it has already struck an enemy
     * this tick.  For the aura we bypass that guard entirely — AuraEffect tracks
     * hits per-pulse, so each active ring can independently detect a hit without
     * the resolver-level set interfering.
     */
    override hasHitEnemy(_e: Enemy): boolean {
        return false;
    }

    override checkHit(_player: Player, enemy: Enemy): HitInfo | undefined {
        const effect = this.effects[0] as AuraEffect | undefined;
        if (effect?.isInRange(enemy)) {
            const dir = getDirectionTo(this.player.getPosition(), enemy.getPosition());
            return new HitInfo()
                .setDamage(this.props.damage)
                .setKnockback(dir.x * this.props.knockback, dir.y * this.props.knockback);
        }

        return undefined;
    }
}
