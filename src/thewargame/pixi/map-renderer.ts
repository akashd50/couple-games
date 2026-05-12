import { Container, Graphics } from 'pixi.js';
import type { Region } from '../models/geo.types';

export interface MapPalette {
  ocean: number;
  land: number;
  landForeign: number;
  border: number;
  borderSubdivision: number;
  hover: number;
  selected: number;
}

export interface MapLayers {
  readonly countries: Container;
  readonly subdivisions: Container;
  readonly hover: Container;
  readonly selection: Container;
}

/** Builds and re-tints the Pixi Graphics for the map's vector layers. */
export class MapRenderer {
  private countries: ReadonlyArray<Region> = [];
  private subdivisions: ReadonlyArray<Region> = [];
  private palette: MapPalette;

  constructor(
    private readonly layers: MapLayers,
    palette: MapPalette,
  ) {
    this.palette = palette;
  }

  setRegions(countries: ReadonlyArray<Region>, subdivisions: ReadonlyArray<Region>): void {
    this.countries = countries;
    this.subdivisions = subdivisions;
    this.repaintBase();
  }

  setPalette(palette: MapPalette): void {
    this.palette = palette;
    this.repaintBase();
  }

  setHovered(region: Region | null): void {
    this.layers.hover.removeChildren();
    if (!region) return;
    const g = drawRegionFill(region, this.palette.hover);
    g.alpha = 0.45;
    this.layers.hover.addChild(g);
  }

  setSelected(region: Region | null): void {
    this.layers.selection.removeChildren();
    if (!region) return;
    const g = drawRegionOutline(region, this.palette.selected, 1.6);
    this.layers.selection.addChild(g);
  }

  private repaintBase(): void {
    this.layers.countries.removeChildren();
    this.layers.subdivisions.removeChildren();

    for (const r of this.countries) {
      this.layers.countries.addChild(
        drawRegionFillStroke(r, this.palette.landForeign, this.palette.border, 0.6),
      );
    }
    for (const r of this.subdivisions) {
      this.layers.subdivisions.addChild(
        drawRegionFillStroke(r, this.palette.land, this.palette.borderSubdivision, 0.35),
      );
    }
  }
}

function drawRegionFillStroke(
  region: Region,
  fill: number,
  stroke: number,
  strokeWidth: number,
): Graphics {
  const g = new Graphics();
  for (const polygon of region.polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    drawRing(g, outer);
    g.fill({ color: fill });
    g.stroke({ color: stroke, width: strokeWidth, alpha: 1 });
    // Holes: draw stroke only (so coastline of inland lakes shows up).
    for (let i = 1; i < polygon.length; i++) {
      drawRing(g, polygon[i]);
      g.stroke({ color: stroke, width: strokeWidth, alpha: 1 });
    }
  }
  return g;
}

function drawRegionFill(region: Region, fill: number): Graphics {
  const g = new Graphics();
  for (const polygon of region.polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    drawRing(g, outer);
    g.fill({ color: fill });
  }
  return g;
}

function drawRegionOutline(region: Region, stroke: number, strokeWidth: number): Graphics {
  const g = new Graphics();
  for (const polygon of region.polygons) {
    for (const ring of polygon) {
      drawRing(g, ring);
      g.stroke({ color: stroke, width: strokeWidth, alpha: 1 });
    }
  }
  return g;
}

function drawRing(g: Graphics, ring: ReadonlyArray<readonly [number, number]>): void {
  g.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) g.lineTo(ring[i][0], ring[i][1]);
  g.closePath();
}
