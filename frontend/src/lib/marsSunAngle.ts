/**
 * NASA Mars Solar Geometry & Sun Position Calculator
 * Computes Sun Elevation Angle and Azimuth for a given Mars (Lat, Lon) across 24h Mars Sol.
 */

export interface SunAnglePoint {
  timeLabel: string;
  hour: number;
  elevationDeg: number; // Angle above horizon (-90° to +90°)
  azimuthDeg: number;   // Compass bearing (0° to 360°)
}

export function computeMarsSunAngles(latDeg: number, _lonDeg?: number): SunAnglePoint[] {
  void _lonDeg;
  const points: SunAnglePoint[] = [];

  // Fallback geometry only. Real az/el comes from /api/sun-angle (JPL Horizons)
  // via applyHorizonsSamples(); this keeps the chart populated before it lands.
  // Mars Obliquity (Axial Tilt) ~ 25.19°
  // For current Jezero season (Ls ~ 120° Northern Summer), solar declination delta ~ +22°
  const declinationRad = (22.0 * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  // Compute 25 points spanning 24 hours (00:00 to 24:00)
  for (let h = 0; h <= 24; h++) {
    // Hour angle H: 0 at solar noon (12:00), 15° per hour
    const hourAngleDeg = (h - 12) * 15;
    const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

    // Solar elevation angle formula:
    // sin(elev) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(H)
    const sinElev =
      Math.sin(latRad) * Math.sin(declinationRad) +
      Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
    const elevRad = Math.asin(Math.max(-1, Math.min(1, sinElev)));
    const elevationDeg = (elevRad * 180) / Math.PI;

    // Solar azimuth formula:
    // cos(Az) = (sin(dec) - sin(lat)*sin(elev)) / (cos(lat)*cos(elev))
    const cosElev = Math.cos(elevRad);
    let azDeg = 180;
    if (cosElev > 0.001) {
      const cosAz =
        (Math.sin(declinationRad) - Math.sin(latRad) * sinElev) /
        (Math.cos(latRad) * cosElev);
      const azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      const rawAz = (azRad * 180) / Math.PI;
      // If hourAngle > 0 (afternoon), azimuth is 360° - rawAz
      azDeg = hourAngleDeg > 0 ? 360 - rawAz : rawAz;
    }

    const hh = String(h).padStart(2, "0");
    points.push({
      timeLabel: `${hh}:00`,
      hour: h,
      elevationDeg: Math.round(elevationDeg * 10) / 10,
      azimuthDeg: Math.round(azDeg * 10) / 10,
    });
  }

  return points;
}

/**
 * Fetches real Sun az/el for the site from JPL Horizons.
 * Returns null on any failure so callers keep the local fallback curve.
 */
export async function fetchHorizonsSunAngles(
  latDeg: number,
  lonDeg: number
): Promise<SunAnglePoint[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/sun-angle?lon=${lonDeg}&lat=${latDeg}`);
    if (!res.ok) return null;
    const payload = (await res.json()) as { points?: SunAnglePoint[] };
    return Array.isArray(payload.points) && payload.points.length >= 2 ? payload.points : null;
  } catch {
    return null;
  }
}
