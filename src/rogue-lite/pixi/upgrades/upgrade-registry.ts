import type { UpgradeDefinition } from './upgrade-types';

// ── Phase 3 — Starter upgrades ────────────────────────────────────────────────

/**
 * Flurry — attack speed.
 * Each stack multiplies the cooldown by 0.85 (−15 %).
 * Five stacks: 0.85^5 ≈ 0.444 → roughly 56 % more attacks per second.
 */
const flurry: UpgradeDefinition = {
    id: 'flurry',
    name: 'Flurry',
    maxStacks: 5,
    describe: (nextStacks) => {
        const pct = Math.round((1 - Math.pow(0.85, nextStacks)) * 100);
        return `Attack ${pct}% faster overall (stacks multiply, each is −15% cooldown).`;
    },
    apply: (player) => player.multiplyAttackCooldown(0.85),
};

/**
 * Juggernaut — survivability + size.
 * +25 max HP (healed immediately) and +2 body radius per stack.
 * Five stacks: +125 max HP, radius 22 → 32.
 */
const juggernaut: UpgradeDefinition = {
    id: 'juggernaut',
    name: 'Juggernaut',
    maxStacks: 5,
    describe: (nextStacks) =>
        `+${nextStacks * 25} total max HP and +${nextStacks * 2} body radius. Heals the gain instantly.`,
    apply: (player) => {
        player.addMaxHp(25);
        player.addRadiusBonus(2);
    },
};

/**
 * Magnet — XP attraction.
 * Adds 80 units to the magnet radius per stack (the range in which XP gems
 * drift toward the player automatically).
 * Five stacks: 400-unit attraction range.
 */
const magnet: UpgradeDefinition = {
    id: 'magnet',
    name: 'Magnet',
    maxStacks: 5,
    describe: (nextStacks) =>
        `Attract XP gems from up to ${nextStacks * 80} units away.`,
    apply: (player) => player.addMagnetRadius(80),
};

// ── Phase 4 upgrades will be appended here ────────────────────────────────────
// Example future entry:
//   const aftershock: UpgradeDefinition = {
//     id: 'aftershock',
//     name: 'Aftershock',
//     requires: ['shockwave'],   // ← gated by owning Shockwave
//     ...
//   };

/**
 * All upgrade definitions available in a run.
 *
 * `LevelSystem` reads this array to build the roll pool on each level-up.
 * To add a new upgrade: define it above and append it here — no other
 * files need to change.
 */
export const ALL_UPGRADES: UpgradeDefinition[] = [flurry, juggernaut, magnet];
