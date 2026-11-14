import { MARS_CRS_CODE, marsDistanceM } from "./marsCrs";
import { JEZERO_SCIENCE_TARGETS } from "./marsData";
import { JezeroTerrainGrid, getTerrainGrid } from "./marsTerrain";

export type PlannerMode = "safest" | "balanced" | "max_science";

export interface RouteProfilePoint {
  distanceM: number;
  elevationM: number;
  slopeDeg: number;
  lon: number;
  lat: number;
}

export interface NearbyScienceTarget {
  id: string;
  name: string;
  category: string;
  scienceScore: number;
  distanceFromRouteM: number;
}

export interface EvaRouteResult {
  crs: string;
  mode: PlannerMode;
  coordinates: [number, number][];
  directCoordinates: [[number, number], [number, number]];
  metrics: {
    totalDistanceM: number;
    totalAscentM: number;
    totalDescentM: number;
    maxSlopeDeg: number;
    estimatedDurationMin: number;
    oxygenUsedPct: number;
    batteryUsedPct: number;
    roundTripO2Pct: number;
    pointOfNoReturnOk: boolean;
  };
  directBaseline: {
    distanceM: number;
    maxSlopeDeg: number;
    exceedsSafeSlope: boolean;
    hazardsCrossed: string[];
  };
  nearbyScienceTargets: NearbyScienceTarget[];
  profile: RouteProfilePoint[];
}

const MODE_WEIGHTS: Record<PlannerMode, { slopeW: number; hazardW: number; scienceW: number }> = {
  safest: { slopeW: 0.18, hazardW: 2.2, scienceW: 0.05 },
  balanced: { slopeW: 0.09, hazardW: 1.3, scienceW: 0.14 },
  max_science: { slopeW: 0.06, hazardW: 0.9, scienceW: 0.25 },
};

const NEIGHBORS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

class MinHeap {
  private data: { f: number; idx: number }[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: { f: number; idx: number }): void {
    this.data.push(item);
    let i = this.data.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  pop(): { f: number; idx: number } | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < this.data.length && this.data[l].f < this.data[smallest].f) smallest = l;
        if (r < this.data.length && this.data[r].f < this.data[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      }
    }
    return top;
  }
}

function nearestPassable(
  grid: JezeroTerrainGrid,
  row: number,
  col: number,
  maxSlopeDeg: number,
  maxRadius = 6
): [number, number] {
  const k0 = row * grid.cols + col;
  if (grid.slopeDeg[k0] <= maxSlopeDeg && grid.hazardPenalty[k0] < 10) {
    return [row, col];
  }

  let best: [number, number] | null = null;
  let bestDist2 = Infinity;
  for (let dr = -maxRadius; dr <= maxRadius; dr++) {
    for (let dc = -maxRadius; dc <= maxRadius; dc++) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < grid.rows && nc >= 0 && nc < grid.cols) {
        const nk = nr * grid.cols + nc;
        if (grid.slopeDeg[nk] <= maxSlopeDeg && grid.hazardPenalty[nk] < 10) {
          const d2 = dr * dr + dc * dc;
          if (d2 < bestDist2) {
            bestDist2 = d2;
            best = [nr, nc];
          }
        }
      }
    }
  }
  if (!best) {
    throw new Error("Selected point is surrounded by impassable terrain exceeding slope threshold.");
  }
  return best;
}

