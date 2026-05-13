import { Injectable, computed, signal } from '@angular/core';
import type { NewsEvent } from '../models/events.types';

const ACTIVE_CAP = 50;
const HISTORY_CAP = 500;

@Injectable()
export class NewsService {
  private nextId = 1;

  private readonly _events = signal<ReadonlyArray<NewsEvent>>([]);
  /** Newest first, capped. Suitable for the ticker. */
  readonly events = this._events.asReadonly();

  /** Full history (also newest first), capped longer for the popup. */
  readonly history = computed(() => this._events());

  /** Latest event for marquee placement. */
  readonly latest = computed(() => this._events()[0] ?? null);

  push(event: Omit<NewsEvent, 'id'>): NewsEvent {
    const entry: NewsEvent = { ...event, id: this.nextId++ };
    this._events.update((prev) => {
      const next = [entry, ...prev];
      if (next.length > HISTORY_CAP) next.length = HISTORY_CAP;
      return next;
    });
    return entry;
  }

  /** Convenience used by other services. */
  recent(limit = ACTIVE_CAP): ReadonlyArray<NewsEvent> {
    const all = this._events();
    return all.length <= limit ? all : all.slice(0, limit);
  }

  clear(): void {
    this._events.set([]);
    this.nextId = 1;
  }
}
