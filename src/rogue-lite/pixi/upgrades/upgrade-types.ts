import type { Player } from '../entities/player';
import type { PlayerClass } from '../types';

/**
 * Defines a single upgrade available in the level-up pool.
 *
 * Extensibility notes:
 *  - `playerClass`: when set, the upgrade only appears for the matching class.
 *    Omit (or set to undefined) for upgrades available to all classes.
 *  - `requires`: gate upgrades behind earlier ones.
 *    Example: `requires: ['shockwave']` on Aftershock prevents it from
 *    appearing until the player owns at least 1 stack of Shockwave.
 *  - `describe` receives the *next* stack count (1-indexed) so the text
 *    can show cumulative totals rather than per-stack deltas.
 *  - `apply` is called exactly once per picked stack. The `LevelSystem`
 *    guards `maxStacks` before calling it, so no double-application check
 *    is needed inside `apply`.
 *  - `apply` receives the live `Player` instance and may call any of the
 *    public upgrade-facing mutator methods (`addMaxHp`, `addRadiusBonus`,
 *    `addMagnetRadius`, etc.).
 */
export interface UpgradeDefinition {
    id: string;
    name: string;
    maxStacks: number;
    /**
     * When set, this upgrade only appears in the roll pool when the player is
     * playing the specified class.  Undefined = available to all classes.
     */
    playerClass?: PlayerClass;
    /**
     * IDs of upgrades the player must already own ≥1 stack of before this
     * upgrade can appear in the roll pool.
     */
    requires?: string[];
    /**
     * Returns the description shown to the player when they are offered
     * this upgrade.
     * @param nextStacks The stack count this selection would bring the
     *                   player to (1-indexed; first pick = 1).
     */
    describe: (nextStacks: number) => string;
    /**
     * Called exactly once when the player picks this upgrade.
     * Mutates `player` stats directly via the public API.
     */
    apply: (player: Player) => void;
}
