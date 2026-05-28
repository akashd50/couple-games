import { Container } from 'pixi.js';
import { KnightMinion, IMinionLike } from '../entities/knight-minion';
import { ChaserMinion } from '../entities/chaser-minion';
import { SummonAreaConsts } from '../constants';
import type { CorpseSystem } from './corpse-system';
import type { Enemy } from '../entities/enemy';

/**
 * Manages the Summoner's active Minion pool.
 *
 * Responsibilities:
 *  - Auto-summon from nearby corpses on a fixed cooldown.
 *  - Factory: spawns the correct Minion variant based on the corpse's enemyType.
 *      'chaser' corpse → ChaserMinion  (blue triangle, suicide-bomber contact attacker)
 *      'knight' corpse → Minion        (purple square, sword-swing melee)
 *  - Kill the weakest Minion when the cap is exceeded.
 *  - Update every Minion's AI each tick.
 *  - Report total damage dealt (for Summoner lifesteal).
 */
export class MinionSystem {
    private readonly minions: IMinionLike[] = [];
    private summonCooldown = 0;
    private _cap: number;

    constructor(
        private readonly parent: Container,
        cap = SummonAreaConsts.BASE_MINION_CAP,
    ) {
        this._cap = cap;
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get count(): number {
        return this.minions.filter(m => !m.isDead).length;
    }

    get cap(): number {
        return this._cap;
    }

    /** Live Minion instances — used by World for collision separation. */
    getLiveMinions(): IMinionLike[] {
        return this.minions.filter(m => !m.isDead);
    }

    /** 0 when cooldown is ready, approaching 1 while waiting. */
    get summonCooldownFrac(): number {
        return this.summonCooldown / SummonAreaConsts.COOLDOWN;
    }

    // ── Upgrade mutator ───────────────────────────────────────────────────────

    /** Legion upgrade: add n to the maximum simultaneous minion count. */
    increaseCap(n: number): void {
        this._cap += n;
    }

    // ── Per-tick ─────────────────────────────────────────────────────────────

    /**
     * Advance the summon cooldown and try to raise a Minion from a nearby corpse.
     *
     * The corpse's `enemyType` field drives which Minion variant is created:
     *   'chaser' → ChaserMinion
     *   'knight' → Minion (KnightMinion)
     *
     * @param dt            Sim delta (seconds).
     * @param summX         Summoner world X.
     * @param summY         Summoner world Y.
     * @param summonRadius  Current summon-area radius (from SummonerPlayer).
     * @param corpseSystem  Active CorpseSystem to search for consumable corpses.
     */
    trySummon(
        dt: number,
        summX: number,
        summY: number,
        summonRadius: number,
        corpseSystem: CorpseSystem,
    ): void {
        this.summonCooldown = Math.max(0, this.summonCooldown - dt);
        if (this.summonCooldown > 0) return;

        const nearby = corpseSystem.getCorpsesInRange(summX, summY, summonRadius);
        if (nearby.length === 0) return;

        // If at cap, eliminate the weakest active minion to make room
        const active = this.minions.filter(m => !m.isDead);
        if (active.length >= this._cap) {
            const weakest = active.reduce((a, b) => a.level <= b.level ? a : b);
            weakest.kill();
        }

        // Consume nearest corpse and spawn the matching Minion type at its position
        const corpse = nearby[0];
        corpse.consume();

        const newMinion: IMinionLike = corpse.enemyType === 'chaser'
            ? new ChaserMinion(this.parent, corpse.posX, corpse.posY, corpse.level)
            : new KnightMinion(this.parent, corpse.posX, corpse.posY, corpse.level);

        this.minions.push(newMinion);
        this.summonCooldown = SummonAreaConsts.COOLDOWN;
    }

    /**
     * Advance every Minion's AI.
     *
     * @param dt       Sim delta (seconds).
     * @param summX    Summoner world X (follow target).
     * @param summY    Summoner world Y.
     * @param enemies  All active enemies (used for AI targeting and contact).
     * @returns        Total damage dealt by all Minions this tick.
     */
    update(dt: number, summX: number, summY: number, enemies: Enemy[]): number {
        let totalDamage = 0;

        for (const minion of this.minions) {
            if (!minion.isDead) {
                totalDamage += minion.update(dt, summX, summY, enemies);
            }
        }

        // Remove dead minions
        for (let i = this.minions.length - 1; i >= 0; i--) {
            if (this.minions[i].isDead) {
                this.minions[i].destroy();
                this.minions.splice(i, 1);
            }
        }

        return totalDamage;
    }

    destroy(): void {
        for (const m of this.minions) m.destroy();
        this.minions.length = 0;
    }
}
