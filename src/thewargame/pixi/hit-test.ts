import type { BBox, Region, Ring } from '../models/geo.types';

/** True iff (x, y) lies inside the closed bbox. */
export function pointInBBox(x: number, y: number, b: BBox): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Even-odd ray-cast test against a single ring. */
function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** A point is inside a multi-polygon if it is inside an odd number of rings
 *  for at least one of the polygons (outer-ring inside, holes excluded). */
export function pointInRegion(x: number, y: number, region: Region): boolean {
  if (!pointInBBox(x, y, region.bbox)) return false;
  for (const poly of region.polygons) {
    let crossings = 0;
    for (const ring of poly) {
      if (pointInRing(x, y, ring)) crossings++;
    }
    if (crossings % 2 === 1) return true;
  }
  return false;
}

/** Pick the first region whose geometry contains the world-space point.
 *  Caller passes the list in the order it should be tested (subdivisions
 *  before countries so a state wins over the parent country). */
export function pickRegion(x: number, y: number, regions: ReadonlyArray<Region>): Region | null {
  for (const r of regions) {
    if (pointInRegion(x, y, r)) return r;
  }
  return null;
}
