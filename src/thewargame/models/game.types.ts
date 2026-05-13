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
}

export interface MarketSample {
  readonly day: number;
  readonly prices: ResourceBag;
}
