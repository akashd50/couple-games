import { Injectable, inject, signal } from '@angular/core';
import { BALANCE, BASE_PRICES, PRICE_BOUNDS, cloneBag } from '../data/balance';
import { hubYieldMultiplier } from '../data/hubs';
import { RESOURCE_KINDS, RESOURCE_LABELS } from '../models/game.types';
import type { RegionState, ResourceBag, ResourceKind } from '../models/game.types';
import type { TickEvent } from './clock.service';
import { formatGameDate } from './clock.service';
import { NewsService } from './news.service';
import { RngService } from './rng.service';

@Injectable()
export class ResourceService {
  private readonly news = inject(NewsService);
  private readonly rng = inject(RngService);

  /** Current world commodity prices. */
  readonly prices = signal<ResourceBag>(cloneBag(BASE_PRICES));

  /** Next day on or after which a jitter news entry is allowed. */
  private nextJitterDay = 0;

  /** Per-resource, per-day stability-adjusted yield including hub bonuses. */
  yieldFor(region: RegionState, resource: ResourceKind): number {
    const base = region.baseYields[resource] * stabilityFactor(region.stability);
    return base * hubYieldMultiplier(region.hubs, resource);
  }

  /** Total per-day stability-adjusted yield bag including hub bonuses. */
  yieldBag(region: RegionState): ResourceBag {
    const f = stabilityFactor(region.stability);
    const out = {} as ResourceBag;
    for (const k of RESOURCE_KINDS) {
      out[k] = region.baseYields[k] * f * hubYieldMultiplier(region.hubs, k);
    }
    return out;
  }

  /** Per-day revenue contributed by a region at current market prices. */
  revenueFor(region: RegionState): number {
    const bag = this.yieldBag(region);
    const p = this.prices();
    let sum = 0;
    for (const k of RESOURCE_KINDS) sum += bag[k] * p[k];
    return sum * BALANCE.yieldRevenueFactor;
  }

  /** Advance the market price walk. Called once per tick by GameService. */
  advance(tick: TickEvent): void {
    const next = cloneBag(this.prices());
    for (const k of RESOURCE_KINDS) {
      const base = BASE_PRICES[k];
      const current = next[k];
      const noise = (this.rng.next() * 2 - 1) * BALANCE.marketNoise;
      const drift = ((base - current) / base) * BALANCE.marketReversion;
      let price = current * (1 + noise + drift);
      const [lo, hi] = PRICE_BOUNDS[k];
      if (price < lo) price = lo;
      if (price > hi) price = hi;
      next[k] = +price.toFixed(2);
    }
    this.prices.set(next);

    if (tick.day >= this.nextJitterDay) {
      this.emitJitter(tick);
      this.nextJitterDay =
        tick.day +
        this.rng.int(BALANCE.marketJitterEveryDaysMin, BALANCE.marketJitterEveryDaysMax);
    }
  }

  reset(): void {
    this.prices.set(cloneBag(BASE_PRICES));
    this.nextJitterDay = 0;
  }

  private emitJitter(tick: TickEvent): void {
    const k = this.rng.pick(RESOURCE_KINDS);
    const price = this.prices()[k];
    const base = BASE_PRICES[k];
    const pct = ((price - base) / base) * 100;
    const dir = pct >= 0 ? '+' : '';
    const severity = Math.abs(pct) > 15 ? 'warning' : 'info';
    this.news.push({
      date: formatGameDate(tick.date),
      category: 'market',
      severity,
      headline: `Markets: ${RESOURCE_LABELS[k]} ${dir}${pct.toFixed(1)}% vs baseline`,
      detail: `${RESOURCE_LABELS[k]} trading at $${price.toFixed(2)} (baseline $${base}).`,
      resource: k,
    });
  }
}

export function stabilityFactor(stability: number): number {
  const norm = Math.max(0, Math.min(100, stability)) / 100;
  return BALANCE.minStabilityFactor + (1 - BALANCE.minStabilityFactor) * norm;
}
