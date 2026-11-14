/**
 * Live Mars surface conditions.
 *
 * Temperature / pressure / solar longitude come from NASA's real REMS (MSL)
 * archive. Wind, dust opacity and radiation are NOT published in that feed
 * (they are `--` for recent sols), so they stay modelled — but every field
 * carries a provenance tag so the UI cannot present them as measured.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ConditionScenario,
  getTelemetrySnapshot,
  type MarsTelemetrySnapshot,
  type RealWeather,
} from "@/lib/marsTelemetry";
import type { DataSource } from "@/lib/dataProvenance";

const REMS_FEED = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface ConditionsPayload {
  snapshot: MarsTelemetrySnapshot;
  realWeather: RealWeather | null;
  provenance: Record<string, DataSource>;
}

let cache: { payload: ConditionsPayload; at: number } | null = null;

interface RemsSol {
  sol: string;
  terrestrial_date: string;
  min_temp: string;
  max_temp: string;
  pressure: string;
  ls: string;
  season: string;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "--" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchRems(): Promise<RealWeather | null> {
  try {
    const res = await fetch(REMS_FEED, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { soles?: RemsSol[] };

    for (const sol of json.soles ?? []) {
      const minTempC = num(sol.min_temp);
      const maxTempC = num(sol.max_temp);
      const pressurePa = num(sol.pressure);
      if (minTempC === null || maxTempC === null || pressurePa === null) continue;

      return {
        sol: Number(sol.sol),
        minTempC,
        maxTempC,
        pressurePa,
        solarLongitudeDeg: num(sol.ls) ?? 0,
        earthDate: sol.terrestrial_date,
        season: sol.season ?? "",
        source: "NASA_REMS",
        fetchedAt: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const scenarioParam = req.nextUrl.searchParams.get("scenario") ?? "nominal";
  const scenario: ConditionScenario = ["nominal", "dust_storm", "solar_particle_event"].includes(
    scenarioParam
  )
    ? (scenarioParam as ConditionScenario)
    : "nominal";

  if (cache && Date.now() - cache.at < CACHE_TTL_MS && cache.payload.snapshot.scenario === scenario) {
    return NextResponse.json(cache.payload);
  }

  const realWeather = await fetchRems();
  const snapshot = getTelemetrySnapshot(scenario, Math.floor(Date.now() / 2500), realWeather);

  const provenance: Record<string, DataSource> = {
    temperatureC: realWeather ? "NASA_REMS" : "SIMULATED",
    pressurePa: realWeather ? "NASA_REMS" : "SIMULATED",
    sol: realWeather ? "NASA_REMS" : "SIMULATED",
    windSpeedMps: "SIMULATED",
    dustOpacityTau: "SIMULATED",
    radiationMsvDay: "SIMULATED",
    solarFluxWm2: "SIMULATED",
    visibilityM: "SIMULATED",
  };

  const payload: ConditionsPayload = { snapshot, realWeather, provenance };
  cache = { payload, at: Date.now() };
  return NextResponse.json(payload);
}

