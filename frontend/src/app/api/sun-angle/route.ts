/**
 * Real Sun azimuth/elevation for the Jezero site from JPL Horizons.
 *
 * Replaces the hardcoded `declinationRad = 22°` geometry in marsSunAngle.ts.
 * Horizons wants east longitude negative for IAU west-positive body 499, so the
 * site coordinate is passed as (-lon, lat).
 */

import { NextRequest, NextResponse } from "next/server";
import type { SunAnglePoint } from "@/lib/marsSunAngle";

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface SunAnglePayload {
  points: SunAnglePoint[];
  source: "JPL_HORIZONS";
  fetchedAt: string;
  site: { lon: number; lat: number };
}

const cache = new Map<string, { payload: SunAnglePayload; at: number }>();

function horizonsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export async function GET(req: NextRequest) {
  const lon = Number(req.nextUrl.searchParams.get("lon") ?? 77.45);
  const lat = Number(req.nextUrl.searchParams.get("lat") ?? 18.4446);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "Invalid lon/lat" }, { status: 400 });
  }

  const key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload);
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const stop = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    format: "text",
    COMMAND: "'10'",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'coord@499'",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `'${(-lon).toFixed(5)},${lat.toFixed(5)},0'`,
    START_TIME: `'${horizonsDate(start)} 00:00'`,
    STOP_TIME: `'${horizonsDate(stop)} 00:00'`,
    STEP_SIZE: "'1h'",
    QUANTITIES: "'4,13'",
    ANG_FORMAT: "DEG",
    CSV_FORMAT: "YES",
    EXTRA_PREC: "YES",
  });

  try {
    const res = await fetch(`${HORIZONS}?${params}`, {
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `JPL Horizons returned ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    const soe = text.indexOf("$$SOE");
    const eoe = text.indexOf("$$EOE");
    if (soe < 0 || eoe < 0) {
      return NextResponse.json({ error: "Horizons response missing ephemeris block" }, { status: 502 });
    }

    const points: SunAnglePoint[] = [];
    for (const line of text.slice(soe + 5, eoe).split("\n")) {
      const cols = line.split(",").map((s) => s.trim());
      if (cols.length < 5) continue;
      const az = Number(cols[3]);
      const el = Number(cols[4]);
      if (!Number.isFinite(az) || !Number.isFinite(el)) continue;
      const hour = points.length;
      points.push({
        timeLabel: `${String(hour).padStart(2, "0")}:00`,
        hour,
        elevationDeg: Math.round(el * 10) / 10,
        azimuthDeg: Math.round(az * 10) / 10,
      });
    }

    if (points.length < 2) {
      return NextResponse.json({ error: "Horizons returned no usable samples" }, { status: 502 });
    }

    const payload: SunAnglePayload = {
      points,
      source: "JPL_HORIZONS",
      fetchedAt: new Date().toISOString(),
      site: { lon, lat },
    };
    cache.set(key, { payload, at: Date.now() });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Horizons fetch failed";
    if (hit) return NextResponse.json({ ...hit.payload, stale: true });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
