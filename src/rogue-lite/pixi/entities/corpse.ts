import { Container, Graphics } from 'pixi.js';
import { CorpseConsts } from '../constants';

/**
 * The enemy type that produced this corpse.
 * Determines which Minion variant MinionSystem will raise from it.
 *   'chaser' → ChaserMinion (blue triangle, suicide-bomber)
 *   'knight' → Minion / KnightMinion (purple square, sword swing)
 */
export type CorpseEnemyType = 'chaser' | 'knight';

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

    /**
     * Which enemy type left this corpse — controls which Minion variant is raised.
     */
    readonly enemyType: CorpseEnemyType;

    private lifetime: number;
    private readonly gfx: Graphics;
    private _consumed = false;

    constructor(
        parent: Container,
        x: number,
        y: number,
        level: number,
        enemyType: CorpseEnemyType,
    ) {
        this.posX      = x;
        this.posY      = y;
        this.level     = level;
        this.enemyType = enemyType;
        this.lifetime  = CorpseConsts.LIFETIME;

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

        if (alpha > 0.05) {
            // Type-specific centre mark so the Summoner can tell corpses apart
            if (this.enemyType === 'chaser') {
                // Small triangle → indicates ChaserMinion will be raised
                const mr       = r * 0.42;
                const sqrt3o2  = 0.866;
                g.poly([
                     mr,        0,
                    -mr * 0.5, -mr * sqrt3o2,
                    -mr * 0.5,  mr * sqrt3o2,
                ]).fill({ color: CorpseConsts.MARK_COLOR, alpha: alpha * 0.85 });
            } else {
                // Small square → indicates KnightMinion will be raised
                const mr = r * 0.34;
                g.rect(-mr, -mr, mr * 2, mr * 2)
                 .fill({ color: CorpseConsts.MARK_COLOR, alpha: alpha * 0.85 });
            }
        }
    }
}
