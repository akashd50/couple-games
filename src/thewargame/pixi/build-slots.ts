import { Container, Graphics } from 'pixi.js';
import { drawHubGlyph } from '../data/hub-icons';
import type { Hub, HubKind, RegionState } from '../models/game.types';
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

export interface PendingSlotInfo {
  readonly kind: HubKind;
  /** 0..1 build progress (start → completion). */
  readonly progress: number;
  /** True if upgrading an existing hub (vs. new build on an empty slot). */
  readonly isUpgrade: boolean;
}

export interface SlotsRendererPalette {
  readonly empty: number;
  readonly occupied: number;
  readonly pending: number;
  readonly progress: number;
}

export interface RegionSlotsInput {
  readonly state: RegionState;
  readonly region: Region;
  /** Pending build/upgrade orders keyed by slotIndex. */
  readonly pendingBySlotIndex: ReadonlyMap<number, PendingSlotInfo>;
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
      const hubBySlot = new Map<number, Hub>();
      for (const h of it.state.hubs) hubBySlot.set(h.slotIndex, h);
      for (const pos of positions) {
        const hub = hubBySlot.get(pos.slotIndex) ?? null;
        const pending = it.pendingBySlotIndex.get(pos.slotIndex) ?? null;
        const g = drawSlot(pos.x, pos.y, hub, pending, this.palette);
        this.container.addChild(g);
        out.push(pos);
      }
    }
    this.flatSlots = out;
  }
}

function drawSlot(
  x: number,
  y: number,
  hub: Hub | null,
  pending: PendingSlotInfo | null,
  palette: SlotsRendererPalette,
): Graphics {
  // Radius in world units; visible at subdivision zoom (~scale 3+).
  const r = 1.7;
  const g = new Graphics();
  const occupied = hub !== null;
  const newBuildPending = !occupied && pending !== null;

  const baseColor = occupied ? palette.occupied : newBuildPending ? palette.pending : palette.empty;
  const baseAlpha = occupied ? 1 : 0.85;
  g.circle(x, y, r).fill({ color: baseColor, alpha: baseAlpha });
  g.stroke({ color: 0xffffff, width: 0.2, alpha: 0.9, pixelLine: true });

  if (occupied) {
    drawHubGlyph(g, hub.kind, x, y, r * 0.72, 0xffffff);
  } else if (newBuildPending && pending) {
    drawHubGlyph(g, pending.kind, x, y, r * 0.72, 0xffffff);
  } else {
    // Empty: small plus marker.
    const m = r * 0.55;
    g.moveTo(x - m, y).lineTo(x + m, y);
    g.moveTo(x, y - m).lineTo(x, y + m);
    g.stroke({ color: 0xffffff, width: 0.35, alpha: 1, pixelLine: true });
  }

  if (pending) {
    drawProgressArc(g, x, y, r + 0.55, pending.progress, palette.progress);
  }
  return g;
}

function drawProgressArc(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  progress: number,
  color: number,
): void {
  const clamped = Math.max(0, Math.min(1, progress));
  // Faint full-circle backdrop.
  g.circle(cx, cy, radius);
  g.stroke({ color: 0xffffff, width: 0.25, alpha: 0.35, pixelLine: true });
  if (clamped <= 0) return;
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * clamped;
  g.arc(cx, cy, radius, start, end);
  g.stroke({ color, width: 0.5, alpha: 1, pixelLine: true });
}

function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
