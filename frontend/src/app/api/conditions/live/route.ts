import { NextRequest, NextResponse } from "next/server";
import { ConditionScenario, getTelemetrySnapshot } from "@/lib/marsTelemetry";

export async function GET(req: NextRequest) {
  const scenarioParam = req.nextUrl.searchParams.get("scenario") ?? "nominal";
  const scenario: ConditionScenario = ["nominal", "dust_storm", "solar_particle_event"].includes(
    scenarioParam
  )
    ? (scenarioParam as ConditionScenario)
    : "nominal";
  const tick = Math.floor(Date.now() / 2500);
  return NextResponse.json(getTelemetrySnapshot(scenario, tick));
}

