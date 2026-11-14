import { NextResponse } from "next/server";
import { JEZERO_BOUNDS, MARS_CRS_CODE, MARS_RADIUS_M, MARS_WMTS_CRS } from "@/lib/marsCrs";
import { NASA_LAYERS } from "@/lib/marsData";

export async function GET() {
  return NextResponse.json({
    crs: MARS_CRS_CODE,
    wmtsCrs: MARS_WMTS_CRS,
    marsRadiusM: MARS_RADIUS_M,
    jezeroBounds: JEZERO_BOUNDS,
    layers: NASA_LAYERS,
  });
}

