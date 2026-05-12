export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface BBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A linear ring in world coordinates: [[x, y], …]. */
export type Ring = ReadonlyArray<readonly [number, number]>;

/** A polygon: outer ring followed by holes. */
export type Polygon = ReadonlyArray<Ring>;

export type RegionKind = 'country' | 'subdivision';

export interface Region {
  readonly id: string;
  readonly name: string;
  /** ISO-3 country code (e.g. 'USA', 'CAN'). For countries, equals id. */
  readonly country: string;
  readonly kind: RegionKind;
  /** Multi-polygon geometry in world coords. */
  readonly polygons: ReadonlyArray<Polygon>;
  readonly bbox: BBox;
  readonly postal?: string;
}

export interface RegionIndex {
  readonly countries: ReadonlyArray<Region>;
  readonly subdivisions: ReadonlyArray<Region>;
  /** Lookup by region id. */
  readonly byId: ReadonlyMap<string, Region>;
}
