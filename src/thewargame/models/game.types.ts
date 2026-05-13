export type NationId = string;
export type RegionId = string;

export type ResourceKind = 'oil' | 'gas' | 'iron' | 'coal' | 'gold' | 'rare';

export const RESOURCE_KINDS: ReadonlyArray<ResourceKind> = [
  'oil',
  'gas',
  'iron',
  'coal',
  'gold',
  'rare',
];

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  oil: 'Oil',
  gas: 'Gas',
  iron: 'Iron',
  coal: 'Coal',
  gold: 'Gold',
  rare: 'Rare Earth',
};

export type ResourceBag = Record<ResourceKind, number>;

export type HubKind = 'refinery' | 'mine' | 'research_lab' | 'intel_agency' | 'defense_plant';

export interface Hub {
  readonly id: string;
  readonly kind: HubKind;
  readonly slotIndex: number;
  level: number;
  builtOnDay: number;
}

export interface BuildOrder {
  readonly id: string;
  readonly regionId: RegionId;
  readonly hubKind: HubKind;
  /** Set when this is a new build (target slot). */
  readonly slotIndex?: number;
  /** Set when this is an upgrade (existing hub id). */
  readonly hubId?: string;
  readonly targetLevel: number;
  readonly startDay: number;
  readonly completionDay: number;
  readonly moneyCost: number;
  readonly resourceCost: ResourceBag;
}

export interface Nation {
  readonly id: NationId;
  readonly name: string;
  readonly accent: string;
  money: number;
  stockpiles: ResourceBag;
  relations: Record<NationId, number>;
  readonly regionIds: ReadonlyArray<RegionId>;
  /** Optional AI stance flavor; player nation can leave this empty. */
  stance: 'player' | 'defensive' | 'opportunistic';
}

export interface RegionState {
  readonly id: RegionId;
  readonly nationId: NationId;
  /** Per-tick (per-day) base production, before stability multiplier. */
  baseYields: ResourceBag;
  /** People, in millions. */
  population: number;
  /** 0..100. */
  stability: number;
  /** Max build slots in this region. */
  readonly slots: number;
  /** Hubs (built buildings) in this region. */
  hubs: ReadonlyArray<Hub>;
}

export interface MarketSample {
  readonly day: number;
  readonly prices: ResourceBag;
}
