import { Injectable, computed, inject, signal } from '@angular/core';
import { Application, Container, Graphics } from 'pixi.js';
import { Camera, type CameraState } from '../pixi/camera';
import { MapRenderer, type MapPalette } from '../pixi/map-renderer';
import { BuildSlotsRenderer, type PendingSlotInfo, type SlotPosition } from '../pixi/build-slots';
import { pickRegion } from '../pixi/hit-test';
import type { RegionState } from '../models/game.types';
import type { Region, RegionIndex } from '../models/geo.types';
import { GeoService } from './geo.service';

const CLICK_TOLERANCE_PX = 6;

// userScale thresholds for the "what does hover/click select?" tiers.
// userScale 1 == world fits canvas. Tune to taste.
const SUBDIVISION_TIER_SCALE = 3;
// const CITY_TIER_SCALE = 12; // reserved for future city-block tier.

/** Slot hit-test radius in CSS pixels — generous so slots are tappable. */
const SLOT_HIT_RADIUS_PX = 14;

export interface SlotInput {
  readonly state: RegionState;
  readonly pendingBySlotIndex: ReadonlyMap<number, PendingSlotInfo>;
}

export interface SlotPick {
  readonly regionId: string;
  readonly slotIndex: number;
}

export type HighlightTier = 'country' | 'subdivision' | 'city';

@Injectable()
export class MapService {
  private readonly geo = inject(GeoService);

  readonly ready = signal(false);
  readonly hovered = signal<Region | null>(null);
  readonly selected = signal<Region | null>(null);
  readonly pointerScreen = signal<{ x: number; y: number } | null>(null);
  readonly pointerWorld = signal<{ x: number; y: number } | null>(null);
  readonly viewport = signal<{ width: number; height: number } | null>(null);
  readonly cameraState = signal<CameraState | null>(null);

  readonly highlightTier = computed<HighlightTier>(() => {
    const s = this.cameraState();
    if (!s) return 'country';
    if (s.userScale >= SUBDIVISION_TIER_SCALE) return 'subdivision';
    return 'country';
  });

  /** Last slot the user clicked. The UI clears this back to null after handling. */
  readonly slotPicked = signal<SlotPick | null>(null);

  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;

  private worldRoot: Container | null = null;
  private oceanLayer: Container | null = null;
  private oceanRect: Graphics | null = null;
  private countryLayer: Container | null = null;
  private subdivisionLayer: Container | null = null;
  private slotLayer: Container | null = null;
  private hoverLayer: Container | null = null;
  private selectionLayer: Container | null = null;

  private camera: Camera | null = null;
  private renderer: MapRenderer | null = null;
  private slotsRenderer: BuildSlotsRenderer | null = null;
  private slotInput: ReadonlyArray<SlotInput> = [];

  private regionIndex: RegionIndex | null = null;
  // Subdivisions tested first so a state wins over its parent country; the
  // tier check then promotes the hit to the parent country when zoomed out.
  private hitTestList: Region[] = [];

  // Drag detection state for click vs pan disambiguation.
  private pointerDownAt: { x: number; y: number } | null = null;
  private pointerMoved = false;