export function planEvaRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  mode: PlannerMode = "balanced",
  maxSlopeDeg = 20
): EvaRouteResult {
  const grid = getTerrainGrid();
  if (!grid.inBounds(startLon, startLat) || !grid.inBounds(endLon, endLat)) {
    throw new Error(
      `Coordinates must lie inside Jezero DEM bounds [${grid.bounds.lonMin}..${grid.bounds.lonMax}E, ${grid.bounds.latMin}..${grid.bounds.latMax}N].`
    );
  }

  const [rawSr, rawSc] = grid.lonLatToGrid(startLon, startLat);
  const [rawEr, rawEc] = grid.lonLatToGrid(endLon, endLat);
  const [sr, sc] = nearestPassable(grid, rawSr, rawSc, maxSlopeDeg);
  const [er, ec] = nearestPassable(grid, rawEr, rawEc, maxSlopeDeg);

  const weights = MODE_WEIGHTS[mode];
  const minMult = Math.max(0.75, 1 - weights.scienceW);
  const totalCells = grid.rows * grid.cols;
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);

  const startIdx = sr * grid.cols + sc;
  const endIdx = er * grid.cols + ec;

  const heuristic = (r: number, c: number) =>
    Math.hypot((r - er) * grid.dyM, (c - ec) * grid.dxM) * minMult;

  const heap = new MinHeap();
  gScore[startIdx] = 0;
  heap.push({ f: heuristic(sr, sc), idx: startIdx });

  let found = false;
  while (heap.size > 0) {
    const item = heap.pop();
    if (!item) break;
    const curIdx = item.idx;
    if (closed[curIdx]) continue;
    if (curIdx === endIdx) {
      found = true;
      break;
    }
    closed[curIdx] = 1;

    const r = Math.floor(curIdx / grid.cols);
    const c = curIdx % grid.cols;
    const curG = gScore[curIdx];
    const curElev = grid.elevationM[curIdx];

    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;
      const nIdx = nr * grid.cols + nc;
      if (closed[nIdx]) continue;

      const cellSlope = grid.slopeDeg[nIdx];
      const cellHaz = grid.hazardPenalty[nIdx];
      if (cellSlope > maxSlopeDeg || cellHaz >= 10) continue;

      const stepDistM = Math.hypot(dr * grid.dyM, dc * grid.dxM);
      const elevDiff = Math.max(0, grid.elevationM[nIdx] - curElev);

      const slopePenalty = weights.slopeW * cellSlope ** 1.4;
      const hazardPenalty = weights.hazardW * cellHaz;
      const ascentPenalty = 0.04 * (elevDiff / Math.max(1, stepDistM)) * 100;
      const scienceDiscount = weights.scienceW * grid.scienceBonus[nIdx];

      const mult = Math.max(
        minMult,
        1 + slopePenalty + hazardPenalty + ascentPenalty - scienceDiscount
      );
      const tentativeG = curG + stepDistM * mult;

      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = curIdx;
        gScore[nIdx] = tentativeG;
        heap.push({ f: tentativeG + heuristic(nr, nc), idx: nIdx });
      }
    }
  }

  if (!found) {
    throw new Error("No traversable EVA path found within current slope & hazard constraints.");
  }

  const pathIndices: number[] = [];
  let cur = endIdx;
  while (cur !== -1) {
    pathIndices.push(cur);
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  pathIndices.reverse();

  const coordinates: [number, number][] = [];
  const profile: RouteProfilePoint[] = [];
  let cumDistM = 0;
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxSlopeSeen = 0;
  let walkingTimeS = 0;

  for (let i = 0; i < pathIndices.length; i++) {
    const k = pathIndices[i];
    const r = Math.floor(k / grid.cols);
    const c = k % grid.cols;
    const [lon, lat] = grid.gridToLonLat(r, c);
    const elev = grid.elevationM[k];
    const slp = grid.slopeDeg[k];
    if (slp > maxSlopeSeen) maxSlopeSeen = slp;

    if (i > 0) {
      const [prevLon, prevLat] = coordinates[coordinates.length - 1];
      const prevElev = profile[profile.length - 1].elevationM;
      const segDist = marsDistanceM(prevLon, prevLat, lon, lat);
      cumDistM += segDist;
      const dElev = elev - prevElev;
      if (dElev > 0) totalAscentM += dElev;
      else totalDescentM += Math.abs(dElev);

      const grade = Math.abs(dElev) / Math.max(1, segDist);
      const paceMps = Math.max(0.45, 1.15 * Math.exp(-2.1 * grade));
      walkingTimeS += segDist / paceMps;
    }

    const rLon = Number(lon.toFixed(6));
    const rLat = Number(lat.toFixed(6));
    coordinates.push([rLon, rLat]);
    profile.push({
      distanceM: Math.round(cumDistM * 10) / 10,
      elevationM: Math.round(elev * 10) / 10,
      slopeDeg: Math.round(slp * 100) / 100,
      lon: rLon,
      lat: rLat,
    });
  }

  const durationMin = walkingTimeS / 60 + 18;
  const roundTripMin = (walkingTimeS * 2) / 60 + 20;
  const oxygenUsedPct = Math.min(100, (durationMin / 240) * 100 + totalAscentM * 0.04);
  const batteryUsedPct = Math.min(100, (durationMin / 280) * 100 + totalAscentM * 0.03);
  const roundTripO2Pct = Math.min(120, (roundTripMin / 240) * 100 + totalAscentM * 0.07);

  // Evaluate naive straight line
  let maxDirectSlope = 0;
  const hazardsCrossed = new Set<string>();
  const samples = 60;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lon = startLon + t * (endLon - startLon);
    const lat = startLat + t * (endLat - startLat);
    const [r, c] = grid.lonLatToGrid(lon, lat);
    const k = r * grid.cols + c;
    if (grid.slopeDeg[k] > maxDirectSlope) maxDirectSlope = grid.slopeDeg[k];
    if (grid.hazardTypes[k]) hazardsCrossed.add(grid.hazardTypes[k]);
  }

  // Nearby science targets within 450m
  const nearbyScienceTargets: NearbyScienceTarget[] = [];
  for (const feat of JEZERO_SCIENCE_TARGETS.features) {
    if (feat.properties.category === "Habitat / Base") continue;
    const [tLon, tLat] = feat.geometry.coordinates;
    let minD = Infinity;
    for (const [pLon, pLat] of coordinates) {
      const d = marsDistanceM(pLon, pLat, tLon, tLat);
      if (d < minD) minD = d;
    }
    if (minD <= 450) {
      nearbyScienceTargets.push({
        id: feat.properties.id,
        name: feat.properties.name,
        category: feat.properties.category,
        scienceScore: feat.properties.science_score,
        distanceFromRouteM: Math.round(minD * 10) / 10,
      });
    }
  }
  nearbyScienceTargets.sort((a, b) => a.distanceFromRouteM - b.distanceFromRouteM);

  return {
    crs: MARS_CRS_CODE,
    mode,
    coordinates,
    directCoordinates: [
      [Number(startLon.toFixed(6)), Number(startLat.toFixed(6))],
      [Number(endLon.toFixed(6)), Number(endLat.toFixed(6))],
    ],
    metrics: {
      totalDistanceM: Math.round(cumDistM * 10) / 10,
      totalAscentM: Math.round(totalAscentM * 10) / 10,
      totalDescentM: Math.round(totalDescentM * 10) / 10,
      maxSlopeDeg: Math.round(maxSlopeSeen * 100) / 100,
      estimatedDurationMin: Math.round(durationMin * 10) / 10,
      oxygenUsedPct: Math.round(oxygenUsedPct * 10) / 10,
      batteryUsedPct: Math.round(batteryUsedPct * 10) / 10,
      roundTripO2Pct: Math.round(roundTripO2Pct * 10) / 10,
      pointOfNoReturnOk: roundTripO2Pct <= 82,
    },
    directBaseline: {
      distanceM: Math.round(marsDistanceM(startLon, startLat, endLon, endLat) * 10) / 10,
      maxSlopeDeg: Math.round(maxDirectSlope * 100) / 100,
      exceedsSafeSlope: maxDirectSlope > maxSlopeDeg,
      hazardsCrossed: Array.from(hazardsCrossed).sort(),
    },
    nearbyScienceTargets,
    profile,
  };
}

