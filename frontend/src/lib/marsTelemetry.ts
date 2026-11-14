export type ConditionScenario = "nominal" | "dust_storm" | "solar_particle_event";
export type EvaStatus = "GO" | "CAUTION" | "ABORT";

export interface MarsTelemetrySnapshot {
  sol: number;
  localMarsTime: string;
  location: string;
  scenario: ConditionScenario;
  evaStatus: EvaStatus;
  maxSafeRangeM: number;
  temperatureC: number;
  pressurePa: number;
  windSpeedMps: number;
  dustOpacityTau: number;
  solarFluxWm2: number;
  radiationMsvDay: number;
  visibilityM: number;
  orbiterRelay: string;
  advisory: string;
}

export function getTelemetrySnapshot(
  scenario: ConditionScenario,
  tick = 0
): MarsTelemetrySnapshot {
  const wave = Math.sin(tick * 0.65);

  if (scenario === "dust_storm") {
    return {
      sol: 1842,
      localMarsTime: "13:24 LMST",
      location: "Jezero Crater (18.44°N, 77.45°E)",
      scenario,
      evaStatus: "CAUTION",
      maxSafeRangeM: 1400,
      temperatureC: Number((-58.0 + 1.5 * wave).toFixed(1)),
      pressurePa: Number((748.0 + 3.0 * wave).toFixed(1)),
      windSpeedMps: Number((26.4 + 2.1 * wave).toFixed(1)),
      dustOpacityTau: Number((2.85 + 0.12 * wave).toFixed(2)),
      solarFluxWm2: Number((132.0 + 10.0 * wave).toFixed(1)),
      radiationMsvDay: 0.54,
      visibilityM: Math.round(310 - 20 * wave),
      orbiterRelay: "MRO + Mars Odyssey (Dust Attenuation)",
      advisory:
        "Regional dust front detected (tau > 2.5). Visibility reduced & solar power degraded. Restrict EVA within 1.4 km of Octavia Hab.",
    };
  }

  if (scenario === "solar_particle_event") {
    return {
      sol: 1842,
      localMarsTime: "13:24 LMST",
      location: "Jezero Crater (18.44°N, 77.45°E)",
      scenario,
      evaStatus: "ABORT",
      maxSafeRangeM: 0,
      temperatureC: Number((-41.0 + 1.1 * wave).toFixed(1)),
      pressurePa: Number((722.0 + 2.0 * wave).toFixed(1)),
      windSpeedMps: Number((8.1 + 0.8 * wave).toFixed(1)),
      dustOpacityTau: Number((0.45 + 0.03 * wave).toFixed(2)),
      solarFluxWm2: Number((505.0 + 8.0 * wave).toFixed(1)),
      radiationMsvDay: Number((4.85 + 0.25 * wave).toFixed(2)),
      visibilityM: 12000,
      orbiterRelay: "MRO High-Priority Alert Relay",
      advisory:
        "ALERT: Solar Particle Event radiation spike (>4 mSv/day). Abort open-terrain Marswalk and return immediately to shielded Habitat.",
    };
  }

  return {
    sol: 1842,
    localMarsTime: "13:24 LMST",
    location: "Jezero Crater (18.44°N, 77.45°E)",
    scenario,
    evaStatus: "GO",
    maxSafeRangeM: 5500,
    temperatureC: Number((-44.5 + 1.8 * wave).toFixed(1)),
    pressurePa: Number((724.0 + 2.5 * wave).toFixed(1)),
    windSpeedMps: Number((7.2 + 1.1 * wave).toFixed(1)),
    dustOpacityTau: Number((0.42 + 0.03 * wave).toFixed(2)),
    solarFluxWm2: Number((498.0 + 12.0 * wave).toFixed(1)),
    radiationMsvDay: Number((0.62 + 0.02 * wave).toFixed(2)),
    visibilityM: 14500,
    orbiterRelay: "MRO + Mars Odyssey (Link Strong, 11.4m OWLT)",
    advisory:
      "Nominal Jezero Sol conditions (MEDA baseline). Clear orbiter relay; all Delta and Séítah perimeter corridors open.",
  };
}

