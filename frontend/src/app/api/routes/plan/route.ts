import { NextRequest, NextResponse } from "next/server";
import { PlannerMode, planEvaRoute } from "@/lib/marsRouting";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const startLon = Number(body.startLon);
    const startLat = Number(body.startLat);
    const endLon = Number(body.endLon);
    const endLat = Number(body.endLat);
    const mode = (body.mode ?? "balanced") as PlannerMode;
    const maxSlopeDeg = body.maxSlopeDeg !== undefined ? Number(body.maxSlopeDeg) : 20;

    if (
      [startLon, startLat, endLon, endLat, maxSlopeDeg].some((v) => Number.isNaN(v)) ||
      !["safest", "balanced", "max_science"].includes(mode)
    ) {
      return NextResponse.json({ error: "Invalid EVA route parameters." }, { status: 400 });
    }

    const result = planEvaRoute(startLon, startLat, endLon, endLat, mode, maxSlopeDeg);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute EVA route.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

