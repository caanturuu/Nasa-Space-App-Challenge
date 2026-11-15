/**
 * Marswalk Explorer - Centralized Typed API Client
 * Connects frontend interface to the backend API services.
 */

import type { RealWeather } from "@/lib/marsTelemetry";

export interface LiveConditionsResponse {
  snapshot: {
    sol: number;
    localMarsTime: string;
    temperatureC: number;
    pressurePa: number;
    windSpeedMps: number;
    dustOpacityTau: number;
    radiationUsvH: number;
    evaStatus: string;
  };
  realWeather: RealWeather | null;
  provenance: Record<string, { source: string; status: string }>;
}

export interface SunAnglePoint {
  hour: number;
  timeLabel: string;
  azimuthDeg: number;
  elevationDeg: number;
}

export class MarsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches real-time / simulated surface conditions (REMS / MEDA).
   */
  async getLiveConditions(scenario: string = "nominal"): Promise<LiveConditionsResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/conditions/live?scenario=${scenario}`);
      if (!res.ok) return null;
      return (await res.json()) as LiveConditionsResponse;
    } catch {
      return null;
    }
  }

  /**
   * Fetches 24h JPL Horizons solar ephemeris for given Mars coordinates.
   */
  async getSunAngles(lon: number = 77.4509, lat: number = 18.4446): Promise<SunAnglePoint[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/sun-angle?lon=${lon}&lat=${lat}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { points?: SunAnglePoint[] };
      return data.points || null;
    } catch {
      return null;
    }
  }

  /**
   * Plan an EVA route between waypoints.
   */
  async planRoute(waypoints: unknown[], mode: string = "balanced"): Promise<unknown | null> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints, mode }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetches NASA Trek raster layer catalog.
   */
  async getLayers(): Promise<unknown | null> {
    try {
      const res = await fetch(`${this.baseUrl}/layers`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const marsApiClient = new MarsApiClient();
