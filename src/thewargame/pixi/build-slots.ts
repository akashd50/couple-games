import { Container, Graphics } from 'pixi.js';
import type { RegionState } from '../models/game.types';
import type { Region } from '../models/geo.types';
import { pointInRegion } from './hit-test';

export interface SlotPosition {
  /** World x coordinate. */
  readonly x: number;
  /** World y coordinate. */
  readonly y: number;
  readonly regionId: string;
  readonly slotIndex: number;
}

export interface SlotsRendererPalette {
  readonly empty: number;
  readonly occupied: number;
  readonly pending: number;
}

interface RegionSlotsInput {
  readonly state: RegionState;
  readonly region: Region;
  /** Slot indices that currently have an order pending. */
  readonly pendingSlotIndices: ReadonlySet<number>;
}

/**
 * Deterministic positions of build slots inside a region polygon. Uses a tiny
 * mulberry32 PRNG seeded by region id so positions are stable across reloads.
 */
export function computeSlotPositions(region: Region, slotCount: number): SlotPosition[] {
  const out: SlotPosition[] = [];
  if (slotCount <= 0) return out;
  const seed = hashSeed(region.id);
  let state = seed || 1;
  const rand = () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const { minX, minY, maxX, maxY } = region.bbox;
  const w = maxX - minX;
  const h = maxY - minY;

  const minDist = Math.min(w, h) * 0.18; // soft spacing between slots
  const minDist2 = minDist * minDist;
  const maxAttempts = 200;

  let attempts = 0;
  while (out.length < slotCount && attempts < maxAttempts) {
    attempts++;
    const x = minX + rand() * w;
    const y = minY + rand() * h;
    if (!pointInRegion(x, y, region)) continue;
    let tooClose = false;
    for (const p of out) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDist2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    out.push({ x, y, regionId: region.id, slotIndex: out.length });
  }

  // Fallback: relax minimum spacing if we ran out of attempts.
  while (out.length < slotCount && attempts < maxAttempts * 2) {
    attempts++;
    const x = minX + rand() * w;
    const y = minY + rand() * h;
    if (!pointInRegion(x, y, region)) continue;
    out.push({ x, y, regionId: region.id, slotIndex: out.length });
  }

  // Last resort: drop at the bbox center.
  if (out.length === 0) {
    out.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, regionId: region.id, slotIndex: 0 });
  }
  return out;
}

/** Renders build-slot indicators (plus circles) in a Pixi Container. */
export class BuildSlotsRenderer {
  private readonly container: Container;
  private palette: SlotsRendererPalette;
  private regionsInput: ReadonlyArray<RegionSlotsInput> = [];
  private slotsCache = new Map<string, SlotPosition[]>(); // regionId → positions
  /** Last rendered positions with their occupancy color. Used for click hit-test. */
  private flatSlots: ReadonlyArray<SlotPosition> = [];

  constructor(parent: Container, palette: SlotsRendererPalette) {
    this.container = new Container();
    this.container.label = 'build-slots';
    this.container.eventMode = 'none';
    parent.addChild(this.container);
    this.palette = palette;
  }

  setPalette(palette: SlotsRendererPalette): void {
    this.palette = palette;
    this.repaint();
  }

  setRegions(input: ReadonlyArray<RegionSlotsInput>): void {
    this.regionsInput = input;
    // Cache positions per region (keyed by region id + slot count).
    for (const it of input) {
      const key = `${it.state.id}:${it.state.slots}`;
      if (!this.slotsCache.has(key)) {
        this.slotsCache.set(key, computeSlotPositions(it.region, it.state.slots));
      }
    }
    this.repaint();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /** All slot positions currently rendered, in world coords. */
  positions(): ReadonlyArray<SlotPosition> {
    return this.flatSlots;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.slotsCache.clear();
    this.regionsInput = [];
    this.flatSlots = [];
  }

  private repaint(): void {
    this.container.removeChildren();
    const out: SlotPosition[] = [];
    for (const it of this.regionsInput) {
      const key = `${it.state.id}:${it.state.slots}`;
      const positions = this.slotsCache.get(key) ?? [];
      const filledIndices = new Set<number>();
      for (const h of it.state.hubs) filledIndices.add(h.slotIndex);
      for (const pos of positions) {
        const occupied = filledIndices.has(pos.slotIndex);
        const pending = !occupied && it.pendingSlotIndices.has(pos.slotIndex);
        const color = occupied ? this.palette.occupied : pending ? this.palette.pending : this.palette.empty;
        const g = drawSlot(pos.x, pos.y, color, occupied);
        this.container.addChild(g);
        out.push(pos);
      }
    }
    this.flatSlots = out;
  }
}

function drawSlot(x: number, y: number, color: number, filled: boolean): Graphics {
  // Radius in world units; visible at subdivision zoom (~scale 3+).
  const r = 1.5;
  const g = new Graphics();
  g.circle(x, y, r).fill({ color, alpha: filled ? 1 : 0.85 });
  g.stroke({ color: 0xffffff, width: 0.2, alpha: 0.9, pixelLine: true });
  // Plus marker inside (only visible when empty).
  if (!filled) {
    const m = r * 0.55;
    g.moveTo(x - m, y).lineTo(x + m, y);
    g.moveTo(x, y - m).lineTo(x, y + m);
    g.stroke({ color: 0xffffff, width: 0.35, alpha: 1, pixelLine: true });
  }
  return g;
}

function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
