import type { Player } from './player';
import type { Chaser } from './chaser';
import type { Vec2 } from '../types';
import { AttackResolver, HitInfo } from './attacks';
import { KnightConsts } from '../constants';
import { Graphics } from 'pixi.js';

/**
 * Pulsing damage ring that sweeps outward from the player every AURA_PERIOD seconds.
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
export class AuraResolver extends AttackResolver {
    /** 0 → 1 cycling phase within the current pulse. */
    private _phase = 0;
    /** Ring radius at the start of the last sim tick (world units). */
    private _prevRadius = 0;
    /** Ring radius at the end of the last sim tick. */
    private _currentRadius = 0;
    /** Enemies already struck during the current cycle; cleared on cycle wrap. */
    private readonly _hitSet = new Set<Chaser>();
    /** Persistent Graphics node managed by this resolver; z-ordering owned by caller. */
    private readonly _gfx: Graphics;

    constructor() {
        super();
        this._gfx = new Graphics();
    }

    /** Graphics to be inserted at z-index 0 by KnightPlayer.enableAura(). */
    override getGfx(): Graphics[] { return [this._gfx]; }

    /** Swept band start — radius at the beginning of the last sim tick. */
    get prevRadius(): number { return this._prevRadius; }
    /** Swept band end — radius at the end of the last sim tick. */
    get currentRadius(): number { return this._currentRadius; }

    /** Returns true if `c` was already struck during the current pulse cycle. */
    hasHitEnemy(c: Chaser): boolean { return this._hitSet.has(c); }
    /** Mark `c` as struck so it is not hit again this cycle. */
    markHitEnemy(c: Chaser): void { this._hitSet.add(c); }

    override update(dt: number, _move: Vec2, _aimAngle: number): void {
        this._prevRadius = this._phase * KnightConsts.AURA_RADIUS;
        this._phase += dt / KnightConsts.AURA_PERIOD;
        if (this._phase >= 1) {
            this._phase -= 1;
            this._hitSet.clear(); // fresh hit tracking for the new cycle
        }
        this._currentRadius = this._phase * KnightConsts.AURA_RADIUS;
    }

    override draw(_dt: number, _move: Vec2, _aimAngle: number): void {
        const g = this._gfx;
        g.clear();

        // Static outer boundary circle (always visible while aura is active)
        g.circle(0, 0, KnightConsts.AURA_RADIUS);
        g.stroke({ color: KnightConsts.AURA_COLOR, width: 1, alpha: 0.12 });

        // Expanding pulse ring — fades as it reaches the boundary
        const t = this._phase;
        const pulseRadius = t * KnightConsts.AURA_RADIUS;
        if (pulseRadius > 1) {
            g.circle(0, 0, pulseRadius);
            g.stroke({ color: KnightConsts.AURA_COLOR, width: 4, alpha: (1 - t) * 0.55 });
        }
    }

    // ── AttackResolver contract (passive — world handles hit detection) ───────
    override tryAttack(_dt: number, _aimAngle: number): number | undefined { return undefined; }
    override checkHit(_player: Player, _chaser: Chaser): HitInfo | undefined { return undefined; }
}