  async init(host: HTMLElement): Promise<void> {
    if (this.app) return;
    this.host = host;

    const palette = this.readPalette();

    const app = new Application();
    await app.init({
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: host,
      background: palette.ocean,
    });
    host.appendChild(app.canvas);
    this.app = app;

    this.oceanLayer = new Container();
    this.oceanLayer.label = 'ocean';
    this.oceanLayer.eventMode = 'none';
    app.stage.addChild(this.oceanLayer);
    this.oceanRect = new Graphics();
    this.oceanLayer.addChild(this.oceanRect);

    this.worldRoot = new Container();
    this.worldRoot.label = 'world';
    this.worldRoot.eventMode = 'none';
    app.stage.addChild(this.worldRoot);

    this.countryLayer = makeLayer('countries');
    this.subdivisionLayer = makeLayer('subdivisions');
    this.slotLayer = makeLayer('slots');
    this.hoverLayer = makeLayer('hover');
    this.selectionLayer = makeLayer('selection');
    this.worldRoot.addChild(this.countryLayer);
    this.worldRoot.addChild(this.subdivisionLayer);
    this.worldRoot.addChild(this.slotLayer);
    this.worldRoot.addChild(this.hoverLayer);
    this.worldRoot.addChild(this.selectionLayer);

    this.renderer = new MapRenderer(
      {
        countries: this.countryLayer,
        subdivisions: this.subdivisionLayer,
        hover: this.hoverLayer,
        selection: this.selectionLayer,
      },
      palette,
    );
    this.slotsRenderer = new BuildSlotsRenderer(this.slotLayer, slotPalette(palette));
    this.slotsRenderer.setVisible(false);

    this.camera = new Camera({
      target: this.worldRoot,
      host,
      getViewport: () => ({
        width: app.canvas.clientWidth || app.renderer.width / app.renderer.resolution,
        height: app.canvas.clientHeight || app.renderer.height / app.renderer.resolution,
      }),
      onChange: (state) => {
        this.cameraState.set(state);
        this.updateSlotVisibility();
        this.rePickHovered();
      },
    });
    this.camera.attach();

    this.drawOcean();
    this.updateViewport();

    this.resizeObserver = new ResizeObserver(() => {
      this.app?.resize();
      this.drawOcean();
      this.camera?.apply();
      this.updateViewport();
    });
    this.resizeObserver.observe(host);

    this.themeObserver = new MutationObserver(() => this.applyTheme());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('pointermove', this.onPointerMove);
    host.addEventListener('pointerup', this.onPointerUp);
    host.addEventListener('pointerleave', this.onPointerLeave);

    const index = await this.geo.load();
    if (!this.app) return; // destroyed mid-load
    this.regionIndex = index;
    this.renderer.setRegions(index.countries, index.subdivisions);
    this.hitTestList = [...index.subdivisions, ...index.countries];

    this.ready.set(true);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;

    if (this.host) {
      this.host.removeEventListener('pointerdown', this.onPointerDown);
      this.host.removeEventListener('pointermove', this.onPointerMove);
      this.host.removeEventListener('pointerup', this.onPointerUp);
      this.host.removeEventListener('pointerleave', this.onPointerLeave);
    }

    this.camera?.detach();
    this.camera = null;

    this.slotsRenderer?.destroy();
    this.slotsRenderer = null;

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    this.host = null;
    this.worldRoot = null;
    this.oceanLayer = null;
    this.oceanRect = null;
    this.countryLayer = null;
    this.subdivisionLayer = null;
    this.slotLayer = null;
    this.hoverLayer = null;
    this.selectionLayer = null;
    this.renderer = null;
    this.regionIndex = null;
    this.hitTestList = [];
    this.slotInput = [];
    this.hovered.set(null);
    this.selected.set(null);
    this.pointerScreen.set(null);
    this.pointerWorld.set(null);
    this.viewport.set(null);
    this.cameraState.set(null);
    this.slotPicked.set(null);
    this.pointerDownAt = null;
    this.pointerMoved = false;
    this.ready.set(false);
  }

  /**
   * Push the current player-owned regions (with hubs) plus per-slot pending
   * indicators. Called from ShellComponent via an effect() so the map updates
   * when GameService / ConstructionService state changes.
   */
  setSlotData(input: ReadonlyArray<SlotInput>): void {
    this.slotInput = input;
    if (!this.slotsRenderer || !this.regionIndex) return;
    const enriched: Array<{
      state: RegionState;
      region: Region;
      pendingBySlotIndex: ReadonlyMap<number, PendingSlotInfo>;
    }> = [];
    for (const it of input) {
      const region = this.regionIndex.byId.get(it.state.id);
      if (!region) continue;
      enriched.push({ state: it.state, region, pendingBySlotIndex: it.pendingBySlotIndex });
    }
    this.slotsRenderer.setRegions(enriched);
    this.updateSlotVisibility();
  }

  /** Clear the slotPicked signal once the consumer has handled the pick. */
  clearSlotPicked(): void {
    this.slotPicked.set(null);
  }

  /** Look up a Region by id (subdivision or country). */
  getRegion(id: string): Region | null {
    return this.regionIndex?.byId.get(id) ?? null;
  }

  /** Select a region by id, mirroring a click. */
  selectRegionById(id: string): boolean {
    const region = this.regionIndex?.byId.get(id);
    if (!region) return false;
    this.selected.set(region);
    this.renderer?.setSelected(region);
    return true;
  }

  /** Clear the selection (and the Pixi ring). */
  clearSelection(): void {
    if (this.selected() === null) return;
    this.selected.set(null);
    this.renderer?.setSelected(null);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownAt = { x: e.clientX, y: e.clientY };
    this.pointerMoved = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.host || !this.camera || !this.renderer) return;
    if (this.pointerDownAt) {
      const dx = e.clientX - this.pointerDownAt.x;
      const dy = e.clientY - this.pointerDownAt.y;
      if (dx * dx + dy * dy > CLICK_TOLERANCE_PX * CLICK_TOLERANCE_PX) {
        this.pointerMoved = true;
      }
    }
    const rect = this.host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    this.pointerScreen.set({ x: sx, y: sy });
    const world = this.camera.screenToWorld(sx, sy);
    this.pointerWorld.set(world);
    const region = this.adjustToTier(pickRegion(world.x, world.y, this.hitTestList));
    if (region !== this.hovered()) {
      this.hovered.set(region);
      this.renderer.setHovered(region);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    void e;
    const wasDown = this.pointerDownAt !== null;
    const moved = this.pointerMoved;
    this.pointerDownAt = null;
    this.pointerMoved = false;
    if (!wasDown || moved) return;
    // Before the standard region-select click, see if a build slot was hit.
    const slot = this.pickSlotAtPointer();
    if (slot) {
      this.slotPicked.set({ regionId: slot.regionId, slotIndex: slot.slotIndex });
      // Make sure the corresponding region is selected so the drawer matches.
      const region = this.regionIndex?.byId.get(slot.regionId) ?? null;
      if (region && region !== this.selected()) {
        this.selected.set(region);
        this.renderer?.setSelected(region);
      }
      return;
    }
    // Otherwise, treat as a normal click: select whatever is under the pointer.
    const r = this.hovered();
    if (r !== this.selected()) {
      this.selected.set(r);
      this.renderer?.setSelected(r);
    }
  };

