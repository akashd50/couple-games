import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import type { NationId } from '../models/game.types';
import { ClockService, formatGameDate } from './clock.service';
import type { TickEvent } from './clock.service';
import { GameService } from './game.service';
import { NewsService } from './news.service';
import { RngService } from './rng.service';

/** Wall-clock chatter cadence per AI nation. */
const FLAVOR_EVERY_DAYS_MIN = 25;
const FLAVOR_EVERY_DAYS_MAX = 55;

interface NationAi {
  readonly id: NationId;
  /** Target relation with the player; AI drifts back toward this baseline. */
  baseline: number;
  /** Next day this AI is allowed to emit flavor news. */
  nextFlavorDay: number;
}

const CANADA_FLAVOR_HEADLINES = [
  'Ottawa pledges new infrastructure investment in northern provinces.',
  'Bank of Canada signals caution on commodity exposure.',
  'PM addresses Parliament on continental security.',
  'Canada announces renewable energy partnership.',
  'Ottawa monitors cross-border markets after US price swing.',
];

@Injectable()
export class AiService implements OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);
  private readonly news = inject(NewsService);
  private readonly rng = inject(RngService);

  private readonly ais = new Map<NationId, NationAi>();
  private tickSub: Subscription | null = null;
  private initStarted = false;

  init(): void {
    if (this.initStarted) return;
    this.initStarted = true;

    const player = this.game.playerNationId();
    for (const nation of this.game.foreignNations()) {
      this.ais.set(nation.id, {
        id: nation.id,
        baseline: nation.relations[player] ?? 0,
        nextFlavorDay: this.rng.int(FLAVOR_EVERY_DAYS_MIN, FLAVOR_EVERY_DAYS_MAX),
      });
    }
    this.tickSub = this.clock.tick$.subscribe((t) => this.onTick(t));
  }

  ngOnDestroy(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  private onTick(tick: TickEvent): void {
    const player = this.game.playerNationId();
    for (const ai of this.ais.values()) {
      this.driftRelation(ai, player, tick);
      this.maybeEmitFlavor(ai, tick);
    }
  }

  private driftRelation(ai: NationAi, player: NationId, tick: TickEvent): void {
    const nation = this.game.getNation(ai.id);
    if (!nation) return;
    const current = nation.relations[player] ?? 0;
    if (Math.abs(current - ai.baseline) < 0.5) return;
    // 0.05 points/day toward baseline; defensive nations restore a bit faster.
    const rate = nation.stance === 'defensive' ? 0.08 : 0.05;
    const step = Math.sign(ai.baseline - current) * rate * tick.delta;
    this.game.adjustRelation(ai.id, player, step);
  }

  private maybeEmitFlavor(ai: NationAi, tick: TickEvent): void {
    if (tick.day < ai.nextFlavorDay) return;
    const nation = this.game.getNation(ai.id);
    if (!nation) return;

    const pool = ai.id === 'CAN' ? CANADA_FLAVOR_HEADLINES : CANADA_FLAVOR_HEADLINES;
    this.news.push({
      date: formatGameDate(tick.date),
      category: 'diplomacy',
      severity: 'info',
      headline: `${nation.name}: ${this.rng.pick(pool)}`,
      nationId: ai.id,
    });
    ai.nextFlavorDay = tick.day + this.rng.int(FLAVOR_EVERY_DAYS_MIN, FLAVOR_EVERY_DAYS_MAX);
  }
}
