export const MARS_RADIUS_M = 3_396_190;
export const MARS_CRS_CODE = "IAU_2015:49900";
export const MARS_WMTS_CRS = "EPSG:104905";
export const MARS_METERS_PER_DEGREE = (2 * Math.PI * MARS_RADIUS_M) / 360;

export interface GeoBounds {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export const JEZERO_BOUNDS: GeoBounds = {
  lonMin: 77.36,
  lonMax: 77.47,
  latMin: 18.415,
  latMax: 18.505,
};

export function marsDistanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLam = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return MARS_RADIUS_M * c;
}

export function gridCellMeters(
  bounds: GeoBounds,
  rows: number,
  cols: number
): { dxM: number; dyM: number } {
  const centerLatRad = (((bounds.latMin + bounds.latMax) * 0.5) * Math.PI) / 180;
  const dLonRad = (((bounds.lonMax - bounds.lonMin) / Math.max(1, cols - 1)) * Math.PI) / 180;
  const dLatRad = (((bounds.latMax - bounds.latMin) / Math.max(1, rows - 1)) * Math.PI) / 180;
  return {
    dxM: MARS_RADIUS_M * Math.cos(centerLatRad) * dLonRad,
    dyM: MARS_RADIUS_M * dLatRad,
  };
}

/**
 * Generates an approximate Mars-surface circle polygon in lon/lat coordinates
 * centered at (centerLon, centerLat) with given radius in meters.
 */
export function buildMarsCircleRing(
  centerLon: number,
  centerLat: number,
  radiusM: number,
  segments = 64
): [number, number][] {
  if (radiusM <= 0) return [];
  const centerLatRad = (centerLat * Math.PI) / 180;
  const dLatDeg = (radiusM / MARS_RADIUS_M) * (180 / Math.PI);
  const dLonDeg = dLatDeg / Math.max(0.1, Math.cos(centerLatRad));

  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    ring.push([
      centerLon + dLonDeg * Math.cos(theta),
      centerLat + dLatDeg * Math.sin(theta),
    ]);
  }
  return ring;
}

