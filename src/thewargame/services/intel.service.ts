import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BALANCE } from '../data/balance';
import { hubSpec } from '../data/hubs';
import type { RegionId } from '../models/game.types';
import { ClockService, formatGameDate } from './clock.service';
import type { TickEvent } from './clock.service';
import { GameService } from './game.service';
import { NewsService } from './news.service';

export interface IntelSpendResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly newCoverage?: number;
}

@Injectable()
export class IntelService implements OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);
  private readonly news = inject(NewsService);

  /** Per-foreign-region coverage 0..100. Defaults to BALANCE.intelStartingCoverage. */
  readonly coverage = signal<ReadonlyMap<RegionId, number>>(new Map());
  /** Region currently receiving passive intel-agency gain. */
  readonly focusedRegion = signal<RegionId | null>(null);

  private tickSub: Subscription | null = null;
  private initStarted = false;

  init(): void {
    if (this.initStarted) return;
    this.initStarted = true;
    this.tickSub = this.clock.tick$.subscribe((t) => this.advance(t));
  }

  ngOnDestroy(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  /** Per-day intel-agency contribution rate for the player. */
  readonly agencyRate = computed<number>(() => {
    const me = this.game.playerNation();
    if (!me) return 0;
    let rate = 0;
    for (const regionId of me.regionIds) {
      const r = this.game.getRegion(regionId);
      if (!r) continue;
      for (const h of r.hubs) {
        const spec = hubSpec(h.kind);
        if (spec.intelPerDay) rate += spec.intelPerDay * h.level;
      }
    }
    return rate;
  });

  getCoverage(regionId: RegionId): number {
    return this.coverage().get(regionId) ?? BALANCE.intelStartingCoverage;
  }

  setFocus(regionId: RegionId | null): void {
    this.focusedRegion.set(regionId);
  }

  /** Spend dollars on this foreign region's coverage. Returns the resulting coverage. */
  spend(regionId: RegionId, dollars: number, currentDate: Date): IntelSpendResult {
    if (dollars <= 0) return { ok: false, reason: 'Invalid amount.' };
    const me = this.game.playerNation();
    if (!me) return { ok: false, reason: 'No player nation.' };
    if (me.money < dollars) return { ok: false, reason: 'Insufficient funds.' };
    const current = this.getCoverage(regionId);
    if (current >= 100) return { ok: false, reason: 'Already at 100% coverage.' };

    if (!this.game.spendForPlayer(dollars, this.game.zeroBag())) {
      return { ok: false, reason: 'Insufficient funds.' };
    }
    const gained = dollars / BALANCE.intelCostPer1Pct;
    const next = Math.min(100, current + gained);
    this.bumpCoverage(regionId, next);

    if (Math.floor(next / 25) > Math.floor(current / 25)) {
      this.news.push({
        date: formatGameDate(currentDate),
        category: 'intel',
        severity: 'info',
        headline: `Intel coverage on ${regionId} reaches ${next.toFixed(0)}%.`,
        regionId,
      });
    }
    return { ok: true, newCoverage: next };
  }

  /** Called from GameService.onTick. Agencies contribute to focused region. */
  advance(tick: TickEvent): void {
    const focus = this.focusedRegion();
    if (!focus) return;
    const rate = this.agencyRate();
    if (rate === 0) return;
    const current = this.getCoverage(focus);
    if (current >= 100) return;
    const next = Math.min(100, current + rate * tick.delta);
    this.bumpCoverage(focus, next);
  }

  reset(): void {
    this.coverage.set(new Map());
    this.focusedRegion.set(null);
  }

  private bumpCoverage(regionId: RegionId, value: number): void {
    this.coverage.update((prev) => {
      const next = new Map(prev);
      next.set(regionId, +value.toFixed(2));
      return next;
    });
  }
}
