/**
 * Layer catalog.
 *
 * `NASA_LAYERS` stays the curated list the UI renders, but the DEM entries are
 * cross-checked against NASA Trek's real raster catalog so the metadata (bbox,
 * resolution, endpoint) is not invented.
 */

import { NextResponse } from "next/server";
import { JEZERO_BOUNDS, MARS_CRS_CODE, MARS_RADIUS_M, MARS_WMTS_CRS } from "@/lib/marsCrs";
import { NASA_LAYERS } from "@/lib/marsData";

const TREK_RASTER_CATALOG = "https://trek.nasa.gov/tiles/Mars/rasters/eq/list.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface TrekRasterLayer {
  productLabel: string;
  title: string;
  productType: string;
  resolution: string;
  bounding: { leftbc: number; rightbc: number; topbc: number; bottombc: number };
  endPoint: string;
}

let cache: { layers: TrekRasterLayer[]; at: number } | null = null;

async function fetchTrekCatalog(): Promise<TrekRasterLayer[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.layers;

  const res = await fetch(TREK_RASTER_CATALOG, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Trek catalog returned ${res.status}`);

  const json = (await res.json()) as {
    Layers?: {
      Layer?: Array<{
        productLabel: string;
        title: string;
        productType: string;
        resolution: string;
        bounding: { leftbc: string; rightbc: string; topbc: string; bottombc: string };
        services?: Array<{ endPoint: string }>;
      }>;
    };
  };

  const layers: TrekRasterLayer[] = (json.Layers?.Layer ?? []).map((l) => ({
    productLabel: l.productLabel,
    title: l.title,
    productType: l.productType,
    resolution: l.resolution,
    bounding: {
      leftbc: Number(l.bounding.leftbc),
      rightbc: Number(l.bounding.rightbc),
      topbc: Number(l.bounding.topbc),
      bottombc: Number(l.bounding.bottombc),
    },
    endPoint: l.services?.[0]?.endPoint ?? "",
  }));

  cache = { layers, at: Date.now() };
  return layers;
}

export async function GET() {
  let trekDemLayers: TrekRasterLayer[] = [];
  let catalogError: string | null = null;
  try {
    trekDemLayers = (await fetchTrekCatalog()).filter((l) => l.productType === "DEM");
  } catch (err) {
    catalogError = err instanceof Error ? err.message : "Trek catalog unavailable";
  }

  return NextResponse.json({
    crs: MARS_CRS_CODE,
    wmtsCrs: MARS_WMTS_CRS,
    marsRadiusM: MARS_RADIUS_M,
    jezeroBounds: JEZERO_BOUNDS,
    layers: NASA_LAYERS,
    trekDemLayers,
    catalogError,
  });
}