  private pickSlotAtPointer(): SlotPosition | null {
    if (!this.slotsRenderer || !this.camera) return null;
    if (this.highlightTier() !== 'subdivision') return null;
    const world = this.pointerWorld();
    if (!world) return null;
    const cam = this.cameraState();
    if (!cam) return null;
    const radiusWorld = SLOT_HIT_RADIUS_PX / cam.effectiveScale;
    const r2 = radiusWorld * radiusWorld;
    let best: SlotPosition | null = null;
    let bestDist = r2;
    for (const p of this.slotsRenderer.positions()) {
      const dx = p.x - world.x;
      const dy = p.y - world.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestDist) {
        best = p;
        bestDist = d2;
      }
    }
    return best;
  }

  private updateSlotVisibility(): void {
    if (!this.slotsRenderer) return;
    this.slotsRenderer.setVisible(this.highlightTier() === 'subdivision');
  }

  private onPointerLeave = (): void => {
    this.pointerScreen.set(null);
    this.pointerWorld.set(null);
    this.pointerDownAt = null;
    this.pointerMoved = false;
    if (this.hovered() !== null) {
      this.hovered.set(null);
      this.renderer?.setHovered(null);
    }
  };

  /** Promote/demote a raw hit to the current zoom tier. */
  private adjustToTier(r: Region | null): Region | null {
    if (!r) return null;
    if (this.highlightTier() === 'country' && r.kind === 'subdivision' && this.regionIndex) {
      return this.regionIndex.byId.get(r.country) ?? r;
    }
    return r;
  }

  /** Re-run the hit test against the last cursor position; called when the
   *  zoom tier may have changed so hover snaps to country vs subdivision. */
  private rePickHovered(): void {
    if (!this.camera || !this.renderer) return;
    const p = this.pointerScreen();
    if (!p) return;
    const world = this.camera.screenToWorld(p.x, p.y);
    this.pointerWorld.set(world);
    const region = this.adjustToTier(pickRegion(world.x, world.y, this.hitTestList));
    if (region !== this.hovered()) {
      this.hovered.set(region);
      this.renderer.setHovered(region);
    }
  }

  private updateViewport(): void {
    if (!this.app) return;
    this.viewport.set({
      width: this.app.canvas.clientWidth || 0,
      height: this.app.canvas.clientHeight || 0,
    });
  }

  private drawOcean(): void {
    if (!this.app || !this.oceanRect) return;
    const { width, height } = this.app.renderer;
    this.oceanRect.clear();
    this.oceanRect.rect(0, 0, width, height).fill({ color: this.readPalette().ocean });
  }

  private applyTheme(): void {
    if (!this.app || !this.renderer) return;
    const palette = this.readPalette();
    this.app.renderer.background.color = palette.ocean;
    this.drawOcean();
    this.renderer.setPalette(palette);
    this.renderer.setHovered(this.hovered());
    this.renderer.setSelected(this.selected());
    this.slotsRenderer?.setPalette(slotPalette(palette));
  }

  private readPalette(): MapPalette {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: number): number =>
      parseCssColor(css.getPropertyValue(name).trim()) ?? fallback;
    return {
      ocean: read('--wg-ocean', 0x0f0f17),
      land: read('--wg-land', 0xe8e2d3),
      landForeign: read('--wg-land-foreign', 0xddd6c4),
      border: read('--wg-border', 0x7c8493),
      borderSubdivision: read('--wg-border-subdivision', 0xa8a89c),
      hover: read('--wg-hover', 0x7a5cff),
      selected: read('--wg-selected', 0xc9b8ff),
    };
  }
}

function makeLayer(label: string): Container {
  const c = new Container();
  c.label = label;
  c.eventMode = 'none';
  return c;
}

function slotPalette(p: MapPalette): {
  empty: number;
  occupied: number;
  pending: number;
  progress: number;
} {
  return {
    empty: p.hover,
    occupied: p.selected,
    pending: p.borderSubdivision,
    progress: p.hover,
  };
}

function parseCssColor(value: string): number | null {
  if (!value) return null;
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r << 16) | (g << 8) | b;
    }
    if (hex.length === 6) return parseInt(hex, 16);
    return null;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const r = parseInt(rgb[1], 10);
    const g = parseInt(rgb[2], 10);
    const b = parseInt(rgb[3], 10);
    return (r << 16) | (g << 8) | b;
  }
  return null;
}
