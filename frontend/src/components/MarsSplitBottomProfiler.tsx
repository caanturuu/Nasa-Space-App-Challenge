"use client";

import { useState } from "react";
import { SunAnglePoint } from "@/lib/marsSunAngle";
import { ComputedRouteModel, ThemeTokens } from "@/oop/MarsWorkbenchOOP";

interface MarsSplitBottomProfilerProps {
  route: ComputedRouteModel;
  sunSamples: SunAnglePoint[];
  themeTokens: ThemeTokens;
  onHoverCoord: (coord: [number, number] | null) => void;
}

export function MarsSplitBottomProfiler({
  route,
  sunSamples,
  themeTokens,
  onHoverCoord,
}: MarsSplitBottomProfilerProps) {
  const [hoveredElevIdx, setHoveredElevIdx] = useState<number | null>(null);
  const [hoveredSunIdx, setHoveredSunIdx] = useState<number | null>(null);

  const isDark = themeTokens.mode === "dark";
  const panelBg = isDark ? themeTokens.panelBg : "#F8FAFC";
  const headerBg = isDark ? themeTokens.subHeaderBg : "#F1F5F9";
  const borderCol = themeTokens.borderColor;
  const gridCol = themeTokens.chartGrid;

  // Left Chart: Elevation & Slope Geometry (540 x 166)
  const samples = route.profileSamples;
  const xMin = 56;
  const xMax = 516;
  const xW = xMax - xMin;
  const yTop = 26;
  const yBottom = 130;
  const yH = yBottom - yTop;

  // Dynamic nice Y bounds rounded to 50m so elevation curves fill cleanly
  const rawMinE = route.minElevationM;
  const rawMaxE = route.maxElevationM;
  const yMinElev = Math.floor((rawMinE - 20) / 50) * 50;
  const yMaxElev = Math.max(yMinElev + 100, Math.ceil((rawMaxE + 20) / 50) * 50);
  const ySpanElev = Math.max(50, yMaxElev - yMinElev);

  const mapElevX = (idx: number) => {
    if (samples.length <= 1) return xMin;
    return xMin + (idx / (samples.length - 1)) * xW;
  };

  const mapElevY = (elevM: number) =>
    yBottom - ((elevM - yMinElev) / ySpanElev) * yH;

  // Default highlight index: peak slope sample if not hovered
  const peakIdx = samples.reduce(
    (bestIdx, s, i) =>
      s.slopeDeg > (samples[bestIdx]?.slopeDeg ?? -1) ? i : bestIdx,
    Math.floor(samples.length * 0.5)
  );
  const activeElevIdx =
    hoveredElevIdx !== null && samples[hoveredElevIdx]
      ? hoveredElevIdx
      : peakIdx;
  const activeSample = samples[activeElevIdx];
  const activeSampleColor = activeSample?.color ?? "#22C55E";

  // Right Chart: Sun Angle Geometry (539 x 166)
  const sxMin = 52;
  const sxMax = 516;
  const sxW = sxMax - sxMin;
  const syTop = 26;
  const syZero = 120; // 0° Horizon line
  const sySpan = syZero - syTop; // 0° .. 360°

  const mapSunX = (hour: number) => sxMin + (hour / 24) * sxW;
  const mapSunY = (degVal: number) => {
    const clamped = Math.max(-50, Math.min(360, degVal));
    return syZero - (clamped / 360) * sySpan;
  };

  const activeSunHour =
    hoveredSunIdx !== null && sunSamples[hoveredSunIdx]
      ? sunSamples[hoveredSunIdx].hour
      : 13.4; // 13:24 LMST default

  const activeSunIdxClosest = Math.min(
    Math.max(0, Math.round(activeSunHour)),
    Math.max(0, sunSamples.length - 1)
  );
  const activeSunPoint = sunSamples[activeSunIdxClosest] ?? {
    timeLabel: "13:24",
    hour: 13.4,
    azimuthDeg: 318,
    elevationDeg: 52,
  };

  const curSunX = mapSunX(activeSunHour);
  const curAzY = mapSunY(activeSunPoint.azimuthDeg);
  const curElY = mapSunY(activeSunPoint.elevationDeg);

  const curSunTimeLabel =
    hoveredSunIdx !== null && sunSamples[hoveredSunIdx]
      ? `${sunSamples[hoveredSunIdx].timeLabel} LMST`
      : "13:24 LMST";

  return (
    <section
      style={{
        backgroundColor: panelBg,
        borderColor: borderCol,
      }}
      className="h-[216px] w-full border-t grid grid-cols-2 shrink-0 select-none pb-1"
    >
      {/* ================= LEFT HALF: ELEVATION & SLOPE CHART ================= */}
      <div
        style={{ borderColor: borderCol }}
        className="h-full border-r flex flex-col overflow-hidden"
      >
        <div
          style={{
            backgroundColor: headerBg,
            borderColor: borderCol,
          }}
          className="h-[34px] px-4 border-b flex items-center justify-between shrink-0"
        >
          <span
            style={{ color: themeTokens.textPrimary }}
            className="font-mono text-[11px] font-bold tracking-wide uppercase"
          >
            ELEVATION &amp; SLOPE {samples.length >= 2 ? `(JARAK ${route.totalDistanceKm.toFixed(2)} km)` : ""}
          </span>
          {samples.length >= 2 ? (
            <div className="flex items-center gap-5 font-mono text-[10.5px] font-bold">
              <span className="text-[#22C55E]">ASC +{route.totalAscentM}m</span>
              <span
                style={{
                  color:
                    route.maxSlopeDeg > 15
                      ? "#EF4444"
                      : route.maxSlopeDeg >= 10
                        ? "#F59E0B"
                        : "#22C55E",
                }}
              >
                MAX {route.maxSlopeDeg.toFixed(1)}°
                {route.maxSlopeDeg > 15
                  ? " RED"
                  : route.maxSlopeDeg >= 10
                    ? " STEEP"
                    : ""}
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] font-bold text-[#64748B]">
              NO DATA
            </span>
          )}
        </div>

        <div
          className="relative flex-1 w-full min-h-0 cursor-crosshair pb-1 flex items-center justify-center"
          onMouseMove={(e) => {
            if (samples.length < 2) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * 540;
            const frac = Math.max(0, Math.min(1, (svgX - xMin) / xW));
            const idx = Math.round(frac * (samples.length - 1));
            setHoveredElevIdx(idx);
            const pt = samples[idx];
            if (pt) onHoverCoord([pt.lon, pt.lat]);
          }}
          onMouseLeave={() => {
            setHoveredElevIdx(null);
            onHoverCoord(null);
          }}
        >
          {samples.length < 2 ? (
            <div className="w-full h-full flex items-center justify-center font-mono text-sm font-bold tracking-widest uppercase text-[#64748B]">
              No data
            </div>
          ) : (
            <svg viewBox="0 0 540 166" className="w-full h-full max-h-[172px]" preserveAspectRatio="xMidYMid meet">
              {/* Y Axis Vertical Line */}
              <line
                x1={xMin}
                y1="20"
                x2={xMin}
                y2={yBottom}
                stroke={borderCol}
                strokeWidth="1"
              />

              {/* Horizontal Grid Lines & Dynamic Y Labels */}
              {[1, 0.5, 0].map((frac, i) => {
                const val = Math.round(yMinElev + frac * ySpanElev);
                const y = mapElevY(val);
                return (
                  <g key={i}>
                    <line
                      x1={xMin}
                      y1={y}
                      x2={xMax}
                      y2={y}
                      stroke={gridCol}
                      strokeWidth="1"
                    />
                    <text
                      x={xMin - 8}
                      y={y + 3}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="9"
                      fontFamily="Consolas, monospace"
                    >
                      {val}m
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              <path
                d={
                  `M ${xMin},${yBottom} ` +
                  samples
                    .map(
                      (s, idx) =>
                        `L ${mapElevX(idx).toFixed(1)},${mapElevY(s.elevationM).toFixed(1)}`
                    )
                    .join(" ") +
                  ` L ${xMax},${yBottom} Z`
                }
                fill="rgba(34, 197, 94, 0.06)"
              />

              {/* SOLID Slope-Colored Polyline Segments (Green / Orange / Red) */}
              {samples.slice(0, -1).map((s, idx) => {
                const next = samples[idx + 1];
                return (
                  <line
                    key={idx}
                    x1={mapElevX(idx)}
                    y1={mapElevY(s.elevationM)}
                    x2={mapElevX(idx + 1)}
                    y2={mapElevY(next.elevationM)}
                    stroke={next.color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Vertical Cursor Line & Active Dot + Readout Box */}
              {activeSample && (
                <g>
                  <line
                    x1={mapElevX(activeElevIdx)}
                    y1="22"
                    x2={mapElevX(activeElevIdx)}
                    y2={yBottom}
                    stroke={activeSampleColor}
                    strokeWidth="1"
                  />
                  <circle
                    cx={mapElevX(activeElevIdx)}
                    cy={mapElevY(activeSample.elevationM)}
                    r="4.5"
                    fill={activeSampleColor}
                    stroke="#F8FAFC"
                    strokeWidth="1.8"
                  />
                  <g
                    transform={`translate(${Math.min(
                      324,
                      Math.max(58, mapElevX(activeElevIdx) - 96)
                    )}, 5)`}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="198"
                      height="21"
                      rx="2"
                      fill={
                        activeSample.slopeDeg > 15 ? "#220E10" : "#11151E"
                      }
                      stroke={activeSampleColor}
                      strokeWidth="1"
                    />
                    <text
                      x="99"
                      y="14"
                      textAnchor="middle"
                      fill={
                        activeSample.slopeDeg > 15 ? "#FCA5A5" : "#F8FAFC"
                      }
                      fontSize="9.5"
                      fontWeight="700"
                      fontFamily="Consolas, monospace"
                    >
                      {activeSample.distanceKm.toFixed(2)} km ·{" "}
                      {activeSample.elevationM.toLocaleString("en-US")}m ·{" "}
                      {activeSample.slopeDeg.toFixed(1)}°
                      {activeSample.slopeDeg > 15
                        ? " RED"
                        : activeSample.slopeDeg >= 10
                          ? " STEEP"
                          : ""}
                    </text>
                  </g>
                </g>
              )}

              {/* X-Axis Distance Labels */}
              <text
                x={xMin}
                y="152"
                fill="#94A3B8"
                fontSize="9"
                fontFamily="Consolas, monospace"
              >
                0.00 km (Start)
              </text>
              <text
                x={(xMin + xMax) / 2}
                y="152"
                textAnchor="middle"
                fill={
                  route.maxSlopeDeg > 15
                    ? "#EF4444"
                    : route.maxSlopeDeg >= 10
                      ? "#F59E0B"
                      : "#22C55E"
                }
                fontSize="9"
                fontWeight="700"
                fontFamily="Consolas, monospace"
              >
                Peak {route.maxSlopeDeg.toFixed(1)}° @{" "}
                {route.peakSlopeDistanceKm.toFixed(2)} km
              </text>
              <text
                x={xMax}
                y="152"
                textAnchor="end"
                fill="#94A3B8"
                fontSize="9"
                fontFamily="Consolas, monospace"
              >
                {route.totalDistanceKm.toFixed(2)} km (End)
              </text>
            </svg>
          )}
        </div>
      </div>

      {/* ================= RIGHT HALF: SUN ANGLE (AZIMUTH & ELEVATION 24H) ================= */}
      <div className="h-full flex flex-col overflow-hidden">
        <div
          style={{
            backgroundColor: headerBg,
            borderColor: borderCol,
          }}
          className="h-[34px] px-4 border-b flex items-center justify-between shrink-0"
        >
          <span
            style={{ color: themeTokens.textPrimary }}
            className="font-mono text-[11px] font-bold tracking-wide uppercase"
          >
            SUN ANGLE (AZIMUTH &amp; ELEVATION 24H)
          </span>
          {samples.length >= 2 ? (
            <div className="flex items-center gap-4 font-mono text-[10px]">
              <span className="text-[#64748B] font-bold">JPL EPHEMERIS</span>
              <span className="flex items-center gap-1.5 text-[#38BDF8] font-bold">
                <span className="w-2 h-2 bg-[#38BDF8] inline-block" />
                AZ {Math.round(activeSunPoint.azimuthDeg)}°
              </span>
              <span className="flex items-center gap-1.5 text-[#F59E0B] font-bold">
                <span className="w-2 h-2 bg-[#F59E0B] inline-block" />
                EL{" "}
                {activeSunPoint.elevationDeg >= 0
                  ? `+${Math.round(activeSunPoint.elevationDeg)}°`
                  : `${Math.round(activeSunPoint.elevationDeg)}°`}
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] font-bold text-[#64748B]">
              NO DATA
            </span>
          )}
        </div>

        <div
          className="relative flex-1 w-full min-h-0 cursor-crosshair pb-1 flex items-center justify-center"
          onMouseMove={(e) => {
            if (samples.length < 2 || sunSamples.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * 539;
            const frac = Math.max(0, Math.min(1, (svgX - sxMin) / sxW));
            const idx = Math.round(frac * (sunSamples.length - 1));
            setHoveredSunIdx(idx);
          }}
          onMouseLeave={() => setHoveredSunIdx(null)}
        >
          {samples.length < 2 ? (
            <div className="w-full h-full flex items-center justify-center font-mono text-sm font-bold tracking-widest uppercase text-[#64748B]">
              No data
            </div>
          ) : (
            <svg viewBox="0 0 539 166" className="w-full h-full max-h-[172px]" preserveAspectRatio="xMidYMid meet">
            <line
              x1={sxMin}
              y1="20"
              x2={sxMin}
              y2={syZero}
              stroke={borderCol}
              strokeWidth="1"
            />

            {[
              { deg: 360, label: "360°", isZero: false },
              { deg: 240, label: "240°", isZero: false },
              { deg: 120, label: "120°", isZero: false },
              { deg: 0, label: "0°", isZero: true },
            ].map((g) => {
              const y = mapSunY(g.deg);
              return (
                <g key={g.label}>
                  <line
                    x1={sxMin}
                    y1={y}
                    x2={sxMax}
                    y2={y}
                    stroke={g.isZero ? "#2E3646" : gridCol}
                    strokeWidth="1"
                  />
                  <text
                    x={sxMin - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="9"
                    fontFamily="Consolas, monospace"
                  >
                    {g.label}
                  </text>
                </g>
              );
            })}

            {/* Real Dynamic Blue Azimuth Curve from computeMarsSunAngles() */}
            {sunSamples.length > 1 && (
              <polyline
                points={sunSamples
                  .map(
                    (s) =>
                      `${mapSunX(s.hour).toFixed(1)},${mapSunY(s.azimuthDeg).toFixed(1)}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Real Dynamic Orange Elevation Curve from computeMarsSunAngles() */}
            {sunSamples.length > 1 && (
              <polyline
                points={sunSamples
                  .map(
                    (s) =>
                      `${mapSunX(s.hour).toFixed(1)},${mapSunY(s.elevationDeg).toFixed(1)}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical Cursor Line & Active Readout Pill */}
            <line
              x1={curSunX}
              y1="22"
              x2={curSunX}
              y2="144"
              stroke="#475569"
              strokeWidth="1"
            />
            <circle
              cx={curSunX}
              cy={curAzY}
              r="3.8"
              fill="#38BDF8"
              stroke="#090B0F"
              strokeWidth="1.5"
            />
            <circle
              cx={curSunX}
              cy={curElY}
              r="3.8"
              fill="#F59E0B"
              stroke="#090B0F"
              strokeWidth="1.5"
            />

            <g
              transform={`translate(${Math.min(
                326,
                Math.max(56, curSunX - 95)
              )}, 5)`}
            >
              <rect
                x="0"
                y="0"
                width="190"
                height="21"
                rx="2"
                fill="#11151E"
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x="95"
                y="14"
                textAnchor="middle"
                fill="#E2E8F0"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="Consolas, monospace"
              >
                {curSunTimeLabel} · {Math.round(activeSunPoint.azimuthDeg)}°AZ /{" "}
                {activeSunPoint.elevationDeg >= 0
                  ? `+${Math.round(activeSunPoint.elevationDeg)}°`
                  : `${Math.round(activeSunPoint.elevationDeg)}°`}
                EL
              </text>
            </g>

            {/* X-Axis 24h Time Labels */}
            <text
              x={sxMin}
              y="152"
              fill="#94A3B8"
              fontSize="9"
              fontFamily="Consolas, monospace"
            >
              00:00
            </text>
            <text
              x={mapSunX(4.8)}
              y="152"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="9"
              fontFamily="Consolas, monospace"
            >
              04:48
            </text>
            <text
              x={mapSunX(9.6)}
              y="152"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="9"
              fontFamily="Consolas, monospace"
            >
              09:36
            </text>
            <text
              x={mapSunX(13.4)}
              y="152"
              textAnchor="middle"
              fill="#F59E0B"
              fontSize="9"
              fontWeight="700"
              fontFamily="Consolas, monospace"
            >
              13:24 LMST
            </text>
            <text
              x={mapSunX(19.2)}
              y="152"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="9"
              fontFamily="Consolas, monospace"
            >
              19:12
            </text>
            <text
              x={sxMax}
              y="152"
              textAnchor="end"
              fill="#94A3B8"
              fontSize="9"
              fontFamily="Consolas, monospace"
            >
              24:00
            </text>
          </svg>
          )}
        </div>
      </div>
    </section>
  );
}
