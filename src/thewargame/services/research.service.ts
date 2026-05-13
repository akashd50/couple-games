import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { TECH_TREE, techNode } from '../data/tech-tree';
import type { TechNode } from '../data/tech-tree';
import { hubSpec } from '../data/hubs';
import { ClockService, formatGameDate } from './clock.service';
import type { TickEvent } from './clock.service';
import { GameService } from './game.service';
import { NewsService } from './news.service';

export interface TechCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

@Injectable()
export class ResearchService implements OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);
  private readonly news = inject(NewsService);

  readonly points = signal(0);
  readonly unlocked = signal<ReadonlySet<string>>(new Set<string>());

  readonly tree: ReadonlyArray<TechNode> = TECH_TREE;

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

  /** Per-day research point generation rate from player's research labs. */
  readonly rate = computed<number>(() => {
    const me = this.game.playerNation();
    if (!me) return 0;
    let rate = 0;
    for (const regionId of me.regionIds) {
      const r = this.game.getRegion(regionId);
      if (!r) continue;
      for (const h of r.hubs) {
        const spec = hubSpec(h.kind);
        if (spec.researchPointsPerDay) rate += spec.researchPointsPerDay * h.level;
      }
    }
    return rate;
  });

  isUnlocked(id: string): boolean {
    return this.unlocked().has(id);
  }

  /** Returns whether the player can unlock this node right now. */
  canUnlock(id: string): TechCheck {
    const node = techNode(id);
    if (this.isUnlocked(id)) return { ok: false, reason: 'Already unlocked.' };
    for (const p of node.prerequisites) {
      if (!this.isUnlocked(p)) return { ok: false, reason: `Requires: ${techNode(p).name}.` };
    }
    if (this.points() < node.cost) {
      return {
        ok: false,
        reason: `Need ${node.cost} RP (have ${this.points().toFixed(0)}).`,
      };
    }
    return { ok: true };
  }

  /** Spend points to unlock the node. Returns true on success. */
  unlock(id: string, currentDate: Date): boolean {
    const check = this.canUnlock(id);
    if (!check.ok) return false;
    const node = techNode(id);
    this.points.update((p) => p - node.cost);
    this.unlocked.update((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    this.news.push({
      date: formatGameDate(currentDate),
      category: 'system',
      severity: 'info',
      headline: `Research complete: ${node.name}.`,
      detail: node.description,
    });
    return true;
  }

  advance(tick: TickEvent): void {
    const rate = this.rate();
    if (rate === 0) return;
    this.points.update((p) => p + rate * tick.delta);
  }

  reset(): void {
    this.points.set(0);
    this.unlocked.set(new Set<string>());
  }
}
