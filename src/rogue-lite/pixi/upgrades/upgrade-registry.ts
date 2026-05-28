import type { UpgradeDefinition } from './upgrade-types';
import { SwingAttackResolver } from "../entities/swing-resolver";
import { AuraResolver } from "../entities/aura-resolver";

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
    apply: (player) => {
        const swingResolver = player.getResolver(SwingAttackResolver);
        swingResolver.multiplyCooldown(0.85)
    },
};

/**
 * Juggernaut — tankiness at the cost of agility.
 * Per stack: +25 max HP (healed immediately), +2 body radius,
 *            +20% knockback resistance (additive, capped at 85%),
 *            −10% movement speed (multiplicative, 0.9× per stack).
 * Five stacks: +125 max HP, radius 22 → 32, 85% knockback resist, ~59% base speed.
 */
const juggernaut: UpgradeDefinition = {
    id: 'juggernaut',
    name: 'Juggernaut',
    maxStacks: 5,
    describe: (nextStacks) => {
        const kbResist = Math.min(nextStacks * 20, 85);
        const speedLoss = Math.round((1 - Math.pow(0.9, nextStacks)) * 100);
        return `+${nextStacks * 25} max HP, +${nextStacks * 2} radius, `
            + `${kbResist}% knockback resistance, ${speedLoss}% slower movement.`;
    },
    apply: (player) => {
        player.addMaxHp(25);
        player.addRadiusBonus(2);
        player.addKnockbackResist(0.20);
        player.multiplyMovementSpeed(0.90);
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

/**
 * Wide Cleave — arc expansion at the cost of swing speed.
 * Per stack: +10° cone (π/18 half-angle), +5% range, −10% swing speed.
 * Three stacks: 90° total cone, ~15.8% longer range, ~33% slower.
 * Synergises strongly with Flurry (offsets the cooldown penalty).
 */
const wideCleave: UpgradeDefinition = {
    id: 'wide_cleave',
    name: 'Wide Cleave',
    maxStacks: 3,
    describe: (nextStacks) => {
        const coneTotal = 60 + nextStacks * 10;
        const rangePct = Math.round((Math.pow(1.05, nextStacks) - 1) * 100);
        const slowPct = Math.round((Math.pow(1.1, nextStacks) - 1) * 100);
        return `Arc ${coneTotal}° total (+${nextStacks * 10}°), range +${rangePct}%, attacks ${slowPct}% slower.`;
    },
    apply: (player) => {
        const swingResolver = player.getResolver(SwingAttackResolver);
        swingResolver.addHalfAngle(Math.PI / 18); // +10° half-angle per stack
        swingResolver.multiplyRange(1.05);  // +5% range per stack
        swingResolver.multiplyCooldown(1.1); // 10% slower per stack
    },
};

/**
 * Iron Skin — passive damage reduction.
 * Each stack multiplies incoming damage by 0.85 (−15%).
 * Four stacks: 0.85^4 ≈ 0.522 → take roughly half damage.
 */
const ironSkin: UpgradeDefinition = {
    id: 'iron_skin',
    name: 'Iron Skin',
    maxStacks: 4,
    describe: (nextStacks) => {
        const reduction = Math.round((1 - Math.pow(0.85, nextStacks)) * 100);
        return `Take ${reduction}% less damage from all sources (stacks multiply, each is −15%).`;
    },
    apply: (player) => player.multiplyIncomingDamage(0.85),
};

/**
 * Lifesteal — heal on hit.
 * Each stack adds 5% lifesteal; damage dealt restores that fraction as HP.
 * Five stacks: every 30-damage hit heals 7–8 HP.
 */
const lifesteal: UpgradeDefinition = {
    id: 'lifesteal',
    name: 'Lifesteal',
    maxStacks: 5,
    describe: (nextStacks) =>
        `Heal ${nextStacks * 5}% of all damage you deal.`,
    apply: (player) => player.addLifestealPct(0.05),
};

/**
 * HealOverTime — heal over time.
 * Each stack adds 0.25 heal over time
 * Five stacks: 1.25 per second
 */
const healOverTime: UpgradeDefinition = {
    id: 'healOverTime',
    name: 'Heal over time',
    maxStacks: 5,
    describe: (nextStacks) => `Heal +0.1 (${nextStacks * 0.1}) hp every second`,
    apply: (player) => player.enableHealTickResolver(0.1),
};

/**
 * Shockwave — every-5th-attack ring knockback.
 * One-shot upgrade (maxStacks: 1).
 * Every 5th sword strike releases an expanding shockwave ring that knocks
 * all enemies within 300 units outward.
 */
const shockwave: UpgradeDefinition = {
    id: 'shockwave',
    name: 'Shockwave',
    maxStacks: 1,
    describe: () =>
        `Every 5th attack releases a Shockwave, knocking back all nearby enemies.`,
    apply: (player) => player.enableShockwave(),
};

/**
 * Aftershock — delayed follow-up to Shockwave.
 * One-shot upgrade; requires Shockwave to be unlocked first.
 * 0.5 s after each Shockwave, a second smaller cone fires in the same direction.
 */
const aftershock: UpgradeDefinition = {
    id: 'aftershock',
    name: 'Aftershock',
    maxStacks: 1,
    requires: ['shockwave'],
    describe: () =>
        `Your Shockwave is followed 0.5 s later by a second delayed blast in the same direction.`,
    apply: (player) => player.enableAftershock(),
};

/**
 * Aura Shield — improved directional blocking.
 * The Knight's shield already reduces damage from the front by 20%.
 * Each Aura Shield stack adds +5% to that reduction (max 5 stacks = +25%,
 * combined with the base for up to 45% reduction from the front).
 */
const auraShield: UpgradeDefinition = {
    id: 'aura_shield',
    name: 'Aura Shield',
    maxStacks: 5,
    describe: (nextStacks) => {
        // Base 20% + upgrade stacks * 5%
        const totalBlock = Math.min(85, 20 + nextStacks * 5);
        return `Shield blocks ${totalBlock}% of incoming damage from the front `
            + `(base 20% + ${nextStacks * 5}% from this upgrade).`;
    },
    apply: (player) => player.addShieldReduction(0.05),
};

/**
 * Aura — pulsing damage ring.
 * A pulsing circle expands from the player every 2 s, filling out to 200 units.
 * Any enemy the ring sweeps through takes 8 damage and is pushed back.
 * One-shot upgrade (the ring effect is always active once unlocked).
 */
const aura: UpgradeDefinition = {
    id: 'aura',
    name: 'Aura',
    maxStacks: 1,
    describe: () =>
        `Emit a pulsing ring every 2 s that deals ${8} damage and pushes back `
        + `all enemies within 200 units.`,
    apply: (player) => player.enableAura(),
};

const auraRangeUpgrade: UpgradeDefinition = {
    id: 'increase-aura-area',
    name: 'Increase Aura Range',
    maxStacks: 5,
    describe: () => `Increase the range of your aura by 20%`,
    apply: (player) => {
        player.getResolver(AuraResolver).getMultiplier().range *= 1.2;
    },
    requires: ["aura"]
};

const auraPulseUpgrade: UpgradeDefinition = {
    id: 'aura-pulse-upgrade',
    name: 'Faster Aura Pulses',
    maxStacks: 5,
    describe: () => `Increase the speed of your aura pulses by 10%`,
    apply: (player) => {
        player.getResolver(AuraResolver).getMultiplier().duration *= 0.9;
        player.getResolver(AuraResolver).getMultiplier().cooldown *= 0.7;
    },
    requires: ["aura"]
};

/**
 * All upgrade definitions available in a run.
 *
 * `LevelSystem` reads this array to build the roll pool on each level-up.
 * To add a new upgrade: define it above and append it here — no other
 * files need to change.
 */
export const ALL_UPGRADES: UpgradeDefinition[] = [
    flurry,
    juggernaut,
    magnet,
    wideCleave,
    ironSkin,
    lifesteal,
    healOverTime,
    shockwave,
    aftershock,
    auraShield,
    aura,
    auraRangeUpgrade,
    auraPulseUpgrade
];
