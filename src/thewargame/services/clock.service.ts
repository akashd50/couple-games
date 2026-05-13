import { Injectable, OnDestroy, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BALANCE } from '../data/balance';

export type Speed = 1 | 5 | 20;

export interface ClockState {
  /** Game date (in-game). */
  readonly date: Date;
  readonly speed: Speed;
  readonly paused: boolean;
  /** Days elapsed since startDate. */
  readonly day: number;
}

export interface TickEvent {
  /** Game date *after* the tick advanced. */
  readonly date: Date;
  /** Days since start, after the tick. */
  readonly day: number;
  /** Number of in-game days advanced this tick (always >= 1). */
  readonly delta: number;
}

const START_DATE = new Date(Date.UTC(2027, 0, 1));
/** Cap how many days we advance in a single frame so a stalled tab doesn't
 *  jump weeks the next frame. */
const MAX_DAYS_PER_FRAME = 6;

@Injectable()
export class ClockService implements OnDestroy {
  readonly tick$: Observable<TickEvent>;
  private readonly tickEmitter = new Subject<TickEvent>();

  readonly state = signal<ClockState>({
    date: new Date(START_DATE),
    speed: 1,
    paused: true,
    day: 0,
  });

  readonly date = signal<Date>(new Date(START_DATE));
  readonly day = signal<number>(0);
  readonly speed = signal<Speed>(1);
  readonly paused = signal<boolean>(true);

  private raf = 0;
  private lastFrame = 0;
  /** Fractional day accumulator (in days) so partial-frame advance carries over. */
  private dayAccumulator = 0;

  constructor() {
    this.tick$ = this.tickEmitter.asObservable();
    this.startRaf();
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.tickEmitter.complete();
  }

  play(): void {
    if (!this.paused()) return;
    this.paused.set(false);
    this.state.update((s) => ({ ...s, paused: false }));
    this.lastFrame = performance.now();
  }

  pause(): void {
    if (this.paused()) return;
    this.paused.set(true);
    this.state.update((s) => ({ ...s, paused: true }));
  }

  togglePause(): void {
    if (this.paused()) this.play();
    else this.pause();
  }

  setSpeed(speed: Speed): void {
    this.speed.set(speed);
    this.state.update((s) => ({ ...s, speed }));
    // If user picks a speed while paused, treat that as a play intent so the
    // keyboard mapping (1/2/3) feels right.
    if (this.paused()) this.play();
  }

  reset(startDate: Date = new Date(START_DATE)): void {
    this.pause();
    this.dayAccumulator = 0;
    this.date.set(new Date(startDate));
    this.day.set(0);
    this.speed.set(1);
    this.state.set({ date: new Date(startDate), speed: 1, paused: true, day: 0 });
  }

  private startRaf(): void {
    this.lastFrame = performance.now();
    const step = (now: number) => {
      const dtMs = now - this.lastFrame;
      this.lastFrame = now;
      if (!this.paused()) this.advance(dtMs);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private advance(dtMs: number): void {
    const daysPerSec = this.speed() / BALANCE.baseSecondsPerDay;
    this.dayAccumulator += (dtMs / 1000) * daysPerSec;
    if (this.dayAccumulator < 1) return;

    let whole = Math.floor(this.dayAccumulator);
    this.dayAccumulator -= whole;
    if (whole > MAX_DAYS_PER_FRAME) whole = MAX_DAYS_PER_FRAME;

    const prevDate = this.date();
    const nextDate = new Date(prevDate.getTime());
    nextDate.setUTCDate(nextDate.getUTCDate() + whole);
    const nextDay = this.day() + whole;

    this.date.set(nextDate);
    this.day.set(nextDay);
    this.state.update((s) => ({ ...s, date: nextDate, day: nextDay }));

    this.tickEmitter.next({ date: nextDate, day: nextDay, delta: whole });
  }
}

export function formatGameDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
