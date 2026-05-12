// Equirectangular projection. Lon/lat (WGS84) → flat world coords.
// 10 world units per degree. Y is flipped so north is up in geo but
// down in world space (matches screen coordinates).

export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 1800;

export const WORLD_BBOX = {
  minX: 0,
  minY: 0,
  maxX: WORLD_WIDTH,
  maxY: WORLD_HEIGHT,
} as const;

const UNITS_PER_DEG = 10;

export function geoToWorld(lon: number, lat: number): { x: number; y: number } {
  return {
    x: (lon + 180) * UNITS_PER_DEG,
    y: (90 - lat) * UNITS_PER_DEG,
  };
}

export function worldToGeo(x: number, y: number): { lon: number; lat: number } {
  return {
    lon: x / UNITS_PER_DEG - 180,
    lat: 90 - y / UNITS_PER_DEG,
  };
}
