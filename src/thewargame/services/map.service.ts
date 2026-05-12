import { Injectable, computed, inject, signal } from '@angular/core';
import { Application, Container, Graphics } from 'pixi.js';
import { Camera, type CameraState } from '../pixi/camera';
import { MapRenderer, type MapPalette } from '../pixi/map-renderer';
import { pickRegion } from '../pixi/hit-test';
import type { Region, RegionIndex } from '../models/geo.types';
import { GeoService } from './geo.service';

const CLICK_TOLERANCE_PX = 6;

// userScale thresholds for the "what does hover/click select?" tiers.
// userScale 1 == world fits canvas. Tune to taste.
const SUBDIVISION_TIER_SCALE = 3;
// const CITY_TIER_SCALE = 12; // reserved for future city-block tier.

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

  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;

  private worldRoot: Container | null = null;
  private oceanLayer: Container | null = null;
  private oceanRect: Graphics | null = null;
  private countryLayer: Container | null = null;
  private subdivisionLayer: Container | null = null;
  private hoverLayer: Container | null = null;
  private selectionLayer: Container | null = null;

  private camera: Camera | null = null;
  private renderer: MapRenderer | null = null;

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
    this.hoverLayer = makeLayer('hover');
    this.selectionLayer = makeLayer('selection');
    this.worldRoot.addChild(this.countryLayer);
    this.worldRoot.addChild(this.subdivisionLayer);
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

    this.camera = new Camera({
      target: this.worldRoot,
      host,
      getViewport: () => ({
        width: app.canvas.clientWidth || app.renderer.width / app.renderer.resolution,
        height: app.canvas.clientHeight || app.renderer.height / app.renderer.resolution,
      }),
      onChange: (state) => {
        this.cameraState.set(state);
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
    this.hoverLayer = null;
    this.selectionLayer = null;
    this.renderer = null;
    this.regionIndex = null;
    this.hitTestList = [];
    this.hovered.set(null);
    this.selected.set(null);
    this.pointerScreen.set(null);
    this.pointerWorld.set(null);
    this.viewport.set(null);
    this.cameraState.set(null);
    this.pointerDownAt = null;
    this.pointerMoved = false;
    this.ready.set(false);
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
    const wasDown = this.pointerDownAt !== null;
    const moved = this.pointerMoved;
    this.pointerDownAt = null;
    this.pointerMoved = false;
    if (!wasDown || moved) return;
    // Treat as click: select whatever is under the pointer now.
    const r = this.hovered();
    if (r !== this.selected()) {
      this.selected.set(r);
      this.renderer?.setSelected(r);
    }
  };

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
