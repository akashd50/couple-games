import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  buildDays,
  buildMoneyCost,
  buildResourceCost,
  hubSpec,
  regionEligibleForHub,
} from '../data/hubs';
import type { BuildOrder, Hub, HubKind, RegionId, RegionState } from '../models/game.types';
import { ClockService, formatGameDate } from './clock.service';
import type { TickEvent } from './clock.service';
import { GameService } from './game.service';
import { NewsService } from './news.service';

export interface BuildPlan {
  readonly kind: HubKind;
  readonly targetLevel: number;
  readonly moneyCost: number;
  readonly resourceCost: import('../models/game.types').ResourceBag;
  readonly days: number;
}

export interface BuildCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

function makeId(prefix: string, seq: number): string {
  return `${prefix}-${seq.toString(36)}`;
}

@Injectable()
export class ConstructionService implements OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);
  private readonly news = inject(NewsService);

  private nextOrderId = 1;
  private nextHubId = 1;
  private tickSub: Subscription | null = null;
  private initStarted = false;

  private readonly _orders = signal<ReadonlyArray<BuildOrder>>([]);
  readonly orders = this._orders.asReadonly();

  init(): void {
    if (this.initStarted) return;
    this.initStarted = true;
    this.tickSub = this.clock.tick$.subscribe((t) => this.advance(t));
  }

  ngOnDestroy(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  readonly playerOrders = computed<ReadonlyArray<BuildOrder>>(() => {
    const me = this.game.playerNation();
    if (!me) return [];
    const owned = new Set(me.regionIds);
    return this._orders().filter((o) => owned.has(o.regionId));
  });

  ordersFor(regionId: RegionId): ReadonlyArray<BuildOrder> {
    return this._orders().filter((o) => o.regionId === regionId);
  }

  /** Build-plan summary; used by UI to display cost/effect. */
  planFor(kind: HubKind, targetLevel: number): BuildPlan {
    return {
      kind,
      targetLevel,
      moneyCost: buildMoneyCost(kind, targetLevel),
      resourceCost: buildResourceCost(kind, targetLevel),
      days: buildDays(kind, targetLevel),
    };
  }

  /** Can the player build a new hub of `kind` on `slotIndex` in `region`? */
  canBuild(region: RegionState, kind: HubKind, slotIndex: number): BuildCheck {
    if (slotIndex < 0 || slotIndex >= region.slots) {
      return { ok: false, reason: 'No such slot in this region.' };
    }
    if (region.hubs.some((h) => h.slotIndex === slotIndex)) {
      return { ok: false, reason: 'Slot already occupied.' };
    }
    if (this.ordersFor(region.id).some((o) => o.slotIndex === slotIndex)) {
      return { ok: false, reason: 'A build is already queued on this slot.' };
    }
    const eligibility = regionEligibleForHub(kind, region.baseYields);
    if (!eligibility.ok) return eligibility;
    return { ok: true };
  }

  canUpgrade(region: RegionState, hub: Hub): BuildCheck {
    const spec = hubSpec(hub.kind);
    if (hub.level >= spec.maxLevel) return { ok: false, reason: 'Hub is at max level.' };
    if (this.ordersFor(region.id).some((o) => o.hubId === hub.id)) {
      return { ok: false, reason: 'Upgrade already in progress.' };
    }
    return { ok: true };
  }

  /** Queue a new build at slot. Returns the order or null if not allowed/affordable. */
  build(region: RegionState, kind: HubKind, slotIndex: number, currentDay: number, currentDate: Date): BuildOrder | null {
    const check = this.canBuild(region, kind, slotIndex);
    if (!check.ok) return null;
    const plan = this.planFor(kind, 1);
    if (!this.game.spendForPlayer(plan.moneyCost, plan.resourceCost)) {
      this.news.push({
        date: formatGameDate(currentDate),
        category: 'system',
        severity: 'warning',
        headline: `Cannot afford ${hubSpec(kind).name} in ${region.id}.`,
        regionId: region.id,
      });
      return null;
    }
    const order: BuildOrder = {
      id: makeId('ord', this.nextOrderId++),
      regionId: region.id,
      hubKind: kind,
      slotIndex,
      targetLevel: 1,
      startDay: currentDay,
      completionDay: currentDay + plan.days,
      moneyCost: plan.moneyCost,
      resourceCost: plan.resourceCost,
    };
    this._orders.update((prev) => [...prev, order]);
    this.news.push({
      date: formatGameDate(currentDate),
      category: 'system',
      severity: 'info',
      headline: `Construction started: ${hubSpec(kind).name} in ${region.id} (ETA ${plan.days}d).`,
      regionId: region.id,
    });
    return order;
  }

  /** Queue an upgrade order on an existing hub. */
  upgrade(region: RegionState, hub: Hub, currentDay: number, currentDate: Date): BuildOrder | null {
    const check = this.canUpgrade(region, hub);
    if (!check.ok) return null;
    const targetLevel = hub.level + 1;
    const plan = this.planFor(hub.kind, targetLevel);
    if (!this.game.spendForPlayer(plan.moneyCost, plan.resourceCost)) {
      this.news.push({
        date: formatGameDate(currentDate),
        category: 'system',
        severity: 'warning',
        headline: `Cannot afford upgrade to ${hubSpec(hub.kind).name} L${targetLevel} in ${region.id}.`,
        regionId: region.id,
      });
      return null;
    }
    const order: BuildOrder = {
      id: makeId('ord', this.nextOrderId++),
      regionId: region.id,
      hubKind: hub.kind,
      hubId: hub.id,
      targetLevel,
      startDay: currentDay,
      completionDay: currentDay + plan.days,
      moneyCost: plan.moneyCost,
      resourceCost: plan.resourceCost,
    };
    this._orders.update((prev) => [...prev, order]);
    this.news.push({
      date: formatGameDate(currentDate),
      category: 'system',
      severity: 'info',
      headline: `Upgrade started: ${hubSpec(hub.kind).name} → L${targetLevel} in ${region.id} (ETA ${plan.days}d).`,
      regionId: region.id,
    });
    return order;
  }

  /** Called from GameService.onTick after production. Completes orders. */
  advance(tick: TickEvent): void {
    const orders = this._orders();
    if (orders.length === 0) return;
    const remaining: BuildOrder[] = [];
    const completed: BuildOrder[] = [];
    for (const o of orders) {
      if (tick.day >= o.completionDay) completed.push(o);
      else remaining.push(o);
    }
    if (completed.length === 0) return;
    for (const o of completed) this.completeOrder(o, tick);
    this._orders.set(remaining);
  }

  reset(): void {
    this._orders.set([]);
    this.nextOrderId = 1;
    this.nextHubId = 1;
  }

  private completeOrder(o: BuildOrder, tick: TickEvent): void {
    if (o.hubId !== undefined) {
      this.game.upgradeHub(o.regionId, o.hubId, o.targetLevel);
      this.news.push({
        date: formatGameDate(tick.date),
        category: 'system',
        severity: 'info',
        headline: `${hubSpec(o.hubKind).name} upgraded to L${o.targetLevel} in ${o.regionId}.`,
        regionId: o.regionId,
      });
    } else if (o.slotIndex !== undefined) {
      const hub: Hub = {
        id: makeId('hub', this.nextHubId++),
        kind: o.hubKind,
        slotIndex: o.slotIndex,
        level: o.targetLevel,
        builtOnDay: tick.day,
      };
      this.game.addHub(o.regionId, hub);
      this.news.push({
        date: formatGameDate(tick.date),
        category: 'system',
        severity: 'info',
        headline: `${hubSpec(o.hubKind).name} completed in ${o.regionId}.`,
        regionId: o.regionId,
      });
    }
  }
}
