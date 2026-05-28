import { Container } from 'pixi.js';
import { Corpse, } from '../entities/corpse';
import { CorpseConsts } from '../constants';

/**
 * Manages all active Corpse nodes for a run.
 *
 * Created by World when the player is a Summoner.
 * Fed by World.onEnemyDeath(); queried by MinionSystem.trySummon().
 */
export class CorpseSystem {
    private readonly corpses: Corpse[] = [];

    constructor(private readonly parent: Container) {}

    // ── Mutators ─────────────────────────────────────────────────────────────

    /** Spawn a new corpse at world position (x, y) from an enemy of the given level. */
    addCorpse(x: number, y: number, level: number): void {
        this.corpses.push(new Corpse(this.parent, x, y, level));
    }

    // ── Per-tick ─────────────────────────────────────────────────────────────

    /**
     * Advance all corpse fade timers and remove fully-dead ones.
     * Call once per sim tick.
     */
    update(dt: number): void {
        for (const c of this.corpses) c.update(dt);

        for (let i = this.corpses.length - 1; i >= 0; i--) {
            if (this.corpses[i].isDead) {
                this.corpses[i].destroy();
                this.corpses.splice(i, 1);
            }
        }
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    /**
     * Return all non-dead corpses whose centre is within `range` of (x, y),
     * sorted nearest-first.
     */
    getCorpsesInRange(x: number, y: number, range: number): Corpse[] {
        const maxDist = range + CorpseConsts.RADIUS;
        return this.corpses
            .filter(c => !c.isDead &&
                Math.hypot(c.posX - x, c.posY - y) <= maxDist)
            .sort((a, b) =>
                Math.hypot(a.posX - x, a.posY - y) -
                Math.hypot(b.posX - x, b.posY - y),
            );
    }

    get count(): number { return this.corpses.length; }

    destroy(): void {
        for (const c of this.corpses) c.destroy();
        this.corpses.length = 0;
    }
}
