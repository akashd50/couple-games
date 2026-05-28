import { LevelConsts } from '../constants';
import type { UpgradeDefinition } from '../upgrades/upgrade-types';
import type { PlayerClass, UpgradeChoice } from '../types';
import type { Player } from '../entities/player';

/**
 * XP required to advance *from* the given level to the next.
 * Formula: `level * XP_PER_LEVEL` (linear scaling).
 *
 * Exported so the Angular component can initialise its `xpToNext` signal.
 */
export function xpForLevel(level: number): number {
    return level * LevelConsts.XP_PER_LEVEL;
}

/**
 * Tracks XP accumulation, level advancement, and the upgrade pool for one run.
 *
 * Key design points:
 *  - `addXp()` is the only way XP enters the system; it fires `onLevelUp` when
 *    a threshold is crossed and the World is responsible for pausing the sim at
 *    that point.
 *  - `applyUpgrade()` is called after the player picks; it records the stack and
 *    calls the upgrade's `apply(player)` function.
 *  - `rollChoices()` uses a Fisher-Yates shuffle for fair randomness, then
 *    filters by `maxStacks` and `requires` gates.
 *  - If 0 eligible upgrades exist (all fully stacked), `addXp()` levels up
 *    silently — no modal, no pause.
 */
export class LevelSystem {
    private _level = 1;
    private _xp = 0;
    private _xpToNext: number;
    /** Map of upgrade id → stacks owned. */
    private readonly owned = new Map<string, number>();

    constructor(
        private readonly allUpgrades: UpgradeDefinition[],
        /**
         * Fired only when level-up produces ≥1 eligible upgrade choices.
         * The World sets `isPaused = true` inside this callback before
         * forwarding it to Angular.
         */
        private readonly onLevelUp: (level: number, choices: UpgradeChoice[]) => void,
        private readonly onXpChange: (xp: number, xpToNext: number, level: number) => void,
        /** Only upgrades with matching (or absent) playerClass will appear in rolls. */
        private readonly playerClass: PlayerClass = 'knight',
    ) {
        this._xpToNext = xpForLevel(this._level);
    }

    get level(): number { return this._level; }
    get xp(): number { return this._xp; }
    get xpToNext(): number { return this._xpToNext; }

    /**
     * Award XP and trigger a level-up if the threshold is crossed.
     * Overflow XP carries into the next level, but only one level-up is
     * triggered per call (the next gem will push further if needed).
     */
    addXp(amount: number): void {
        this._xp += amount;
        this.onXpChange(this._xp, this._xpToNext, this._level);

        if (this._xp >= this._xpToNext) {
            this._xp -= this._xpToNext;
            this._level++;
            this._xpToNext = xpForLevel(this._level);

            const choices = this.rollChoices();
            if (choices.length > 0) {
                // onLevelUp callback is responsible for pausing the sim
                this.onLevelUp(this._level, choices);
            }
            // Emit updated xpToNext after the level-up
            this.onXpChange(this._xp, this._xpToNext, this._level);
        }
    }

    /**
     * Apply the chosen upgrade to the player and record the stack.
     * Called by `World.selectUpgrade()` after the player's choice is relayed
     * from Angular.
     */
    applyUpgrade(id: string, player: Player): void {
        const def = this.allUpgrades.find(u => u.id === id);
        if (!def) return;
        const currentStacks = this.owned.get(id) ?? 0;
        if (currentStacks >= def.maxStacks) return; // guard — should never fire
        this.owned.set(id, currentStacks + 1);
        def.apply(player);
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Pick up to {@link LevelConsts.UPGRADE_CHOICES} random entries from the
     * eligible pool (not fully stacked, all `requires` satisfied, matching class).
     */
    private rollChoices(): UpgradeChoice[] {
        const eligible = this.allUpgrades.filter(def => {
            const stacks = this.owned.get(def.id) ?? 0;
            if (stacks >= def.maxStacks) return false;
            // Class filter — undefined means available to all classes
            if (def.playerClass && def.playerClass !== this.playerClass) return false;
            if (def.requires?.some(req => !(this.owned.get(req) ?? 0))) return false;
            return true;
        });

        // Fisher-Yates shuffle
        for (let i = eligible.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }

        return eligible.slice(0, LevelConsts.UPGRADE_CHOICES).map(def => {
            const stacks = this.owned.get(def.id) ?? 0;
            return {
                id: def.id,
                name: def.name,
                description: def.describe(stacks + 1),
                currentStacks: stacks,
                maxStacks: def.maxStacks,
            };
        });
    }
}
