import type { ResourceBag, ResourceKind } from '../models/game.types';
import { RESOURCE_KINDS } from '../models/game.types';

export const BALANCE = {
    /** Wall-clock seconds per game day at 1× speed. */
    baseSecondsPerDay: 1,
    /** Game ticks per emitted news entry from the market service (random window). */
    marketJitterEveryDaysMin: 6,
    marketJitterEveryDaysMax: 14,
    /** Per-tick price walk amplitude (±). */
    marketNoise: 0.04,
    /** Soft band that drags prices back toward base, per tick. */
    marketReversion: 0.02,
    /** How much each region's yield contributes to national money per tick. */
    yieldRevenueFactor: 1,
    /** Starting national money for the player. */
    startingMoney: 5000,
    /** Per-tick national upkeep (drains money). */
    baseUpkeep: 2,
    /** Stability multiplier curve: stability of 100 == 1.0×, 0 == 0.4×. */
    minStabilityFactor: 0.4,
    /** Slot count bounds per region. */
    minSlotsPerRegion: 2,
    maxSlotsPerRegion: 8,
    /** Intel: money spent per +1% coverage on a foreign region. */
    intelCostPer1Pct: 80,
    /** Intel: starting coverage % vs foreign regions. */
    intelStartingCoverage: 5,
    /** Tech research-point allocation: minimum points held before unlocking. */
    minPointsToCommitTech: 0,
};

export const BASE_PRICES: ResourceBag = {
    oil: 70,
    gas: 30,
    iron: 18,
    coal: 12,
    gold: 1900,
    rare: 240,
};

/** Hard clamp bounds for prices so the walk can't diverge. */
export const PRICE_BOUNDS: Record<ResourceKind, readonly [number, number]> = {
    oil: [25, 200],
    gas: [10, 90],
    iron: [6, 60],
    coal: [4, 40],
    gold: [900, 3500],
    rare: [80, 700],
};

export function emptyBag(): ResourceBag {
    const out = {} as ResourceBag;
    for (const k of RESOURCE_KINDS) out[k] = 0;
    return out;
}

export function cloneBag(b: ResourceBag): ResourceBag {
    return {...b};
}

export function addBag(a: ResourceBag, b: ResourceBag): ResourceBag {
    const out = emptyBag();
    for (const k of RESOURCE_KINDS) out[k] = a[k] + b[k];
    return out;
}

export function subBag(a: ResourceBag, b: ResourceBag): ResourceBag {
    const out = emptyBag();
    for (const k of RESOURCE_KINDS) out[k] = a[k] - b[k];
    return out;
}

export function bagCovers(have: ResourceBag, need: ResourceBag): boolean {
    for (const k of RESOURCE_KINDS) if (have[k] < need[k]) return false;
    return true;
}

export function bagIsZero(b: ResourceBag): boolean {
    for (const k of RESOURCE_KINDS) if (b[k] !== 0) return false;
    return true;
}
