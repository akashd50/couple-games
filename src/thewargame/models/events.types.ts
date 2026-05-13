import type { NationId, RegionId, ResourceKind } from './game.types';

export type NewsCategory = 'system' | 'market' | 'diplomacy' | 'intel' | 'combat';
export type NewsSeverity = 'info' | 'warning' | 'critical';

export interface NewsEvent {
  readonly id: number;
  /** Game-time ISO date the event occurred (YYYY-MM-DD). */
  readonly date: string;
  readonly category: NewsCategory;
  readonly severity: NewsSeverity;
  readonly headline: string;
  readonly detail?: string;
  readonly nationId?: NationId;
  readonly regionId?: RegionId;
  readonly resource?: ResourceKind;
}
