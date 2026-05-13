import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BALANCE, emptyBag } from '../data/balance';
import { NATION_SEEDS, PLAYER_NATION_ID, buildNation } from '../data/nations';
import { seedRegionState } from '../data/regions-seed';
import { RESOURCE_KINDS } from '../models/game.types';
import type { Nation, NationId, RegionId, RegionState, ResourceBag } from '../models/game.types';
import type { Region } from '../models/geo.types';
import { ClockService } from './clock.service';
import type { TickEvent } from './clock.service';
import { GeoService } from './geo.service';
import { ResourceService, stabilityFactor } from './resource.service';
import { RngService } from './rng.service';

const DEFAULT_SEED = 0xc0ffee;

@Injectable()
export class GameService implements OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly geo = inject(GeoService);
  private readonly resources = inject(ResourceService);
  private readonly rng = inject(RngService);

  readonly ready = signal(false);
  readonly playerNationId = signal<NationId>(PLAYER_NATION_ID);

  /** Source-of-truth maps. Mutated through update() so signal consumers re-run. */
  readonly nations = signal<ReadonlyMap<NationId, Nation>>(new Map());
  readonly regions = signal<ReadonlyMap<RegionId, RegionState>>(new Map());

  readonly playerNation = computed<Nation | null>(
    () => this.nations().get(this.playerNationId()) ?? null,
  );

  readonly foreignNations = computed<ReadonlyArray<Nation>>(() => {
    const me = this.playerNationId();
    return [...this.nations().values()].filter((n) => n.id !== me);
  });

  /** Player's per-day net income at current market prices, gross of upkeep. */
  readonly playerDailyIncome = computed(() => {
    const me = this.playerNation();
    if (!me) return 0;
    let income = 0;
    const regions = this.regions();
    for (const id of me.regionIds) {
      const r = regions.get(id);
      if (!r) continue;
      income += this.resources.revenueFor(r);
    }
    return income - BALANCE.baseUpkeep;
  });

  /** Player's per-day yield bag (raw resources produced, before market). */
  readonly playerDailyYield = computed<ResourceBag>(() => {
    const me = this.playerNation();
    const out = emptyBag();
    if (!me) return out;
    const regions = this.regions();
    for (const id of me.regionIds) {
      const r = regions.get(id);
      if (!r) continue;
      const f = stabilityFactor(r.stability);
      for (const k of RESOURCE_KINDS) out[k] += r.baseYields[k] * f;
    }
    return out;
  });

  private tickSub: Subscription | null = null;
  private initStarted = false;

  async init(seed = DEFAULT_SEED): Promise<void> {
    if (this.initStarted) return;
    this.initStarted = true;
    this.rng.setSeed(seed);

    const index = await this.geo.load();
    this.bootstrapFromGeo(index.subdivisions);
    this.resources.reset();
    this.ready.set(true);

    this.tickSub = this.clock.tick$.subscribe((t) => this.onTick(t));
  }

  ngOnDestroy(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  getRegion(id: RegionId): RegionState | null {
    return this.regions().get(id) ?? null;
  }

  getNation(id: NationId): Nation | null {
    return this.nations().get(id) ?? null;
  }

  /** Update a single nation immutably and republish the nations map. */
  updateNation(id: NationId, mut: (n: Nation) => Nation): void {
    const map = this.nations();
    const current = map.get(id);
    if (!current) return;
    const next = new Map(map);
    next.set(id, mut(current));
    this.nations.set(next);
  }

  /** Used by AI to nudge a relation. Clamps to [-100, 100]. */
  adjustRelation(from: NationId, to: NationId, delta: number): void {
    this.updateNation(from, (n) => {
      const current = n.relations[to] ?? 0;
      const next = Math.max(-100, Math.min(100, current + delta));
      return { ...n, relations: { ...n.relations, [to]: next } };
    });
  }

  private bootstrapFromGeo(subdivisions: ReadonlyArray<Region>): void {
    const regionsByNation = new Map<NationId, RegionId[]>();
    const regions = new Map<RegionId, RegionState>();

    for (const r of subdivisions) {
      const state = seedRegionState(r.id, r.country);
      regions.set(r.id, state);
      let list = regionsByNation.get(r.country);
      if (!list) {
        list = [];
        regionsByNation.set(r.country, list);
      }
      list.push(r.id);
    }

    const nations = new Map<NationId, Nation>();
    for (const seed of NATION_SEEDS) {
      const ids = regionsByNation.get(seed.id) ?? [];
      const nation = buildNation(seed, ids);
      if (seed.id === PLAYER_NATION_ID) nation.money = BALANCE.startingMoney;
      nations.set(seed.id, nation);
    }

    this.regions.set(regions);
    this.nations.set(nations);
  }

  private onTick(tick: TickEvent): void {
    // 1. Advance market prices first so revenue uses post-tick prices.
    this.resources.advance(tick);

    // 2. Apply per-region production to each owner nation, immutably.
    const map = this.nations();
    const regionMap = this.regions();
    const nextNations = new Map<NationId, Nation>();
    for (const [id, nation] of map) {
      const stockpiles = { ...nation.stockpiles };
      let revenue = 0;
      for (const regionId of nation.regionIds) {
        const region = regionMap.get(regionId);
        if (!region) continue;
        const bag = this.resources.yieldBag(region);
        for (const k of RESOURCE_KINDS) stockpiles[k] += bag[k] * tick.delta;
        revenue += this.resources.revenueFor(region) * tick.delta;
      }
      const upkeep = BALANCE.baseUpkeep * tick.delta;
      nextNations.set(id, {
        ...nation,
        stockpiles,
        money: nation.money + revenue - upkeep,
      });
    }
    this.nations.set(nextNations);
  }
}
