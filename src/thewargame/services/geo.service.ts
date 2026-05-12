import { Injectable } from '@angular/core';
import { geoToWorld } from '../pixi/projection';
import type { BBox, Polygon, Region, RegionIndex, RegionKind, Ring } from '../models/geo.types';

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | null;
}

interface GeoJSONFC {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const WORLD_URL = '/thewargame/geo/world-low.geo.json';
const US_URL = '/thewargame/geo/us-states.geo.json';
const CA_URL = '/thewargame/geo/ca-provinces.geo.json';

@Injectable({ providedIn: 'root' })
export class GeoService {
  private cache: Promise<RegionIndex> | null = null;

  load(): Promise<RegionIndex> {
    if (!this.cache) this.cache = this.fetchAll();
    return this.cache;
  }

  private async fetchAll(): Promise<RegionIndex> {
    const [world, us, ca] = await Promise.all([
      this.fetchJSON(WORLD_URL),
      this.fetchJSON(US_URL),
      this.fetchJSON(CA_URL),
    ]);

    const countries = world.features
      .map((f) => featureToRegion(f, 'country'))
      .filter((r): r is Region => r !== null);
    const usStates = us.features
      .map((f) => featureToRegion(f, 'subdivision'))
      .filter((r): r is Region => r !== null);
    const caProvs = ca.features
      .map((f) => featureToRegion(f, 'subdivision'))
      .filter((r): r is Region => r !== null);
    const subdivisions = [...usStates, ...caProvs];

    const byId = new Map<string, Region>();
    for (const r of countries) byId.set(r.id, r);
    for (const r of subdivisions) byId.set(r.id, r);

    return { countries, subdivisions, byId };
  }

  private async fetchJSON(url: string): Promise<GeoJSONFC> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }
}

function featureToRegion(f: GeoJSONFeature, kind: RegionKind): Region | null {
  if (!f.geometry) return null;
  const polygons: Polygon[] = [];
  if (f.geometry.type === 'Polygon') {
    polygons.push(projectPolygon(f.geometry.coordinates));
  } else if (f.geometry.type === 'MultiPolygon') {
    for (const poly of f.geometry.coordinates) polygons.push(projectPolygon(poly));
  } else {
    return null;
  }
  if (polygons.length === 0) return null;

  const p = f.properties;
  const id = String(p['id'] ?? p['name'] ?? '');
  if (!id) return null;
  const name = String(p['name'] ?? id);
  const country = String(p['country'] ?? id);
  const postal = typeof p['postal'] === 'string' ? p['postal'] : undefined;

  return {
    id,
    name,
    country,
    kind,
    polygons,
    bbox: computeBBox(polygons),
    postal,
  };
}

function projectPolygon(rings: number[][][]): Polygon {
  const out: Ring[] = [];
  for (const ring of rings) {
    const projected: Array<readonly [number, number]> = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const w = geoToWorld(lon, lat);
      projected[i] = [w.x, w.y];
    }
    out.push(projected);
  }
  return out;
}

function computeBBox(polygons: Polygon[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}
