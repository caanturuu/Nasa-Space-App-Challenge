"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Download, Footprints, MapPin, Navigation, PencilLine, Sun, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import {
  ALL_MARS_PLACES,
  CameraPreset,
  JEZERO_SCIENCE_TARGETS,
  MissionPreset,
  NASA_LAYERS,
  ScienceTargetFeature,
} from "@/lib/marsData";
import { EvaRouteResult, PlannerMode, planEvaRoute } from "@/lib/marsRouting";
import { ConditionScenario, getTelemetrySnapshot } from "@/lib/marsTelemetry";
import { LeftPanelTab, MarsTopSearchBar } from "@/components/MarsTopSearchBar";
import {
  LayerState,
  MarsFloatingRightControls,
} from "@/components/MarsFloatingRightControls";
import { MapPickMode, MarsFloatingLeftCard } from "@/components/MarsFloatingLeftCard";
import { MarsBingMapViewport } from "@/components/MarsBingMapViewport";
import { Mars3DGlobeView } from "@/components/Mars3DGlobeView";
import { DrawnProfileResult, loadGlobalMolaData } from "@/lib/marsTerrain";
import { computeMarsSunAngles, SunAnglePoint } from "@/lib/marsSunAngle";
import { MarsElevationProfileModal } from "@/components/MarsElevationProfileModal";

const INITIAL_LAYER_STATES: Record<string, LayerState> = Object.fromEntries(
  NASA_LAYERS.map((layer) => [
    layer.id,
    { visible: layer.defaultVisible, opacity: layer.defaultOpacity },
  ])
);

