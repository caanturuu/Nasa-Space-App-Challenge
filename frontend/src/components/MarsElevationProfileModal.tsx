"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { DrawnProfileResult } from "@/lib/marsTerrain";

interface MarsElevationProfileModalProps {
  profile: DrawnProfileResult;
  onClose: () => void;
  onHoverPoint?: (coord: [number, number] | null) => void;
}

export function MarsElevationProfileModal({
  profile,
  onClose,
  onHoverPoint,
}: MarsElevationProfileModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { points, totalDistanceM, minElevationM, maxElevationM } = profile;

  // Calculate clean round intervals for Y-axis ticks
  const { niceMinY, niceMaxY, yTicks } = useMemo(() => {
    if (!points || points.length === 0) {
      return { niceMinY: -3000, niceMaxY: 0, yTicks: [0, -1000, -2000, -3000] };
    }
    const rawSpan = Math.max(50, maxElevationM - minElevationM);
    const rawStep = rawSpan / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let step = magnitude;
    if (normalized >= 5) step = 5 * magnitude;
    else if (normalized >= 2) step = 2 * magnitude;
    else step = magnitude;

    const minTick = Math.floor(minElevationM / step) * step;
    const maxTick = Math.ceil(maxElevationM / step) * step;
    const ticks: number[] = [];
    for (let v = maxTick; v >= minTick - 0.001; v -= step) {
      ticks.push(Math.round(v));
    }
    return { niceMinY: minTick, niceMaxY: maxTick, yTicks: ticks };
  }, [points, minElevationM, maxElevationM]);

  // Calculate clean round intervals for X-axis ticks
  const xTicks = useMemo(() => {
    if (!totalDistanceM || totalDistanceM <= 0) {
      return [{ distM: 0, label: "0" }];
    }
    const rawStep = totalDistanceM / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let step = magnitude;
    if (normalized >= 5) step = 5 * magnitude;
    else if (normalized >= 2) step = 2 * magnitude;
    else step = magnitude;

    const ticks: { distM: number; label: string }[] = [];
    for (let d = 0; d <= totalDistanceM + step * 0.05; d += step) {
      const val = Math.round(d);
      const label = val === 0 ? "0" : val >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`;
      ticks.push({ distM: val, label });
    }
    return ticks;
  }, [totalDistanceM]);

  if (!points || points.length === 0) return null;

  // Chart Dimensions
  const svgW = 600;
  const svgH = 260;
  const padL = 75;
  const padR = 25;
  const padT = 25;
  const padB = 45;

  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;
  const ySpan = Math.max(1, niceMaxY - niceMinY);

  // Curve points
  const svgPoints = points.map((p) => {
    const x = padL + (p.distanceM / (totalDistanceM || 1)) * innerW;
    const y = padT + innerH - ((p.elevationM - niceMinY) / ySpan) * innerH;
    return { x, y, pt: p };
  });

  const pathD = svgPoints
    .map((sp, idx) => `${idx === 0 ? "M" : "L"} ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`)
    .join(" ");

  // Mini Scrubber Sparkline
  const scrubberW = 480;
  const scrubberH = 32;
  const miniPoints = points.map((p) => {
    const x = (p.distanceM / (totalDistanceM || 1)) * scrubberW;
    const y = scrubberH - 4 - ((p.elevationM - niceMinY) / ySpan) * (scrubberH - 8);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const miniPathD = "M " + miniPoints.join(" L ");

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (clientX - (padL / svgW) * rect.width) / ((innerW / svgW) * rect.width)));
    const targetDist = ratio * totalDistanceM;

    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].distanceM - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setHoveredIdx(closestIdx);
    onHoverPoint?.([points[closestIdx].lon, points[closestIdx].lat]);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    onHoverPoint?.(null);
  };

  const activeSample = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeSvgPt = hoveredIdx !== null ? svgPoints[hoveredIdx] : null;

  return (
    <div className="absolute top-4 left-4 z-30 w-[95vw] max-w-[660px] rounded-sm shadow-2xl border border-slate-600 bg-white overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-150">
      {/* 1. NASA Trek Charcoal Top Bar */}
      <div className="h-9 px-3.5 bg-[#404040] flex items-center justify-between text-white border-b border-black/40">
        <span className="font-sans font-medium text-sm tracking-wide text-white">
          Elevation
        </span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full bg-slate-500/60 hover:bg-slate-400 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
          title="Close Elevation Window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. NASA Trek Light Gray Subheader */}
      <div className="h-9 px-4 bg-[#d0d0d0] flex items-center border-b border-slate-300">
        <span className="text-[#333333] font-sans font-normal text-base">
          Elevation Chart
        </span>
      </div>

      {/* 3. Main Chart White Body */}
      <div className="p-4 bg-white flex flex-col items-center">
        {/* Chart Title */}
        <div className="text-center font-serif text-[19px] text-[#1f2937] tracking-tight mb-2">
          Elevation Profile(s) Non–Interpolated
        </div>

        {/* SVG Main Chart */}
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-auto cursor-crosshair overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((val, idx) => {
              const y = padT + innerH - ((val - niceMinY) / ySpan) * innerH;
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + innerW}
                    y2={y}
                    stroke="#e4ebf5"
                    strokeWidth="1.2"
                  />
                  <text
                    x={padL - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11.5"
                    fontFamily="'Segoe UI', Roboto, sans-serif"
                    fill="#334155"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Title (Rotated 90 degrees) */}
            <text
              x={-(padT + innerH / 2)}
              y={20}
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize="12.5"
              fontFamily="'Segoe UI', Roboto, sans-serif"
              fill="#334155"
            >
              Elevation (Meters)
            </text>

            {/* X-Axis Baseline & Ticks */}
            <line
              x1={padL}
              y1={padT + innerH}
              x2={padL + innerW}
              y2={padT + innerH}
              stroke="#dbe5f1"
              strokeWidth="1.5"
            />
            {xTicks.map((t, idx) => {
              const x = padL + (t.distM / (totalDistanceM || 1)) * innerW;
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={padT + innerH}
                    x2={x}
                    y2={padT + innerH + 5}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                  />
                  <text
                    x={x}
                    y={padT + innerH + 18}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontFamily="'Segoe UI', Roboto, sans-serif"
                    fill="#334155"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Title */}
            <text
              x={padL + innerW / 2}
              y={padT + innerH + 36}
              textAnchor="middle"
              fontSize="12.5"
              fontFamily="'Segoe UI', Roboto, sans-serif"
              fill="#334155"
            >
              Distance from Start (Meters)
            </text>

            {/* The Solid Blue Elevation Curve Line (Exact NASA Trek Blue #5b9bd5) */}
            <path
              d={pathD}
              fill="none"
              stroke="#5b9bd5"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Crosshair Probe */}
            {activeSvgPt && activeSample && (
              <g>
                <line
                  x1={activeSvgPt.x}
                  y1={padT}
                  x2={activeSvgPt.x}
                  y2={padT + innerH}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle cx={activeSvgPt.x} cy={activeSvgPt.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              </g>
            )}
          </svg>

          {/* Active Probe Tooltip */}
          {activeSample && (
            <div className="absolute top-2 right-4 bg-slate-900/90 text-white text-xs font-mono px-3 py-1.5 rounded shadow-lg pointer-events-none flex items-center gap-3">
              <span>Jarak: <b>{activeSample.distanceM >= 1000 ? `${(activeSample.distanceM / 1000).toFixed(2)}km` : `${activeSample.distanceM}m`}</b></span>
              <span>Elevasi: <b>{activeSample.elevationM} m</b></span>
              <span>Kemiringan: <b>{activeSample.slopeDeg.toFixed(1)}°</b></span>
            </div>
          )}
        </div>

        {/* 4. NASA Trek Scrubber Slider Track */}
        <div className="w-full max-w-[500px] mt-2 mb-3">
          <div className="h-8 w-full bg-[#dbe5f1] border border-[#b8cde6] rounded relative flex items-center overflow-hidden">
            <svg viewBox={`0 0 ${scrubberW} ${scrubberH}`} className="w-full h-full opacity-60">
              <path d={miniPathD} fill="none" stroke="#5b9bd5" strokeWidth="1.5" />
            </svg>
            {/* Scrubber Handles */}
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#a8c2e0] border-r border-[#8aaecf] flex items-center justify-center text-[9px] text-[#4a6b8c] font-bold">
              ||
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-[#a8c2e0] border-l border-[#8aaecf] flex items-center justify-center text-[9px] text-[#4a6b8c] font-bold">
              ||
            </div>
          </div>
        </div>

        {/* 5. Legend */}
        <div className="flex items-center gap-2 text-xs font-sans text-slate-700 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5]" />
          <span className="font-medium text-slate-800">MGS MOLA, Global DEM</span>
        </div>
      </div>

      {/* 6. Footer Bar */}
      <div className="px-4 py-2 bg-[#f1f5f9] border-t border-slate-200 flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium hover:text-sky-700 cursor-pointer">
          Export
        </span>
        <div className="text-[11px] text-slate-500 font-mono">
          Total Jarak: <b>{totalDistanceM >= 1000 ? `${(totalDistanceM / 1000).toFixed(2)} km` : `${totalDistanceM} m`}</b> · Elev: <b>{minElevationM}m</b> s.d <b>{maxElevationM}m</b>
        </div>
      </div>
    </div>
  );
}
