import type { HubKind, ResourceBag, ResourceKind } from '../models/game.types';
import { RESOURCE_KINDS } from '../models/game.types';
import { emptyBag } from './balance';

export interface HubSpec {
  readonly kind: HubKind;
  readonly name: string;
  readonly short: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly baseDays: number;
  readonly extraDaysPerLevel: number;
  readonly baseMoneyCost: number;
  /** Multiplier on cost per level beyond 1. cost(L) = base × growth^(L-1). */
  readonly costGrowth: number;
  readonly resourceCost: Partial<ResourceBag>;
  /** Per-level multiplicative bonus to a region's per-resource yield. */
  readonly yieldBonusPerLevel: Partial<Record<ResourceKind, number>>;
  /** Minimum region baseYields required for this hub to be buildable. */
  readonly minRegionYield: Partial<Record<ResourceKind, number>>;
  /** Research points generated per day, per level. */
  readonly researchPointsPerDay?: number;
  /** Intel coverage % generated per day, per level (applied to focused region). */
  readonly intelPerDay?: number;
  /** Military slots provided (Phase 4 placeholder). */
  readonly militarySlots?: number;
}

const HUB_LIST: ReadonlyArray<HubSpec> = [
  {
    kind: 'refinery',
    name: 'Oil Refinery',
    short: 'REF',
    description: 'Boosts Oil and Gas output. Requires petroleum reserves.',
    maxLevel: 5,
    baseDays: 30,
    extraDaysPerLevel: 18,
    baseMoneyCost: 600,
    costGrowth: 1.6,
    resourceCost: { iron: 8 },
    yieldBonusPerLevel: { oil: 0.3, gas: 0.2 },
    minRegionYield: { oil: 0.4 },
  },
  {
    kind: 'mine',
    name: 'Mine Complex',
    short: 'MIN',
    description: 'Extracts Iron, Coal, Gold, and Rare Earth from a region.',
    maxLevel: 5,
    baseDays: 25,
    extraDaysPerLevel: 16,
    baseMoneyCost: 450,
    costGrowth: 1.55,
    resourceCost: { iron: 4 },
    yieldBonusPerLevel: { iron: 0.25, coal: 0.25, gold: 0.2, rare: 0.2 },
    minRegionYield: { iron: 0.2 },
  },
  {
    kind: 'research_lab',
    name: 'Research Lab',
    short: 'LAB',
    description: 'Generates research points used to unlock tech.',
    maxLevel: 5,
    baseDays: 24,
    extraDaysPerLevel: 14,
    baseMoneyCost: 800,
    costGrowth: 1.7,
    resourceCost: { iron: 6 },
    yieldBonusPerLevel: {},
    minRegionYield: {},
    researchPointsPerDay: 0.6,
  },
  {
    kind: 'intel_agency',
    name: 'Intelligence Agency',
    short: 'INT',
    description: 'Raises intel coverage on the focused foreign region over time.',
    maxLevel: 5,
    baseDays: 22,
    extraDaysPerLevel: 14,
    baseMoneyCost: 700,
    costGrowth: 1.65,
    resourceCost: {},
    yieldBonusPerLevel: {},
    minRegionYield: {},
    intelPerDay: 0.15,
  },
  {
    kind: 'defense_plant',
    name: 'Defense Plant',
    short: 'DEF',
    description: 'Provides military slots and unlocks units (Phase 4).',
    maxLevel: 5,
    baseDays: 30,
    extraDaysPerLevel: 16,
    baseMoneyCost: 750,
    costGrowth: 1.65,
    resourceCost: { iron: 10, coal: 4 },
    yieldBonusPerLevel: {},
    minRegionYield: {},
    militarySlots: 1,
  },
];

const HUB_BY_KIND = new Map<HubKind, HubSpec>(HUB_LIST.map((s) => [s.kind, s]));

export const HUB_KINDS: ReadonlyArray<HubKind> = HUB_LIST.map((s) => s.kind);

export function hubSpec(kind: HubKind): HubSpec {
  const spec = HUB_BY_KIND.get(kind);
  if (!spec) throw new Error(`Unknown hub kind: ${kind}`);
  return spec;
}

export function hubCatalog(): ReadonlyArray<HubSpec> {
  return HUB_LIST;
}

/** Money cost to build/upgrade to targetLevel (1-indexed). */
export function buildMoneyCost(kind: HubKind, targetLevel: number): number {
  const s = hubSpec(kind);
  return Math.round(s.baseMoneyCost * Math.pow(s.costGrowth, targetLevel - 1));
}

/** Resource cost bag to build/upgrade to targetLevel. */
export function buildResourceCost(kind: HubKind, targetLevel: number): ResourceBag {
  const s = hubSpec(kind);
  const factor = Math.pow(s.costGrowth, targetLevel - 1);
  const bag = emptyBag();
  for (const k of RESOURCE_KINDS) {
    const v = s.resourceCost[k];
    if (v) bag[k] = +(v * factor).toFixed(1);
  }
  return bag;
}

/** Days required to build/upgrade to targetLevel. */
export function buildDays(kind: HubKind, targetLevel: number): number {
  const s = hubSpec(kind);
  return s.baseDays + (targetLevel - 1) * s.extraDaysPerLevel;
}

/** Sum of hub yield bonuses for a single resource across an array of hubs. */
export function hubYieldMultiplier(
  hubs: ReadonlyArray<{ kind: HubKind; level: number }>,
  resource: ResourceKind,
): number {
  let mult = 1;
  for (const h of hubs) {
    const bonus = hubSpec(h.kind).yieldBonusPerLevel[resource];
    if (bonus) mult += bonus * h.level;
  }
  return mult;
}

/** Returns true if a region's base yields meet a hub's minimum requirement. */
export function regionEligibleForHub(
  kind: HubKind,
  baseYields: ResourceBag,
): { ok: boolean; reason?: string } {
  const s = hubSpec(kind);
  for (const k of RESOURCE_KINDS) {
    const need = s.minRegionYield[k];
    if (need !== undefined && baseYields[k] < need) {
      return {
        ok: false,
        reason: `Requires base ${k} ≥ ${need.toFixed(2)} (region has ${baseYields[k].toFixed(2)}).`,
      };
    }
  }
  return { ok: true };
}
