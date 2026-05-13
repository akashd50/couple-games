import { Injectable } from '@angular/core';

/**
 * Seeded PRNG (mulberry32). Reproducible across saves: same seed yields the
 * same stream. All gameplay randomness should route through this so loading a
 * save plays the same way it did when saved.
 */
@Injectable({ providedIn: 'root' })
export class RngService {
  private state = 0;
  private currentSeed = 0;

  setSeed(seed: number): void {
    this.currentSeed = seed >>> 0;
    this.state = this.currentSeed || 1;
  }

  seed(): number {
    return this.currentSeed;
  }

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns int in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns float in [min, max). */
  range(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: ReadonlyArray<T>): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
