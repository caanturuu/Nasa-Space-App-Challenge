/**
 * Proxies NASA Trek's ArcGIS ImageServer `exportImage` for the Jezero EVA grid.
 *
 * Why: `marsTerrain.buildDem()` was a set of tanh/exp/sin approximations. A real
 * MOLA DEM (463 m/px) is available as a 16-bit GeoTIFF from the same service
 * NASA Mars Trek uses, and we already know how to decode that offline.
 */

import { NextRequest, NextResponse } from "next/server";
import { decodeInt16Tiff } from "@/lib/geoTiffInt16";
import { JEZERO_BOUNDS } from "@/lib/marsCrs";

const DEM_SERVICE =
  "https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0/ImageServer";
const MARS_EQUIRECT_WKID = 104905;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ROWS = 120;
const COLS = 140;

export interface TerrainRasterPayload {
  rows: number;
  cols: number;
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  elevationM: number[];
  minM: number;
  maxM: number;
  source: "NASA_TREK_DEM";
  fetchedAt: string;
}

let cache: { payload: TerrainRasterPayload; at: number } | null = null;

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const { lonMin, lonMax, latMin, latMax } = JEZERO_BOUNDS;
  const url =
    `${DEM_SERVICE}/exportImage?bbox=${lonMin},${latMin},${lonMax},${latMax}` +
    `&bboxSR=${MARS_EQUIRECT_WKID}&imageSR=${MARS_EQUIRECT_WKID}` +
    `&size=${COLS},${ROWS}&format=tiff&pixelType=S16` +
    `&interpolation=RSP_BilinearInterpolation&noDataInterpretation=esriNoDataMatchAny&f=image`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      return NextResponse.json(
        { error: `NASA Trek DEM returned ${res.status}` },
        { status: 502 }
      );
    }

    const raster = decodeInt16Tiff(await res.arrayBuffer());
    if (raster.width !== COLS || raster.height !== ROWS) {
      return NextResponse.json(
        { error: `Unexpected DEM size ${raster.width}x${raster.height}` },
        { status: 502 }
      );
    }

    let minM = Infinity;
    let maxM = -Infinity;
    const elevationM = new Array<number>(raster.data.length);
    for (let i = 0; i < raster.data.length; i++) {
      const v = raster.data[i];
      elevationM[i] = v;
      if (v < minM) minM = v;
      if (v > maxM) maxM = v;
    }

    const payload: TerrainRasterPayload = {
      rows: ROWS,
      cols: COLS,
      bounds: JEZERO_BOUNDS,
      elevationM,
      minM,
      maxM,
      source: "NASA_TREK_DEM",
      fetchedAt: new Date().toISOString(),
    };

    cache = { payload, at: Date.now() };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "DEM fetch failed";
    if (cache) return NextResponse.json({ ...cache.payload, stale: true });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