export default function MarsMapsPage() {
  const [layerStates, setLayerStates] = useState<Record<string, LayerState>>(INITIAL_LAYER_STATES);
  const [selectedPlace, setSelectedPlace] = useState<ScienceTargetFeature>(
    JEZERO_SCIENCE_TARGETS.features[0]
  );
  const [searchQuery, setSearchQuery] = useState<string>("Octavia E. Butler Hab Base");

  // Default: open the rich left card immediately so all telemetry, routes & science targets are visible
  const [leftOpen, setLeftOpen] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("directions");
  const [showProbeHud, setShowProbeHud] = useState<boolean>(true);
  const [mapDimension, setMapDimension] = useState<"2D" | "3D">("2D");

  const [startCoord, setStartCoord] = useState<[number, number]>([77.4509, 18.4446]);
  const [endCoord, setEndCoord] = useState<[number, number]>([77.405, 18.458]);
  const [mode, setMode] = useState<PlannerMode>("safest");
  const [maxSlopeDeg, setMaxSlopeDeg] = useState<number>(20);
  const [pickMode, setPickMode] = useState<MapPickMode>("inspect");
  const [showRoute, setShowRoute] = useState<boolean>(false);
  const [isDrawingLine, setIsDrawingLine] = useState<boolean>(false);
  const [drawnProfile, setDrawnProfile] = useState<DrawnProfileResult | null>(null);
  const [drawnRouteCoords, setDrawnRouteCoords] = useState<[number, number][] | null>(null);
  const [hoveredProfileIndex, setHoveredProfileIndex] = useState<number | null>(null);
  const [hoveredSunIndex, setHoveredSunIndex] = useState<number | null>(null);
  const [chartTab, setChartTab] = useState<"elevation" | "sun" | "both">("both");

  const handleToggleDrawLine = () => {
    setIsDrawingLine((prev) => !prev);
  };

  const handleLiveDrawLine = (result: DrawnProfileResult) => {
    setDrawnProfile(result);
  };

  const handleFinishDrawLine = (result: DrawnProfileResult) => {
    setDrawnProfile(result);
    setDrawnRouteCoords(result.points.map((p) => [p.lon, p.lat]));
    setIsDrawingLine(false);
    setLeftOpen(true);
  };

  const handleClearRoute = () => {
    setIsDrawingLine(false);
    setShowRoute(false);
    setDrawnProfile(null);
    setDrawnRouteCoords(null);
    setHoverProfileCoord(null);
    setHoveredProfileIndex(null);
    setHoveredSunIndex(null);
  };

  const [scenario, setScenario] = useState<ConditionScenario>("nominal");
  const [tick, setTick] = useState<number>(0);
  const [cameraRequest, setCameraRequest] = useState<{
    preset: CameraPreset;
    seq: number;
  } | null>(null);
  const [zoomSignal, setZoomSignal] = useState<{ delta: number; seq: number } | null>(null);
  const [hoverProfileCoord, setHoverProfileCoord] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadGlobalMolaData();
    const id = window.setInterval(() => setTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  const telemetry = useMemo(() => getTelemetrySnapshot(scenario, tick), [scenario, tick]);

  const { route, routeError } = useMemo<{
    route: EvaRouteResult | null;
    routeError: string | null;
  }>(() => {
    try {
      return {
        route: planEvaRoute(
          startCoord[0],
          startCoord[1],
          endCoord[0],
          endCoord[1],
          mode,
          maxSlopeDeg
        ),
        routeError: null,
      };
    } catch (err) {
      return {
        route: null,
        routeError: err instanceof Error ? err.message : "Failed to compute EVA route.",
      };
    }
  }, [startCoord, endCoord, mode, maxSlopeDeg]);

  const activeProfile = useMemo(() => {
    if (drawnProfile) return drawnProfile;
    if (showRoute && route && route.profile && route.profile.length > 0) {
      const elevs = route.profile.map((p) => p.elevationM);
      const minElev = Math.min(...elevs);
      const maxElev = Math.max(...elevs);
      return {
        totalDistanceM: route.metrics.totalDistanceM,
        minElevationM: Math.round(minElev),
        maxElevationM: Math.round(maxElev),
        totalAscentM: Math.round(route.metrics.totalAscentM),
        totalDescentM: Math.round(route.metrics.totalDescentM),
        points: route.profile.map((ep) => ({
          distanceM: ep.distanceM,
          elevationM: ep.elevationM,
          lon: ep.lon,
          lat: ep.lat,
          slopeDeg: ep.slopeDeg,
        })),
      };
    }
    return null;
  }, [drawnProfile, showRoute, route]);

  const sunAngleData = useMemo(() => {
    if (!activeProfile || activeProfile.points.length === 0) return null;
    const midIdx = Math.floor(activeProfile.points.length / 2);
    const midPt = activeProfile.points[midIdx];
    return computeMarsSunAngles(midPt.lat, midPt.lon);
  }, [activeProfile]);

  const handleExportSunAngleCsv = () => {
    if (!sunAngleData) return;
    const header = "Time,Hour,Elevation_Deg,Azimuth_Deg\n";
    const rows = sunAngleData
      .map((d) => `${d.timeLabel},${d.hour},${d.elevationDeg},${d.azimuthDeg}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mars_sun_angle_2026.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleLayer = (id: string) => {
    setLayerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id]?.visible },
    }));
  };

  const handleChangeOpacity = (id: string, opacity: number) => {
    setLayerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], opacity },
    }));
  };

  const handleSelectBasemapPreset = (preset: "orbital" | "mola" | "viking" | "slope") => {
    setLayerStates((prev) => ({
      ...prev,
      // MOLA Color Topography (Elevation Shaded Relief)
      mola_clrshade: {
        visible: preset === "mola",
        opacity: 1.0,
      },
      // Viking Natural Color Global
      viking_mdim21: {
        visible: preset === "viking",
        opacity: 1.0,
      },
      // CTX 5m High-Res Satellite Imagery (pure satellite mode)
      ctx_global_5m: {
        visible: preset === "orbital" || preset === "slope",
        opacity: 1.0,
      },
      // Official NASA Trek Reference: Jezero CTX 6m OrthoMosaic (JEZ_ctx_B_soc_008)
      jezero_trek_ctx_6m: {
        visible: preset === "orbital" || preset === "slope",
        opacity: 1.0,
      },
      // Slope Hazards overlay
      jezero_slope_overlay: {
        visible: preset === "slope",
        opacity: 0.85,
      },
    }));
  };

  const handleSelectPlace = (place: ScienceTargetFeature) => {
    setSelectedPlace(place);
    setSearchQuery(place.properties.name);
    setLeftTab("place");
    setLeftOpen(true);
    setCameraRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      preset: {
        id: place.properties.id,
        label: place.properties.name,
        center: place.geometry.coordinates,
        zoom: place.properties.inJezeroGrid ? 12.2 : 4.2,
      },
    }));
  };

  const handleOpenDirections = () => {
    setShowRoute(true);
    setLeftTab("directions");
    setLeftOpen(true);
  };

  const handleStartDirectionsToSelected = () => {
    setStartCoord(ALL_MARS_PLACES[0].geometry.coordinates);
    setEndCoord(selectedPlace.geometry.coordinates);
    setShowRoute(true);
    setLeftTab("directions");
    setLeftOpen(true);
  };

  const handleMapPickCoord = (coord: [number, number]) => {
    setShowRoute(true);
    if (pickMode === "pick_start") {
      setStartCoord(coord);
      setPickMode("inspect");
    } else if (pickMode === "pick_end") {
      setEndCoord(coord);
      setPickMode("inspect");
    }
  };

  const handleApplyPreset = (preset: MissionPreset) => {
    const startFeat = JEZERO_SCIENCE_TARGETS.features.find(
      (f) => f.properties.id === preset.startId
    );
    const endFeat = JEZERO_SCIENCE_TARGETS.features.find(
      (f) => f.properties.id === preset.endId
    );
    if (startFeat) setStartCoord(startFeat.geometry.coordinates);
    if (endFeat) {
      setEndCoord(endFeat.geometry.coordinates);
      setSelectedPlace(endFeat);
    }
    setMode(preset.mode);
    setShowRoute(true);
    setCameraRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      preset: {
        id: "preset_jezero",
        label: preset.label,
        center: [77.418, 18.458],
        zoom: 11.4,
      },
    }));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090c12] overflow-hidden">
      <main className="relative flex-1 min-h-0 overflow-hidden">
        <MarsBingMapViewport
          layerStates={layerStates}
          selectedPlace={selectedPlace}
          route={route}
          showRoute={showRoute}
          startCoord={startCoord}
          endCoord={endCoord}
          pickMode={pickMode}
          onMapPickCoord={handleMapPickCoord}
          onSelectPlace={handleSelectPlace}
          telemetry={telemetry}
          cameraRequest={cameraRequest}
          zoomSignal={zoomSignal}
          hoverProfileCoord={hoverProfileCoord}
          showProbeHud={true}
          isDrawingLine={isDrawingLine}
          onLiveDrawLine={handleLiveDrawLine}
          onFinishDrawLine={handleFinishDrawLine}
          drawnRouteCoords={drawnRouteCoords}
        />

        {/* Left Information Panel */}
        {leftOpen ? (
          <aside className="absolute top-4 left-4 z-20 w-80 sm:w-96 max-w-[calc(100vw-5rem)] rounded-xl border border-slate-300 bg-white/98 shadow-2xl flex flex-col overflow-hidden text-xs font-mono backdrop-blur-xs">
            {/* Header Panel */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${activeProfile ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  {activeProfile ? "Data Jalur & Elevasi" : "Panel Informasi"}
                </span>
              </div>
              <button
                onClick={() => setLeftOpen(false)}
                className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-500 hover:text-black hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                title="Tutup Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Isi Panel */}
            <div className="p-3.5 space-y-3.5 overflow-y-auto max-h-[calc(100vh-6rem)]">
              {activeProfile ? (
                <>
                  {/* Total Jarak & Tab Switcher (Tanpa Kotak) */}
                  <div className="space-y-2 px-1 pt-0.5">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                        Jarak Tempuh Total
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-black text-slate-950">
                          {activeProfile.totalDistanceM >= 1000
                            ? `${(activeProfile.totalDistanceM / 1000).toFixed(2)} km`
                            : `${activeProfile.totalDistanceM} m`}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          (~{Math.max(1, Math.round(activeProfile.totalDistanceM / 65))} mnt jalan)
                        </span>
                      </div>
                    </div>

                    {/* View Filter Tab Buttons */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-sans font-medium">
                      <button
                        onClick={() => setChartTab("both")}
                        className={`flex-1 py-1 px-1.5 rounded-md transition-all cursor-pointer text-center ${
                          chartTab === "both"
                            ? "bg-white text-slate-950 font-bold shadow-xs border border-slate-200"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        onClick={() => setChartTab("elevation")}
                        className={`flex-1 py-1 px-1.5 rounded-md transition-all cursor-pointer text-center ${
                          chartTab === "elevation"
                            ? "bg-white text-slate-950 font-bold shadow-xs border border-slate-200"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Elevasi
                      </button>
                      <button
                        onClick={() => setChartTab("sun")}
                        className={`flex-1 py-1 px-1.5 rounded-md transition-all cursor-pointer text-center ${
                          chartTab === "sun"
                            ? "bg-white text-slate-950 font-bold shadow-xs border border-slate-200"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Sun Angle
                      </button>
                    </div>
                  </div>

                  {/* 1. Profil Elevasi Jalur - Exact Template ala NASA Mars Trek (Tanpa Kotak) */}
                  {(chartTab === "both" || chartTab === "elevation") && (
                    <div className="space-y-1.5 select-none font-sans pt-1">
                      {/* Serif Header ala NASA Trek */}
                      <div className="text-center font-serif text-[16px] font-medium text-slate-900 tracking-tight">
                        Elevation Profile(s) Non–Interpolated
                      </div>

                      {/* Chart Container with Exact NASA Trek Axes and Tracking */}
                      <div
                        className={`relative ${
                          chartTab === "both" ? "h-56" : "h-64"
                        } w-full overflow-hidden cursor-crosshair`}
                        onMouseMove={(e) => {
                          if (!activeProfile || activeProfile.points.length < 2) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const leftPadPx = rect.width * (54 / 540);
                          const chartWPx = rect.width * (460 / 540);
                          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - leftPadPx) / chartWPx));
                          const targetDist = ratio * activeProfile.totalDistanceM;
                          let closestIdx = 0;
                          let minDiff = Infinity;
                          for (let i = 0; i < activeProfile.points.length; i++) {
                            const diff = Math.abs(activeProfile.points[i].distanceM - targetDist);
                            if (diff < minDiff) {
                              minDiff = diff;
                              closestIdx = i;
                            }
                          }
                          setHoveredProfileIndex(closestIdx);
                          const pt = activeProfile.points[closestIdx];
                          setHoverProfileCoord([pt.lon, pt.lat]);
                        }}
                        onMouseLeave={() => {
                          setHoveredProfileIndex(null);
                          setHoverProfileCoord(null);
                        }}
                      >
                        {activeProfile.points.length >= 2 ? (
                          <>
                            <svg viewBox="0 0 540 220" className="w-full h-full overflow-visible">
                              {/* Rotated Left Y-Axis Title "Elevation (Meters)" */}
                              <text
                                x="-96"
                                y="14"
                                transform="rotate(-90)"
                                textAnchor="middle"
                                fill="#1e293b"
                                fontSize="11"
                                fontWeight="600"
                                fontFamily="sans-serif"
                              >
                                Elevation (Meters)
                              </text>

                              {(() => {
                                const pts = activeProfile.points;
                                const minE = activeProfile.minElevationM;
                                const maxE = activeProfile.maxElevationM;

                                // Round to nice grid boundaries
                                const niceMinY = Math.floor(minE / 500) * 500;
                                const niceMaxY = Math.ceil(maxE / 500) * 500;
                                const ySpan = Math.max(500, niceMaxY - niceMinY);

                                const totalD = activeProfile.totalDistanceM || 1;
                                const leftPad = 54;
                                const chartW = 460;
                                const topY = 20;
                                const bottomY = 172;
                                const chartH = bottomY - topY;

                                // Generate 5 Y ticks
                                const numTicks = 5;
                                const tickStep = ySpan / numTicks;
                                const yTicks = Array.from({ length: numTicks + 1 }, (_, i) => {
                                  const val = Math.round(niceMinY + i * tickStep);
                                  const y = bottomY - (i / numTicks) * chartH;
                                  return { val, y };
                                });

                                // Horizontal faint light-blue grid lines
                                const gridLines = yTicks.map((t, idx) => (
                                  <g key={idx}>
                                    <line x1={leftPad} y1={t.y} x2={leftPad + chartW} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
                                    <text
                                      x={leftPad - 6}
                                      y={t.y + 4}
                                      textAnchor="end"
                                      fill="#475569"
                                      fontSize="10"
                                      fontFamily="sans-serif"
                                      fontWeight="500"
                                    >
                                      {t.val}
                                    </text>
                                  </g>
                                ));

                                // Bottom X Axis Ticks (0, 100k, 200k, 300k, 400k, 500k)
                                const xStepCount = 5;
                                const xTicks = Array.from({ length: xStepCount + 1 }, (_, i) => {
                                  const frac = i / xStepCount;
                                  const distVal = frac * totalD;
                                  const x = leftPad + frac * chartW;
                                  let label = "0";
                                  if (distVal >= 1000) {
                                    label = `${Math.round(distVal / 1000)}k`;
                                  } else if (distVal > 0) {
                                    label = `${Math.round(distVal)}`;
                                  }
                                  return { x, label };
                                });

                                // Curve points
                                const coords = pts.map((p) => {
                                  const x = leftPad + (p.distanceM / totalD) * chartW;
                                  const y = bottomY - ((p.elevationM - niceMinY) / ySpan) * chartH;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                });
                                const lineD = "M " + coords.join(" L ");

                                // Active point for tracking
                                const activePt =
                                  hoveredProfileIndex !== null ? pts[hoveredProfileIndex] : null;
                                const activeX = activePt
                                  ? leftPad + (activePt.distanceM / totalD) * chartW
                                  : null;
                                const activeY = activePt
                                  ? bottomY - ((activePt.elevationM - niceMinY) / ySpan) * chartH
                                  : null;

                                return (
                                  <>
                                    {gridLines}

                                    {/* Baseline axes */}
                                    <line x1={leftPad} y1={bottomY} x2={leftPad + chartW} y2={bottomY} stroke="#cbd5e1" strokeWidth="1.5" />

                                    {/* X Ticks & Labels */}
                                    {xTicks.map((xt, i) => (
                                      <g key={i}>
                                        <line x1={xt.x} y1={bottomY} x2={xt.x} y2={bottomY + 4} stroke="#94a3b8" strokeWidth="1.2" />
                                        <text
                                          x={xt.x}
                                          y={bottomY + 16}
                                          textAnchor="middle"
                                          fill="#475569"
                                          fontSize="9.5"
                                          fontFamily="sans-serif"
                                          fontWeight="500"
                                        >
                                          {xt.label}
                                        </text>
                                      </g>
                                    ))}

                                    {/* Bottom X-Axis Label "Distance from Start (Meters)" */}
                                    <text
                                      x={leftPad + chartW / 2}
                                      y={bottomY + 34}
                                      textAnchor="middle"
                                      fill="#1e293b"
                                      fontSize="11"
                                      fontWeight="600"
                                      fontFamily="sans-serif"
                                    >
                                      Distance from Start (Meters)
                                    </text>

                                    {/* NASA Trek Solid Blue Profile Curve (#5b9bd5) */}
                                    <path
                                      d={lineD}
                                      fill="none"
                                      stroke="#5b9bd5"
                                      strokeWidth="2.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />

                                    {/* Interactive Scrubber Line & Point */}
                                    {activeX !== null && activeY !== null && (
                                      <>
                                        <line
                                          x1={activeX}
                                          y1={topY}
                                          x2={activeX}
                                          y2={bottomY}
                                          stroke="#ef4444"
                                          strokeWidth="2.5"
                                          strokeDasharray="3 3"
                                        />
                                        <circle
                                          cx={activeX}
                                          cy={activeY}
                                          r="5"
                                          fill="#ef4444"
                                          stroke="#ffffff"
                                          strokeWidth="2"
                                        />
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </svg>

                            {/* Dynamic HUD Tooltip on Hover */}
                            {hoveredProfileIndex !== null && activeProfile.points[hoveredProfileIndex] && (
                              <div className="absolute top-2 left-3 right-3 flex items-center justify-between text-[11px] bg-slate-900/90 text-white px-3 py-1.5 rounded-md shadow-lg pointer-events-none">
                                <span className="font-bold text-sky-300">
                                  Jarak:{" "}
                                  {activeProfile.points[hoveredProfileIndex].distanceM >= 1000
                                    ? `${(activeProfile.points[hoveredProfileIndex].distanceM / 1000).toFixed(2)} km`
                                    : `${Math.round(activeProfile.points[hoveredProfileIndex].distanceM)} m`}
                                </span>
                                <span className="font-bold text-emerald-300">
                                  Elevasi: {Math.round(activeProfile.points[hoveredProfileIndex].elevationM)} m
                                </span>
                                <span className="text-slate-300">
                                  {activeProfile.points[hoveredProfileIndex].lat.toFixed(4)}°N, {activeProfile.points[hoveredProfileIndex].lon.toFixed(4)}°E
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                            Data profil tersedia
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Divider between charts if both active */}
                  {chartTab === "both" && <div className="border-t border-slate-200 my-1" />}

                  {/* 2. Sun Angle Chart ala NASA Mars Trek (Tanpa Kotak) */}
                  {(chartTab === "both" || chartTab === "sun") && (
                    <div className="space-y-1.5 select-none font-sans pt-1">
                      {/* Serif Header ala NASA Trek - Consistent with Elevation Profile */}
                      <div className="text-center font-serif text-[16px] font-medium text-slate-900 tracking-tight">
                        Sun Angle (Azimuth & Elevation 24h)
                      </div>
                      <div className="text-center text-[10px] text-slate-400 font-mono -mt-1">
                        NASA JPL Ephemeris Model
                      </div>

                      {/* NASA Trek Sun Chart Canvas with Exact Rulers & Scrubber */}
                      <div
                        className={`relative ${
                          chartTab === "both" ? "h-56" : "h-64"
                        } w-full overflow-hidden cursor-crosshair select-none`}
                        onMouseMove={(e) => {
                          if (!sunAngleData || sunAngleData.length === 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const leftPadPx = rect.width * (54 / 540);
                          const chartWPx = rect.width * (460 / 540);
                          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - leftPadPx) / chartWPx));
                          const idx = Math.min(sunAngleData.length - 1, Math.max(0, Math.round(ratio * (sunAngleData.length - 1))));
                          setHoveredSunIndex(idx);
                        }}
                        onMouseLeave={() => setHoveredSunIndex(null)}
                      >
                        {sunAngleData && (
                          <svg viewBox="0 0 540 220" className="w-full h-full overflow-visible">
                            {/* Rotated Left Y-Axis Title "Azimuth/Elevation" */}
                            <text
                              x="-96"
                              y="14"
                              transform="rotate(-90)"
                              textAnchor="middle"
                              fill="#1e293b"
                              fontSize="11"
                              fontWeight="600"
                              fontFamily="sans-serif"
                            >
                              Azimuth/Elevation
                            </text>

                            {/* Horizontal faint grid lines matching Elevation Profile */}
                            {[100, 200, 300, 400, 500].map((val) => {
                              const y = 172 - (val / 500) * 152;
                              return (
                                <line key={val} x1="54" y1={y} x2="514" y2={y} stroke="#e2e8f0" strokeWidth="1" />
                              );
                            })}

                            {/* Y-Axis Tick Labels: 0, 100, 200, 300, 400, 500 */}
                            {[
                              { val: 500, y: 20 },
                              { val: 400, y: 50 },
                              { val: 300, y: 81 },
                              { val: 200, y: 111 },
                              { val: 100, y: 142 },
                              { val: 0, y: 172 },
                            ].map((tick) => (
                              <g key={tick.val}>
                                <text
                                  x="48"
                                  y={tick.y + 4}
                                  textAnchor="end"
                                  fill="#475569"
                                  fontSize="10"
                                  fontWeight="500"
                                  fontFamily="sans-serif"
                                >
                                  {tick.val}
                                </text>
                                <line x1="50" y1={tick.y} x2="54" y2={tick.y} stroke="#94a3b8" strokeWidth="1.2" />
                              </g>
                            ))}

                            {/* Baseline axes matching Elevation Profile */}
                            <line x1="54" y1="20" x2="54" y2="172" stroke="#cbd5e1" strokeWidth="1.5" />
                            <line x1="54" y1="172" x2="514" y2="172" stroke="#cbd5e1" strokeWidth="1.5" />

                            {/* Horizon 0° Reference Dashline */}
                            <line x1="54" y1="172" x2="514" y2="172" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

                          {/* X-Axis Ticks: 00:00:00, 04:48:00, 09:36:00, 14:24:00, 19:12:00, 00:00:00 */}
                          {[
                            { label1: "2026-318", label2: "00:00:00", frac: 0 },
                            { label1: "2026-318", label2: "04:48:00", frac: 0.2 },
                            { label1: "2026-318", label2: "09:36:00", frac: 0.4 },
                            { label1: "2026-318", label2: "14:24:00", frac: 0.6 },
                            { label1: "2026-318", label2: "19:12:00", frac: 0.8 },
                            { label1: "2026-319", label2: "00:00:00", frac: 1.0 },
                          ].map((t, idx) => {
                            const x = 54 + t.frac * 460;
                            return (
                              <g key={idx}>
                                <line x1={x} y1="172" x2={x} y2="177" stroke="#94a3b8" strokeWidth="1.2" />
                                <text
                                  x={x}
                                  y="188"
                                  textAnchor="middle"
                                  fill="#475569"
                                  fontSize="9"
                                  fontFamily="sans-serif"
                                >
                                  {t.label1}
                                </text>
                                <text
                                  x={x}
                                  y="199"
                                  textAnchor="middle"
                                  fill="#475569"
                                  fontSize="8.5"
                                  fontFamily="sans-serif"
                                >
                                  {t.label2}
                                </text>
                              </g>
                            );
                          })}

                          {/* Bottom X-Axis Label "Time" */}
                          <text
                            x="284"
                            y="214"
                            textAnchor="middle"
                            fill="#1e293b"
                            fontSize="11"
                            fontWeight="600"
                            fontFamily="sans-serif"
                          >
                            Time
                          </text>

                          {/* Azimuth Curve (NASA Sky Blue #38bdf8) */}
                          {(() => {
                            const pts = sunAngleData.map((d, i) => {
                              const x = 54 + (i / 24) * 460;
                              const y = 172 - (d.azimuthDeg / 500) * 152;
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            });
                            return (
                              <path
                                d={"M " + pts.join(" L ")}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            );
                          })()}

                          {/* Elevation Curve (NASA Orange #f97316) */}
                          {(() => {
                            const pts = sunAngleData.map((d, i) => {
                              const x = 54 + (i / 24) * 460;
                              const y = 172 - (d.elevationDeg / 500) * 152;
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            });
                            return (
                              <path
                                d={"M " + pts.join(" L ")}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            );
                          })()}

                          {/* Interactive Scrubber Needle with 2 Green Indicator Circles */}
                          {hoveredSunIndex !== null && sunAngleData[hoveredSunIndex] && (() => {
                            const active = sunAngleData[hoveredSunIndex];
                            const activeX = 54 + (hoveredSunIndex / 24) * 460;
                              const azY = 172 - (active.azimuthDeg / 500) * 152;
                              const elY = 172 - (active.elevationDeg / 500) * 152;

                            return (
                              <g>
                                <line
                                  x1={activeX}
                                  y1="20"
                                  x2={activeX}
                                  y2="172"
                                  stroke="#262626"
                                  strokeWidth="2.5"
                                />
                                <circle
                                  cx={activeX}
                                  cy={azY}
                                  r="4.5"
                                  fill="#22c55e"
                                  stroke="#15803d"
                                  strokeWidth="1"
                                />
                                <circle
                                  cx={activeX}
                                  cy={elY}
                                  r="4.5"
                                  fill="#22c55e"
                                  stroke="#15803d"
                                  strokeWidth="1"
                                />
                              </g>
                            );
                          })()}
                        </svg>
                      )}

                      {/* Exact NASA Mars Trek Floating Tooltip Box */}
                      {hoveredSunIndex !== null && sunAngleData[hoveredSunIndex] && (() => {
                        const active = sunAngleData[hoveredSunIndex];
                        const frac = hoveredSunIndex / 24;
                        return (
                          <div
                            style={{
                              left: frac > 0.5 ? "auto" : `${Math.max(12, frac * 100 - 8)}%`,
                              right: frac > 0.5 ? `${Math.max(12, (1 - frac) * 100 - 8)}%` : "auto",
                            }}
                            className="absolute top-2 z-10 rounded border-2 border-slate-900 bg-white px-3 py-1.5 shadow-2xl pointer-events-none text-left"
                          >
                            <div className="text-[13px] font-sans font-bold text-black leading-tight">
                              Azimuth: {active.azimuthDeg.toFixed(2)}°
                            </div>
                            <div className="text-[13px] font-sans font-bold text-black leading-tight mt-0.5">
                              Elevation: {active.elevationDeg.toFixed(2)}°
                            </div>
                            <div className="text-xs font-sans text-slate-800 leading-tight mt-0.5">
                              Time: 2026-318T{active.timeLabel}:00
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Legend Row: Elevation (Orange) | Azimuth (Blue) */}
                    <div className="flex items-center justify-end gap-5 text-xs font-sans px-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-1 bg-[#f97316] rounded-xs" />
                        <span className="font-bold text-slate-900">Elevation</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-1 bg-[#38bdf8] rounded-xs" />
                        <span className="font-bold text-slate-900">Azimuth</span>
                      </div>
                    </div>
                  </div>
                )}

                  {/* Tombol Hapus Rute */}
                  <button
                    onClick={handleClearRoute}
                    className="w-full py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Hapus Jalur Ini</span>
                  </button>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <div className="w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center justify-center">
                    <MapPin className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                    <span className="text-xs font-bold text-slate-600">Belum Ada Jalur Aktif</span>
                    <span className="text-[11px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                      Gunakan tombol pin di kanan atas untuk menggambar jalur dan mengukur profil elevasi MOLA.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white/95 text-slate-800 text-xs font-mono font-bold shadow-md hover:bg-slate-50 cursor-pointer pointer-events-auto"
            title="Buka Panel Informasi"
          >
            <span>+ Panel Info</span>
          </button>
        )}

        {/* Right Quick Controls Toolbar */}
        <MarsFloatingRightControls
          layerStates={layerStates}
          onToggleLayer={handleToggleLayer}
          onChangeOpacity={handleChangeOpacity}
          onSelectBasemapPreset={handleSelectBasemapPreset}
          telemetry={telemetry}
          scenario={scenario}
          onScenarioChange={setScenario}
          onZoomIn={() => setZoomSignal((z) => ({ delta: 1, seq: (z?.seq ?? 0) + 1 }))}
          onZoomOut={() => setZoomSignal((z) => ({ delta: -1, seq: (z?.seq ?? 0) + 1 }))}
          onCenterJezero={() =>
            setCameraRequest((prev) => ({
              seq: (prev?.seq ?? 0) + 1,
              preset: {
                id: "center_jezero",
                label: "Jezero Crater",
                center: [77.422, 18.456],
                zoom: 11.4,
              },
            }))
          }
          onResetGlobal={() =>
            setCameraRequest((prev) => ({
              seq: (prev?.seq ?? 0) + 1,
              preset: {
                id: "global_mars",
                label: "Global Mars",
                center: [40.0, 8.0],
                zoom: 2.0,
              },
            }))
          }
          showProbeHud={showProbeHud}
          onToggleProbeHud={() => setShowProbeHud((s) => !s)}
          isDrawingLine={isDrawingLine}
          onToggleDrawLine={handleToggleDrawLine}
          showRoute={showRoute}
          onToggleAutoRoute={() => setShowRoute((r) => !r)}
          onClearRoute={handleClearRoute}
          hasActiveRoute={Boolean(showRoute || drawnProfile || drawnRouteCoords)}
        />
      </main>
    </div>
  );
}
