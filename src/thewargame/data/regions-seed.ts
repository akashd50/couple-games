import type { RegionState, ResourceBag, ResourceKind } from '../models/game.types';
import { emptyBag } from './balance';

/**
 * Procedural seed for region simulation state.
 *
 * Phase 2 doesn't ship a hand-tuned per-state economy; instead we synthesize
 * stable, deterministic stats from each region's id so re-runs match. The
 * shape of this function is what matters — Phase 3+ can swap in curated data
 * (e.g. Texas favoring oil, Saskatchewan favoring potash) without changing
 * call sites.
 */
export function seedRegionState(id: string, country: string): RegionState {
  const h = hash(id);
  const r = (shift: number, mod: number) => Math.abs((h >>> shift) % mod);

  const population = +(0.4 + r(0, 280) / 10).toFixed(1); // 0.4 .. 28.4M
  const stability = 55 + r(7, 45); // 55..99
  const baseYields = synthesizeYields(h);

  return {
    id,
    nationId: country,
    baseYields,
    population,
    stability,
  };
}

function synthesizeYields(h: number): ResourceBag {
  const bag = emptyBag();
  const kinds: ResourceKind[] = ['oil', 'gas', 'iron', 'coal', 'gold', 'rare'];
  for (let i = 0; i < kinds.length; i++) {
    const raw = ((h >>> (i * 3)) & 0xff) / 255; // 0..1
    const scale = scaleFor(kinds[i]);
    bag[kinds[i]] = +(raw * scale).toFixed(3);
  }
  return bag;
}

function scaleFor(k: ResourceKind): number {
  switch (k) {
    case 'oil':
      return 6;
    case 'gas':
      return 5;
    case 'iron':
      return 4;
    case 'coal':
      return 4;
    case 'gold':
      return 0.06;
    case 'rare':
      return 0.5;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
