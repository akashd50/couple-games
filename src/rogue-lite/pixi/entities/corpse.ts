import { Container, Graphics } from 'pixi.js';
import { CorpseConsts } from '../constants';

/**
 * A fading "corpse" node left on the ground when an enemy dies.
 *
 * Visible only when the Summoner is playing.  The Summoner's secondary ability
 * (MinionSystem.trySummon) consumes nearby corpses to raise Minions.
 *
 * Lifecycle:
 *   CorpseSystem.addCorpse()   → new Corpse (fades over LIFETIME seconds)
 *   MinionSystem.trySummon()   → calls Corpse.consume() → isDead = true
 *   CorpseSystem.update()      → removes dead corpses each tick
 */
export class Corpse {
    readonly posX: number;
    readonly posY: number;

    /**
     * Enemy level that spawned this corpse.
     * Determines the resulting Minion's HP and damage.
     */
    readonly level: number;

    private lifetime: number;
    private readonly gfx: Graphics;
    private _consumed = false;

    constructor(parent: Container, x: number, y: number, level: number) {
        this.posX    = x;
        this.posY    = y;
        this.level   = level;
        this.lifetime = CorpseConsts.LIFETIME;

        this.gfx = new Graphics();
        this.drawCorpse(CorpseConsts.ALPHA_START);
        this.gfx.position.set(x, y);
        parent.addChild(this.gfx);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean {
        return this._consumed || this.lifetime <= 0;
    }

    get radius(): number {
        return CorpseConsts.RADIUS;
    }

    // ── Per-tick ─────────────────────────────────────────────────────────────

    /**
     * Advance the fade timer by `dt` seconds.
     * Call once per sim tick via CorpseSystem.update().
     */
    update(dt: number): void {
        if (this.isDead) return;
        this.lifetime = Math.max(0, this.lifetime - dt);
        const alpha   = (this.lifetime / CorpseConsts.LIFETIME) * CorpseConsts.ALPHA_START;
        this.gfx.clear();
        this.drawCorpse(alpha);
    }

    /**
     * Mark this corpse as consumed by the Summoner.
     * Sets isDead so CorpseSystem removes it on the next cleanup pass.
     */
    consume(): void {
        this._consumed = true;
        this.gfx.clear();
    }

    destroy(): void {
        this.gfx.destroy();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private drawCorpse(alpha: number): void {
        const g = this.gfx;
        const r = CorpseConsts.RADIUS;

        // Dim disc
        g.circle(0, 0, r).fill({ color: CorpseConsts.COLOR, alpha });

        // Small centre mark — glowing dot visible to the Summoner
        if (alpha > 0.05) {
            g.circle(0, 0, r * 0.38).fill({ color: CorpseConsts.MARK_COLOR, alpha: alpha * 0.85 });
        }
    }
}
