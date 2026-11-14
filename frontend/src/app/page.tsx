"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_MARS_PLACES,
  CameraPreset,
  JEZERO_SCIENCE_TARGETS,
  ScienceTargetFeature,
} from "@/lib/marsData";
import { PlannerMode } from "@/lib/marsRouting";
import { ConditionScenario } from "@/lib/marsTelemetry";
import { loadGlobalMolaData } from "@/lib/marsTerrain";
import {
  BasemapId,
  BasemapRegistry,
  EVARoutePlannerController,
  SolarEphemerisModel,
  SuitLifeSupportModel,
  ThemeController,
  WaypointInput,
  WorkbenchTabId,
  WorkbenchThemeMode,
} from "@/oop/MarsWorkbenchOOP";
import { MarsBingMapViewport } from "@/components/MarsBingMapViewport";
import { MarsSplitBottomProfiler } from "@/components/MarsSplitBottomProfiler";
import { MarsMissionBriefingView } from "@/components/MarsMissionBriefingView";

const COG_PATH =
  "M 13.55 6.77 L 16.24 6.98 L 16.24 9.26 L 13.55 9.47 L 12.92 11 L 14.67 13.05 L 13.05 14.67 L 11 12.92 L 9.47 13.55 L 9.26 16.24 L 6.98 16.24 L 6.77 13.55 L 5.24 12.92 L 3.19 14.67 L 1.57 13.05 L 3.32 11 L 2.69 9.47 L 0 9.26 L 0 6.98 L 2.69 6.77 L 3.32 5.24 L 1.57 3.19 L 3.19 1.57 L 5.24 3.32 L 6.77 2.69 L 6.98 0 L 9.26 0 L 9.47 2.69 L 11 3.32 L 13.05 1.57 L 14.67 3.19 L 12.92 5.24 Z";

export default function MarsWorkbenchPage() {
  // 1. OOP ThemeController (Dark default, toggled via top-right Settings Gear ⚙)
  const [themeMode, setThemeMode] = useState<WorkbenchThemeMode>("dark");
  const themeController = useMemo(
    () => new ThemeController(themeMode),
    [themeMode]
  );
  const themeTokens = themeController.getTokens();
  const isDark = themeMode === "dark";

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // 2. OOP BasemapRegistry (Real OpenLayers NASA Trek WMTS Layers)
  const [activeBasemapId, setActiveBasemapId] =
    useState<BasemapId>("jezero_ctx_6m");
  const [showBasemapPanel, setShowBasemapPanel] = useState<boolean>(false);

  const basemapRegistry = useMemo(
    () => new BasemapRegistry(activeBasemapId),
    [activeBasemapId]
  );
  const layerStates = useMemo(
    () => basemapRegistry.getActiveBasemap().toOpenLayersState(),
    [basemapRegistry]
  );

  // 3. View / Tab & Briefing Overlay State
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>("overview");
  const [showBottomProfiler, setShowBottomProfiler] = useState<boolean>(false);

  // 4. Live MEDA Telemetry & Contingency Scenario
  const [scenario, setScenario] = useState<ConditionScenario>("nominal");
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    loadGlobalMolaData();
    const id = window.setInterval(() => setTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  const telemetry = useMemo(
    () => EVARoutePlannerController.getEnvironmentSnapshot(scenario, tick),
    [scenario, tick]
  );

  // 5. Real Geographic Waypoints (Start -> Second -> ... -> End)
  const [activeCorridorId, setActiveCorridorId] =
    useState<string>("corridor-kodiak");
  const [waypoints, setWaypoints] = useState<WaypointInput[]>(
    EVARoutePlannerController.CORRIDOR_PRESETS[0].waypoints
  );
  const [routingMode, setRoutingMode] = useState<PlannerMode>("safest");
  const [maxSlopeLimit, setMaxSlopeLimit] = useState<number>(15.0);
  const [usingSafeDetour, setUsingSafeDetour] = useState<boolean>(false);
  const [isMarkingMode, setIsMarkingMode] = useState<boolean>(false);
  const [exportedBanner, setExportedBanner] = useState<string | null>(null);

  // Selected Science Target & Search Autocomplete
  const [selectedPlace, setSelectedPlace] = useState<ScienceTargetFeature>(
    JEZERO_SCIENCE_TARGETS.features[2] // Hawksbill Gap Delta Front
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    "Octavia E. Butler Hab Base"
  );
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  // Real OpenLayers Camera, Zoom & Hover Sync
  const [cameraRequest, setCameraRequest] = useState<{
    preset: CameraPreset;
    seq: number;
  } | null>(null);
  const [zoomSignal, setZoomSignal] = useState<{
    delta: number;
    seq: number;
  } | null>(null);
  const [hoverProfileCoord, setHoverProfileCoord] = useState<
    [number, number] | null
  >(null);

  const isEmergency = scenario !== "nominal";

  // 6. Real OOP Route Calculation (A* + Terrain Elevation & Slope)
  const computedRoute = useMemo(() => {
    const activePts = isEmergency
      ? EVARoutePlannerController.EMERGENCY_RETURN_WAYPOINTS
      : waypoints;
    return EVARoutePlannerController.computeRoute(
      activePts,
      routingMode,
      maxSlopeLimit,
      true
    );
  }, [isEmergency, waypoints, routingMode, maxSlopeLimit]);

  // Pre-compute preset summaries for Overview cards so every card shows real terrain math
  const presetModels = useMemo(() => {
    const life = new SuitLifeSupportModel();
    return EVARoutePlannerController.CORRIDOR_PRESETS.map((preset) => {
      const model = EVARoutePlannerController.computeRoute(
        preset.waypoints,
        "safest",
        15.0,
        true
      );
      const o2 = life.evaluate(model, false);
      return { preset, model, o2 };
    });
  }, []);

  // 7. Real OOP Suit O2 Fuel Gauge Calculation
  const lifeSupport = useMemo(() => {
    const model = new SuitLifeSupportModel(84, 370);
    return model.evaluate(computedRoute, isEmergency);
  }, [computedRoute, isEmergency]);

  // 8. Real OOP 24h NASA JPL Solar Ephemeris Calculation
  const solarModel = useMemo(() => {
    const mid =
      computedRoute.nodes[Math.floor(computedRoute.nodes.length / 2)];
    return new SolarEphemerisModel(
      mid?.lat ?? 18.4446,
      mid?.lon ?? 77.4509
    );
  }, [computedRoute.nodes]);

  const sunSamples = useMemo(() => solarModel.getSamples(), [solarModel]);
  const currentSun = useMemo(() => solarModel.getCurrentAtLmst(), [solarModel]);

  // Next Click Prompt Label (Start Point -> Second Point -> End Point)
  const nextWaypointPrompt = useMemo(() => {
    if (waypoints.length === 0) return "CLICK MAP TO MARK 1 · START POINT";
    if (waypoints.length === 1) return "CLICK MAP TO MARK 2 · SECOND POINT";
    if (waypoints.length === 2)
      return "CLICK MAP TO MARK 3 · END POINT (OR CONTINUE CHAINING)";
    return `CLICK MAP TO APPEND WAYPOINT ${waypoints.length + 1} (END POINT)`;
  }, [waypoints.length]);

  // Tab switcher
  const handleSelectTab = (tab: WorkbenchTabId) => {
    setActiveTab(tab);
    if (tab === "overview") {
      setShowBottomProfiler(false);
      setShowBasemapPanel(false);
      setIsMarkingMode(false);
    } else if (tab === "route") {
      setShowBottomProfiler(true);
      setShowBasemapPanel(false);
      setIsMarkingMode(true);
    } else if (tab === "science") {
      setShowBottomProfiler(false);
      setShowBasemapPanel(true);
      setIsMarkingMode(false);
    }
  };

  // Handle clicking directly on the OpenLayers Mars map to set Start -> Second -> End Point
  const handleMapClickCoordinate = (coord: [number, number]) => {
    if (isEmergency) return;
    if (!isMarkingMode && activeTab !== "route") return;

    const [lon, lat] = coord;
    setUsingSafeDetour(false);
    setWaypoints((prev) => {
      const nextNum = prev.length + 1;
      const defaultName =
        nextNum === 1
          ? `Start Point (${lat.toFixed(3)}°N)`
          : nextNum === 2
            ? `Second Point (${lat.toFixed(3)}°N)`
            : `Point ${nextNum} (${lat.toFixed(3)}°N)`;
      return [
        ...prev,
        {
          id: `custom-${Date.now()}-${nextNum}`,
          label: defaultName,
          lon,
          lat,
        },
      ];
    });
    setShowBottomProfiler(true);
  };

  const handleStartFreshRoute = () => {
    setWaypoints([]);
    setUsingSafeDetour(false);
    setActiveTab("route");
    setShowBottomProfiler(true);
    setIsMarkingMode(true);
  };

  const handleUndoLastWaypoint = () => {
    setWaypoints((prev) => prev.slice(0, -1));
  };

  const handleSelectCorridorPreset = (corridorId: string) => {
    const found = EVARoutePlannerController.CORRIDOR_PRESETS.find(
      (c) => c.id === corridorId
    );
    if (!found) return;
    setActiveCorridorId(found.id);
    setWaypoints(found.waypoints);
    setUsingSafeDetour(false);
    const feat = JEZERO_SCIENCE_TARGETS.features.find(
      (f) => f.properties.id === found.targetId
    );
    if (feat) setSelectedPlace(feat);
    setCameraRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      preset: {
        id: found.id,
        label: found.title,
        center: [77.425, 18.45],
        zoom: 12.2,
      },
    }));
  };

  const handleToggleSafeDetour = () => {
    if (!usingSafeDetour) {
      setWaypoints(EVARoutePlannerController.SAFE_DETOUR_PRESET);
      setRoutingMode("safest");
      setUsingSafeDetour(true);
    } else {
      const hawksbill = EVARoutePlannerController.CORRIDOR_PRESETS[1];
      setWaypoints(hawksbill.waypoints);
      setUsingSafeDetour(false);
    }
  };

  const handleSearchSelect = (place: ScienceTargetFeature) => {
    setSelectedPlace(place);
    setSearchQuery(place.properties.name);
    setSearchFocused(false);
    setCameraRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      preset: {
        id: place.properties.id,
        label: place.properties.name,
        center: place.geometry.coordinates,
        zoom: place.properties.inJezeroGrid ? 12.6 : 4.2,
      },
    }));
  };

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_MARS_PLACES.slice(0, 6);
    return ALL_MARS_PLACES.filter(
      (p) =>
        p.properties.name.toLowerCase().includes(q) ||
        p.properties.category.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchQuery]);

  const handleExportEvaPlan = () => {
    const payload = {
      mission: "MARSWALK EXPLORER // JEZERO EVA PLAN",
      crs: "IAU_2015:49900",
      sol: telemetry.sol,
      lmst: telemetry.localMarsTime,
      mode: routingMode,
      totalDistanceKm: computedRoute.totalDistanceKm,
      estimatedWalkMinutes: computedRoute.walkMinutes,
      maxSlopeDeg: computedRoute.maxSlopeDeg,
      suitO2TripCostPct: lifeSupport.tripO2CostPct,
      suitO2ReturnMarginPct: lifeSupport.returnMarginPct,
      waypoints: computedRoute.nodes.map((n) => ({
        index: n.index,
        role: n.roleTag,
        label: n.label,
        lon: n.lon,
        lat: n.lat,
        elevationM: n.elevationM,
        slopeDeg: n.slopeDeg,
        cumulativeDistanceKm: n.cumulativeDistanceKm,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jezero_eva_plan_sol_${telemetry.sol}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedBanner("EVA Plan Exported (JSON)");
    window.setTimeout(() => setExportedBanner(null), 3000);
  };

  return (
    <div
      style={{
        backgroundColor: themeTokens.canvasBg,
        color: themeTokens.textPrimary,
      }}
      className="h-screen w-screen flex flex-col overflow-hidden select-none"
    >
      {/* SLIDE 01: MISSION BRIEFING WORKBENCH OVERLAY */}
      {showBriefingModal && (
        <MarsMissionBriefingView
          themeTokens={themeTokens}
          onEnterWorkbench={(tab) => {
            if (tab) handleSelectTab(tab);
            setShowBriefingModal(false);
          }}
          onToggleTheme={handleToggleTheme}
        />
      )}

      {/* ================= TOP DOCKED COMMAND BAR (h: 56px) ================= */}
      <header
        style={{
          backgroundColor: themeTokens.panelBg,
          borderColor: themeTokens.borderColor,
        }}
        className="h-[56px] w-full border-b flex items-center shrink-0 z-30"
      >
        {/* Left Brand Cell (360px) */}
        <button
          onClick={() => setShowBriefingModal(true)}
          style={{ borderColor: themeTokens.borderColor }}
          className="w-[360px] h-full border-r px-4 flex items-center gap-2.5 text-left shrink-0 cursor-pointer hover:opacity-90"
          title="Open Mission Briefing (Slide 01)"
        >
          <span className="w-[10px] h-[10px] bg-[#E86A33] rounded-[1px] inline-block shrink-0" />
          <span className="font-bold text-[14px] tracking-wider uppercase">
            MARSWALK
          </span>
          <span
            style={{ color: themeTokens.textMuted }}
            className="font-mono text-[10px] tracking-wider uppercase ml-0.5"
          >
            // JEZERO CRATER OPS
          </span>
        </button>

        {/* Search Input with Live Dropdown */}
        <div className="relative px-3 shrink-0">
          <div
            style={{
              backgroundColor: themeTokens.controlBg,
              borderColor: searchFocused ? "#E86A33" : themeTokens.borderColor,
            }}
            className="w-[332px] h-[36px] border rounded-[2px] px-3 flex items-center gap-2.5"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <circle
                cx="7"
                cy="7"
                r="5.2"
                stroke="#94A3B8"
                strokeWidth="1.6"
              />
              <line
                x1="11"
                y1="11"
                x2="14.5"
                y2="14.5"
                stroke="#94A3B8"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const found =
                    EVARoutePlannerController.findPlaceByQuery(searchQuery);
                  if (found) handleSearchSelect(found);
                }
              }}
              style={{ color: themeTokens.textPrimary }}
              className="bg-transparent text-[12px] font-medium flex-1 outline-none"
              placeholder="Search Mars landmarks / Jezero targets..."
            />
          </div>

          {searchFocused && filteredPlaces.length > 0 && (
            <div
              style={{
                backgroundColor: themeTokens.panelBg,
                borderColor: themeTokens.borderColor,
              }}
              className="absolute left-3 top-[42px] w-[332px] border rounded-[2px] shadow-2xl z-50 overflow-hidden"
            >
              {filteredPlaces.map((p) => (
                <button
                  key={p.properties.id}
                  onMouseDown={() => handleSearchSelect(p)}
                  style={{ borderColor: themeTokens.borderColor }}
                  className="w-full px-3 py-2 border-b last:border-b-0 text-left hover:bg-[#151922] flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs font-bold truncate">
                    {p.properties.name}
                  </span>
                  <span className="font-mono text-[10px] text-[#38BDF8] shrink-0 ml-2">
                    {p.properties.elevation_m}m
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center-Right: 5 Live Perseverance MEDA Telemetry Cells */}
        <div className="flex-1 h-full flex items-center justify-end">
          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] px-4 border-l flex flex-col justify-center"
          >
            <span
              style={{ color: themeTokens.textMuted }}
              className="font-mono text-[8.5px] uppercase tracking-wider leading-none"
            >
              SOL / LMST
            </span>
            <span className="font-mono text-[12px] font-bold leading-tight mt-1">
              SOL {telemetry.sol} · 13:24
            </span>
          </div>

          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] px-4 border-l flex flex-col justify-center"
          >
            <span
              style={{ color: themeTokens.textMuted }}
              className="font-mono text-[8.5px] uppercase tracking-wider leading-none"
            >
              TEMP
            </span>
            <span className="font-mono text-[12px] font-bold leading-tight mt-1">
              {telemetry.temperatureC.toFixed(1)}°C
            </span>
          </div>

          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] px-4 border-l flex flex-col justify-center"
          >
            <span
              style={{ color: themeTokens.textMuted }}
              className="font-mono text-[8.5px] uppercase tracking-wider leading-none"
            >
              WIND
            </span>
            <span
              style={{
                color:
                  scenario === "dust_storm"
                    ? "#F59E0B"
                    : themeTokens.textPrimary,
              }}
              className="font-mono text-[12px] font-bold leading-tight mt-1"
            >
              {telemetry.windSpeedMps.toFixed(1)} m/s
            </span>
          </div>

          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] px-4 border-l flex flex-col justify-center"
          >
            <span
              style={{ color: themeTokens.textMuted }}
              className="font-mono text-[8.5px] uppercase tracking-wider leading-none"
            >
              DUST TAU
            </span>
            <span
              style={{
                color: scenario === "dust_storm" ? "#EF4444" : "#22C55E",
              }}
              className="font-mono text-[12px] font-bold leading-tight mt-1"
            >
              {telemetry.dustOpacityTau.toFixed(2)}{" "}
              {scenario === "dust_storm" ? "HIGH" : "NOM"}
            </span>
          </div>

          <button
            onClick={() =>
              setScenario((prev) =>
                prev === "nominal" ? "solar_particle_event" : "nominal"
              )
            }
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] px-4 border-l flex flex-col justify-center text-left cursor-pointer hover:opacity-80"
            title="Click to simulate Solar Particle Event (Slide 05: EVA ABORT)"
          >
            <span
              style={{ color: themeTokens.textMuted }}
              className="font-mono text-[8.5px] uppercase tracking-wider leading-none"
            >
              RADIATION
            </span>
            <span
              style={{
                color:
                  scenario === "solar_particle_event" ? "#EF4444" : "#38BDF8",
              }}
              className="font-mono text-[12px] font-bold leading-tight mt-1"
            >
              {telemetry.radiationMsvDay.toFixed(2)} mSv/d
            </span>
          </button>

          {/* Right End: Emergency Badge (only on Abort) + Settings Gear Button */}
          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="h-[34px] pl-3 pr-3.5 border-l flex items-center gap-2.5"
          >
            {isEmergency && (
              <button
                onClick={() => setScenario("nominal")}
                className="h-[32px] px-3 bg-[#2A0E13] border border-[#EF4444] rounded-[2px] flex items-center gap-2 font-mono text-[11px] font-bold text-[#EF4444] cursor-pointer"
                title="Click to return to Nominal mode"
              >
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span>EVA: {telemetry.evaStatus}</span>
              </button>
            )}

            <button
              onClick={handleToggleTheme}
              style={{
                backgroundColor: themeTokens.controlBg,
                borderColor: themeTokens.borderColor,
              }}
              className="w-[36px] h-[36px] border rounded-[2px] flex items-center justify-center cursor-pointer hover:border-[#E86A33] transition-colors"
              title="Toggle Dark / Light Workbench Theme"
            >
              <svg
                width="17"
                height="17"
                viewBox="-1 -1 18.24 18.24"
                fill="none"
              >
                <path
                  d={COG_PATH}
                  stroke={isDark ? "#CBD5E1" : "#334155"}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle
                  cx="8.12"
                  cy="8.12"
                  r="2.4"
                  stroke={isDark ? "#CBD5E1" : "#334155"}
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ================= SLIDE 05: EMERGENCY TOP ALERT STRIP ================= */}
      {isEmergency && (
        <div className="h-[52px] w-full bg-[#240D11] border-b border-[#EF4444] px-5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span className="font-mono text-[12px] font-bold text-[#FCA5A5] tracking-wide">
              {scenario === "solar_particle_event"
                ? "SOLAR PARTICLE EVENT // RADIATION > 4.0 mSv/day — ABORT OPEN-TERRAIN EVA & RETURN TO HAB"
                : "REGIONAL DUST STORM // TAU > 2.5 — VISIBILITY REDUCED & RESTRICT EVA TO HABITAT"}
            </span>
          </div>
          <button
            onClick={() => setScenario("nominal")}
            className="h-[30px] px-3.5 bg-[#151922] border border-[#EF4444] rounded-[2px] font-mono text-[10.5px] font-bold text-[#F8FAFC] hover:bg-[#EF4444] hover:text-[#090B0F] cursor-pointer transition-colors"
          >
            Acknowledge Alert
          </button>
        </div>
      )}

      {/* ================= MAIN WORKBENCH BODY ================= */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* ================= LEFT DOCKED MISSION CONSOLE (w: 360px) ================= */}
        <aside
          style={{
            backgroundColor: themeTokens.panelBg,
            borderColor: themeTokens.borderColor,
          }}
          className="w-[360px] h-full border-r flex flex-col shrink-0 z-20 overflow-hidden"
        >
          {/* Console Tab Strip */}
          <div
            style={{
              backgroundColor: themeTokens.subHeaderBg,
              borderColor: themeTokens.borderColor,
            }}
            className="h-[40px] w-full border-b grid grid-cols-3 shrink-0"
          >
            {(
              [
                {
                  id: "overview",
                  label: isEmergency ? "Contingency" : "Overview",
                },
                { id: "route", label: "Route" },
                { id: "science", label: "Science" },
              ] as const
            ).map((tab) => {
              const isActive =
                (isEmergency && tab.id === "overview") ||
                (!isEmergency && activeTab === tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isEmergency && tab.id !== "overview") {
                      setScenario("nominal");
                    }
                    handleSelectTab(tab.id);
                  }}
                  style={{
                    color: isActive
                      ? themeTokens.textPrimary
                      : themeTokens.textSecondary,
                  }}
                  className="relative h-full font-bold text-[12px] tracking-wide cursor-pointer transition-colors flex items-center justify-center"
                >
                  {tab.label}
                  {isActive && (
                    <span
                      style={{
                        backgroundColor: isEmergency ? "#EF4444" : "#E86A33",
                      }}
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pinned Suit O2 Reserve (Life Support) Fuel Gauge */}
          <div
            style={{
              backgroundColor: themeTokens.panelBg,
              borderColor: themeTokens.borderColor,
            }}
            className="px-4 py-3.5 border-b shrink-0 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span
                style={{ color: themeTokens.textSecondary }}
                className="font-mono text-[10px] font-bold uppercase tracking-wider"
              >
                SUIT O2 RESERVE (LIFE SUPPORT)
              </span>
              <span className="font-mono text-[13px] font-bold text-[#38BDF8]">
                {lifeSupport.headerReserveText}
              </span>
            </div>

            <div
              style={{
                backgroundColor: themeTokens.controlBg,
                borderColor: themeTokens.borderColor,
              }}
              className="h-[14px] w-full border rounded-[2px] overflow-hidden flex"
            >
              <div
                style={{ width: `${lifeSupport.cyanWidthPct}%` }}
                className="h-full bg-[#38BDF8] transition-all duration-300"
              />
              <div
                style={{ width: `${lifeSupport.orangeWidthPct}%` }}
                className="h-full bg-[#F59E0B] transition-all duration-300"
              />
            </div>

            <div
              style={{ color: themeTokens.textMuted }}
              className="flex items-center justify-between font-mono text-[8.5px]"
            >
              <span>E (0%)</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>F (100%)</span>
            </div>

            <div
              style={{ color: isDark ? "#CBD5E1" : "#334155" }}
              className="font-mono text-[10px] pt-0.5"
            >
              {lifeSupport.footerLeftText} &nbsp;|&nbsp;{" "}
              {lifeSupport.footerRightText}
            </div>
          </div>

          {/* ================= CONSOLE BODY ================= */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col justify-between space-y-3">
            {isEmergency ? (
              /* ================= SCREEN 05: CONTINGENCY ================= */
              <>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "nominal", label: "Nominal" },
                        { id: "dust_storm", label: "Dust Storm" },
                        { id: "solar_particle_event", label: "Solar Event" },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setScenario(s.id)}
                        style={{
                          backgroundColor:
                            scenario === s.id
                              ? "#EF4444"
                              : themeTokens.controlBg,
                          borderColor:
                            scenario === s.id
                              ? "#EF4444"
                              : themeTokens.borderColor,
                          color:
                            scenario === s.id
                              ? "#090B0F"
                              : themeTokens.textSecondary,
                        }}
                        className="h-[30px] border rounded-[2px] font-bold text-[11px] cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="font-mono text-[9.5px] font-bold text-[#EF4444] uppercase tracking-wider">
                      CRITICAL THRESHOLD EXCEEDED
                    </div>
                    <h2 className="text-[18px] font-bold mt-0.5">
                      ABORT OPEN-TERRAIN EVA
                    </h2>
                  </div>

                  <div
                    style={{
                      backgroundColor: themeTokens.cardBg,
                      borderColor: themeTokens.borderColor,
                    }}
                    className="p-3 border rounded-[2px] space-y-2 font-mono text-[10.5px]"
                  >
                    <div className="flex justify-between">
                      <span style={{ color: themeTokens.textSecondary }}>
                        RADIATION DOSE
                      </span>
                      <span className="font-bold text-[#EF4444]">
                        {telemetry.radiationMsvDay.toFixed(2)} mSv/day
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: themeTokens.textSecondary }}>
                        SAFE RANGE
                      </span>
                      <span className="font-bold text-[#EF4444]">
                        {telemetry.maxSafeRangeM} m (LOCKED)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: themeTokens.textSecondary }}>
                        ORBITER RELAY
                      </span>
                      <span className="font-bold text-[#38BDF8]">
                        {telemetry.orbiterRelay}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: themeTokens.cardBg,
                      borderColor: "#22C55E",
                    }}
                    className="p-3 border rounded-[2px] space-y-1"
                  >
                    <div className="font-mono text-[9px] font-bold text-[#22C55E] uppercase">
                      SHORTEST SHIELDED RETURN PATH
                    </div>
                    <div className="font-bold text-[13px]">
                      Delta Field -&gt; Octavia Hab Airlock
                    </div>
                    <div className="font-mono text-[10.5px] text-[#22C55E] font-bold">
                      {computedRoute.totalDistanceKm.toFixed(2)} km ·{" "}
                      {computedRoute.walkMinutes} min · -
                      {lifeSupport.tripO2CostPct}% O2 · Max{" "}
                      {computedRoute.maxSlopeDeg.toFixed(1)}°
                    </div>
                  </div>

                  <div className="p-3 bg-[#240D11] border border-[#EF4444] rounded-[2px]">
                    <div className="font-mono text-[9px] font-bold text-[#FCA5A5] uppercase">
                      EMERGENCY DISPATCH STATUS
                    </div>
                    <div className="font-mono text-[12.5px] font-bold text-[#EF4444] mt-0.5">
                      ✕ ABORT · RETURN TO HAB AIRLOCK
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Return Ascent
                      </div>
                      <div className="font-mono text-[14px] font-bold mt-1">
                        +{computedRoute.totalAscentM} m
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Max Return Slope
                      </div>
                      <div className="font-mono text-[14px] font-bold text-[#22C55E] mt-1">
                        {computedRoute.maxSlopeDeg.toFixed(1)}°
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExportEvaPlan}
                  className="w-full h-[42px] rounded-[2px] bg-[#EF4444] hover:bg-[#dc2626] text-[#090B0F] font-bold text-[12px] cursor-pointer transition-colors shrink-0"
                >
                  Lock Emergency Return Route -&gt;
                </button>
              </>
            ) : activeTab === "overview" ? (
              /* ================= SCREEN 02: OVERVIEW TAB ================= */
              <>
                <div className="space-y-3">
                  <div>
                    <div className="font-mono text-[9.5px] font-bold text-[#E86A33] uppercase tracking-wider">
                      HABITAT AIRLOCK // STAGING POINT
                    </div>
                    <h2 className="text-[19px] font-bold mt-0.5 leading-tight">
                      Octavia E. Butler Hab Base
                    </h2>
                    <div
                      style={{ color: themeTokens.textSecondary }}
                      className="font-mono text-[10.5px] mt-0.5"
                    >
                      18.4446 N, 77.4509 E · Jezero Crater
                    </div>
                  </div>

                  {/* EVA DISPATCH STATUS */}
                  <div className="px-3.5 py-2.5 bg-[#0D231A] border border-[#22C55E] rounded-[2px]">
                    <div className="font-mono text-[9px] font-bold text-[#86EFAC] uppercase tracking-wider">
                      EVA DISPATCH STATUS
                    </div>
                    <div className="font-mono text-[13.5px] font-bold text-[#22C55E] mt-0.5">
                      ✓ SAFE · CLEAR FOR DEPLOYMENT
                    </div>
                  </div>

                  {/* 3x2 Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Jarak Tempuh (Aktif)
                      </div>
                      <div className="font-mono text-[15px] font-bold mt-1">
                        {computedRoute.totalDistanceKm.toFixed(2)} km
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Elevasi &amp; Lereng Max
                      </div>
                      <div
                        style={{
                          color:
                            computedRoute.maxSlopeDeg > 15
                              ? "#EF4444"
                              : computedRoute.maxSlopeDeg >= 10
                                ? "#F59E0B"
                                : "#22C55E",
                        }}
                        className="font-mono text-[14px] font-bold mt-1"
                      >
                        {computedRoute.targetElevationM.toLocaleString("en-US")}m ·{" "}
                        {computedRoute.maxSlopeDeg.toFixed(1)}°
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Sun Angle (Az / El)
                      </div>
                      <div className="font-mono text-[13.5px] font-bold text-[#F59E0B] mt-1">
                        {currentSun.azimuthDeg}°AZ / +
                        {Math.abs(currentSun.elevationDeg)}°EL
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Est. Walk Time / O2
                      </div>
                      <div className="font-mono text-[13.5px] font-bold text-[#38BDF8] mt-1">
                        {computedRoute.walkMinutes} min · -
                        {lifeSupport.tripO2CostPct}%
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px] flex items-center justify-between"
                    >
                      <div>
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Suit Battery Status
                        </div>
                        <div className="font-mono text-[15px] font-bold mt-1">
                          {lifeSupport.batteryPct}%
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-0.5 bg-[#22C55E]" />
                        <div className="w-3.5 h-5 border border-[#22C55E] p-0.5 flex items-end">
                          <div className="w-full h-full bg-[#22C55E]" />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px] flex items-center justify-between"
                    >
                      <div>
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Communications Link
                        </div>
                        <div className="font-mono text-[14.5px] font-bold mt-1">
                          HGA NOM
                        </div>
                      </div>
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 h-1.5 bg-[#22C55E]" />
                        <span className="w-1 h-2.5 bg-[#22C55E]" />
                        <span className="w-1 h-3.5 bg-[#22C55E]" />
                        <span className="w-1 h-4 bg-[#22C55E]" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Multi-Point EVA Corridors (Real Terrain Math) */}
                  <div className="space-y-2 pt-1">
                    <div
                      style={{ color: themeTokens.textSecondary }}
                      className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
                    >
                      QUICK MULTI-POINT EVA CORRIDORS (O2 + SLOPE)
                    </div>

                    {presetModels.map(({ preset, model, o2 }) => {
                      const isSel = activeCorridorId === preset.id;
                      const badgeCol =
                        model.maxSlopeDeg > 15
                          ? "#EF4444"
                          : model.maxSlopeDeg >= 10
                            ? "#F59E0B"
                            : "#22C55E";
                      const badgeText = isSel
                        ? `ACTIVE · ${model.overallRisk === "safe" ? "SAFE" : `${model.maxSlopeDeg}°`}`
                        : model.overallRisk === "safe"
                          ? `SAFE ${model.maxSlopeDeg}°`
                          : `CAUTION ${model.maxSlopeDeg}°`;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectCorridorPreset(preset.id)}
                          style={{
                            backgroundColor: isSel
                              ? isDark
                                ? "#0F1918"
                                : "#F0FDF4"
                              : themeTokens.cardBg,
                            borderColor: isSel
                              ? "#22C55E"
                              : themeTokens.borderColor,
                          }}
                          className="w-full p-2.5 border rounded-[2px] text-left cursor-pointer hover:border-[#22C55E] transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[12px]">
                              {preset.title}
                            </span>
                            <span
                              style={{ color: badgeCol }}
                              className="font-mono text-[9.5px] font-bold"
                            >
                              {badgeText}
                            </span>
                          </div>
                          <div
                            style={{ color: themeTokens.textSecondary }}
                            className="font-mono text-[10px]"
                          >
                            {model.totalDistanceKm.toFixed(2)} km ·{" "}
                            {model.walkMinutes} min · -{o2.tripO2CostPct}% O2 ·
                            Peak {model.maxSlopeDeg.toFixed(1)}°
                          </div>
                          <div className="font-mono text-[10px] text-[#38BDF8]">
                            Return Margin: {o2.returnMarginPct}% O2 · Click to
                            load on map
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectTab("route")}
                  className="w-full h-[42px] rounded-[2px] bg-[#E86A33] hover:bg-[#f0753e] text-[#090B0F] font-bold text-[12px] cursor-pointer transition-colors shrink-0"
                >
                  Plan EVA Route From Here -&gt;
                </button>
              </>
            ) : activeTab === "route" ? (
              /* ================= SCREEN 03: INTERACTIVE ROUTE TAB (Start -> Second -> End) ================= */
              <>
                <div className="space-y-3">
                  {/* Interactive Start / Second / End Waypoint Path Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        style={{ color: themeTokens.textSecondary }}
                        className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
                      >
                        WAYPOINT PATH ({waypoints.length} PTS · CLICK MAP)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleUndoLastWaypoint}
                          disabled={waypoints.length === 0}
                          className="font-mono text-[9.5px] font-bold text-[#94A3B8] hover:text-white disabled:opacity-40 cursor-pointer"
                          title="Undo last waypoint"
                        >
                          Undo
                        </button>
                        <button
                          onClick={handleStartFreshRoute}
                          className="font-mono text-[9.5px] font-bold text-[#38BDF8] hover:underline cursor-pointer"
                          title="Clear all points and click Start -> Second -> End on map"
                        >
                          Clear / New (1→2→End)
                        </button>
                      </div>
                    </div>

                    {/* Next Click Status Strip */}
                    <button
                      onClick={() => setIsMarkingMode((m) => !m)}
                      style={{
                        backgroundColor: isMarkingMode
                          ? isDark
                            ? "#1F140F"
                            : "#FFF7ED"
                          : themeTokens.controlBg,
                        borderColor: isMarkingMode
                          ? "#E86A33"
                          : themeTokens.borderColor,
                      }}
                      className="w-full px-2.5 py-1.5 border rounded-[2px] flex items-center justify-between font-mono text-[10px] font-bold cursor-pointer"
                    >
                      <span
                        style={{
                          color: isMarkingMode
                            ? "#E86A33"
                            : themeTokens.textSecondary,
                        }}
                      >
                        {isMarkingMode
                          ? waypoints.length === 0
                            ? "● CLICK MAP: Mark 1 (Start Point)"
                            : waypoints.length === 1
                              ? "● CLICK MAP: Mark 2 (Second Point)"
                              : `● CLICK MAP: Mark ${waypoints.length + 1} (End Point)`
                          : "Click here to mark Start -> 2nd -> End on map"}
                      </span>
                      <span className="text-[#38BDF8]">
                        {isMarkingMode ? "ON" : "OFF"}
                      </span>
                    </button>

                    {/* Waypoints List (1 = Start, 2 = Second, 3+ = End) */}
                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px] space-y-2"
                    >
                      {computedRoute.nodes.length === 0 ? (
                        <div
                          style={{ color: themeTokens.textMuted }}
                          className="py-3 text-center font-mono text-[10.5px]"
                        >
                          0 points selected. Click anywhere on the map to set{" "}
                          <strong className="text-[#22C55E]">1 (Start)</strong>,{" "}
                          <strong className="text-[#F59E0B]">2 (Second)</strong>
                          , and{" "}
                          <strong className="text-[#38BDF8]">3+ (End)</strong>.
                        </div>
                      ) : (
                        computedRoute.nodes.map((wp, idx) => (
                          <div
                            key={wp.id}
                            className="flex items-center justify-between text-[11.5px] gap-1.5"
                          >
                            <button
                              onClick={() =>
                                setCameraRequest((prev) => ({
                                  seq: (prev?.seq ?? 0) + 1,
                                  preset: {
                                    id: wp.id,
                                    label: wp.label,
                                    center: [wp.lon, wp.lat],
                                    zoom: 12.8,
                                  },
                                }))
                              }
                              className="flex items-center gap-2 min-w-0 text-left cursor-pointer hover:opacity-80"
                              title={`Center map on ${wp.label} (${wp.lat.toFixed(4)}°N, ${wp.lon.toFixed(4)}°E)`}
                            >
                              <span
                                style={{ backgroundColor: wp.badgeColor }}
                                className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-[#090B0F] shrink-0"
                              >
                                {wp.index}
                              </span>
                              <span className="font-bold truncate">
                                {wp.label}
                              </span>
                              <span className="font-mono text-[9px] px-1 py-0.2 bg-[#151922] border border-[#252B37] rounded-[1px] text-[#94A3B8] shrink-0">
                                {wp.roleTag}
                              </span>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                style={{ color: wp.metaColor }}
                                className="font-mono text-[10px] font-bold"
                              >
                                {idx === 0
                                  ? "0.00 km · Start"
                                  : `${wp.cumulativeDistanceKm.toFixed(2)} km · ${wp.slopeDeg.toFixed(1)}°`}
                              </span>
                              <button
                                onClick={() =>
                                  setWaypoints((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-[#64748B] hover:text-[#EF4444] font-mono text-xs cursor-pointer pl-1"
                                title="Remove waypoint"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* A* Routing Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {EVARoutePlannerController.getPlannerModes().map((m) => {
                      const isSel = routingMode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setRoutingMode(m.id)}
                          style={{
                            backgroundColor: isSel
                              ? "#E86A33"
                              : themeTokens.controlBg,
                            borderColor: isSel
                              ? "#E86A33"
                              : themeTokens.borderColor,
                            color: isSel
                              ? "#090B0F"
                              : themeTokens.textSecondary,
                          }}
                          className="h-[30px] border rounded-[2px] font-bold text-[11px] cursor-pointer transition-colors"
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* SLOPE ALERT LIMIT Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[9.5px] font-bold">
                      <span style={{ color: themeTokens.textSecondary }}>
                        SLOPE ALERT LIMIT
                      </span>
                      <span className="text-[#F59E0B]">
                        {maxSlopeLimit.toFixed(1)}° MAX
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={22}
                      step={0.5}
                      value={maxSlopeLimit}
                      onChange={(e) => setMaxSlopeLimit(Number(e.target.value))}
                      className="w-full accent-[#E86A33] cursor-pointer h-1.5"
                    />
                  </div>

                  {/* ROUTE SUMMARY */}
                  <div
                    style={{
                      backgroundColor: themeTokens.cardBg,
                      borderColor: themeTokens.borderColor,
                    }}
                    className="p-3 border rounded-[2px] space-y-2"
                  >
                    <div className="font-mono text-[9.5px] font-bold text-[#E86A33] uppercase tracking-wider">
                      ROUTE SUMMARY · {computedRoute.nodes.length} WAYPOINTS
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div
                          style={{ color: themeTokens.textMuted }}
                          className="font-mono text-[8.5px] uppercase"
                        >
                          DISTANCE
                        </div>
                        <div className="font-mono text-[20px] font-bold leading-tight mt-0.5">
                          {computedRoute.totalDistanceKm.toFixed(2)} km
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ color: themeTokens.textMuted }}
                          className="font-mono text-[8.5px] uppercase"
                        >
                          EST. WALK TIME
                        </div>
                        <div className="font-mono text-[20px] font-bold leading-tight mt-0.5">
                          {computedRoute.walkMinutes} min
                        </div>
                      </div>
                    </div>

                    <div className="h-[8px] w-full rounded-[1px] overflow-hidden flex bg-[#090B0F]">
                      <div
                        style={{
                          width: `${computedRoute.slopeDistribution.safePct}%`,
                        }}
                        className="h-full bg-[#22C55E]"
                      />
                      <div
                        style={{
                          width: `${computedRoute.slopeDistribution.cautionPct}%`,
                        }}
                        className="h-full bg-[#F59E0B]"
                      />
                      <div
                        style={{
                          width: `${computedRoute.slopeDistribution.hazardPct}%`,
                        }}
                        className="h-full bg-[#EF4444]"
                      />
                    </div>

                    <div
                      style={{ color: themeTokens.textSecondary }}
                      className="font-mono text-[9.5px]"
                    >
                      {computedRoute.slopeDistribution.safePct}% &lt;10° Safe
                      &nbsp;·&nbsp; {computedRoute.slopeDistribution.cautionPct}
                      % Steep &nbsp;·&nbsp;{" "}
                      {computedRoute.slopeDistribution.hazardPct}% &gt;15° Red
                    </div>
                  </div>

                  {/* ROUTE STATUS */}
                  <div
                    style={{
                      backgroundColor:
                        computedRoute.overallRisk === "hazard"
                          ? "#240D11"
                          : computedRoute.overallRisk === "caution"
                            ? "#1F180D"
                            : "#0D231A",
                      borderColor:
                        computedRoute.overallRisk === "hazard"
                          ? "#EF4444"
                          : computedRoute.overallRisk === "caution"
                            ? "#F59E0B"
                            : "#22C55E",
                    }}
                    className="px-3 py-2.5 border rounded-[2px]"
                  >
                    <div
                      style={{
                        color:
                          computedRoute.overallRisk === "hazard"
                            ? "#FCA5A5"
                            : computedRoute.overallRisk === "caution"
                              ? "#F59E0B"
                              : "#86EFAC",
                      }}
                      className="font-mono text-[9px] font-bold uppercase tracking-wider"
                    >
                      ROUTE STATUS
                    </div>
                    <div
                      style={{
                        color:
                          computedRoute.overallRisk === "hazard"
                            ? "#EF4444"
                            : computedRoute.overallRisk === "caution"
                              ? "#F59E0B"
                              : "#22C55E",
                      }}
                      className="font-mono text-[11.5px] font-bold mt-0.5"
                    >
                      {computedRoute.nodes.length < 2
                        ? "MARK AT LEAST 2 POINTS ON MAP"
                        : computedRoute.overallRisk === "hazard"
                          ? `⚠ CAUTION · ${computedRoute.maxSlopeDeg.toFixed(1)}° RED AT ${computedRoute.peakSlopeDistanceKm.toFixed(2)} km`
                          : computedRoute.overallRisk === "caution"
                            ? `⚠ CAUTION · ${computedRoute.maxSlopeDeg.toFixed(1)}° STEEP AT ${computedRoute.peakSlopeDistanceKm.toFixed(2)} km`
                            : `✓ SAFE · MAX SLOPE ${computedRoute.maxSlopeDeg.toFixed(1)}° (<10°)`}
                    </div>
                  </div>

                  {/* 2x2 Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Target EVA Elevation
                      </div>
                      <div className="font-mono text-[14.5px] font-bold mt-1">
                        {computedRoute.targetElevationM.toLocaleString("en-US")} m
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px]"
                    >
                      <div
                        style={{ color: themeTokens.textSecondary }}
                        className="text-[10px]"
                      >
                        Max Slope Encountered
                      </div>
                      <div
                        style={{
                          color:
                            computedRoute.maxSlopeDeg > 15
                              ? "#EF4444"
                              : computedRoute.maxSlopeDeg >= 10
                                ? "#F59E0B"
                                : "#22C55E",
                        }}
                        className="font-mono text-[14.5px] font-bold mt-1"
                      >
                        {computedRoute.maxSlopeDeg.toFixed(1)}°{" "}
                        {computedRoute.maxSlopeDeg > 15
                          ? "RED"
                          : computedRoute.maxSlopeDeg >= 10
                            ? "STEEP"
                            : "SAFE"}
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px] flex items-center justify-between"
                    >
                      <div>
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Suit Battery Status
                        </div>
                        <div className="font-mono text-[14.5px] font-bold mt-1">
                          {lifeSupport.batteryPct}%
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-0.5 bg-[#22C55E]" />
                        <div className="w-3.5 h-5 border border-[#22C55E] p-0.5 flex items-end">
                          <div className="w-full h-4 bg-[#22C55E]" />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: themeTokens.cardBg,
                        borderColor: themeTokens.borderColor,
                      }}
                      className="p-2.5 border rounded-[2px] flex items-center justify-between"
                    >
                      <div>
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Communications Link
                        </div>
                        <div className="font-mono text-[14px] font-bold mt-1">
                          HGA NOM
                        </div>
                      </div>
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 h-1.5 bg-[#22C55E]" />
                        <span className="w-1 h-2.5 bg-[#22C55E]" />
                        <span className="w-1 h-3.5 bg-[#22C55E]" />
                        <span className="w-1 h-4 bg-[#22C55E]" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleSafeDetour}
                    style={{
                      backgroundColor: themeTokens.controlBg,
                      borderColor: usingSafeDetour
                        ? "#22C55E"
                        : themeTokens.borderColor,
                      color: usingSafeDetour
                        ? "#22C55E"
                        : themeTokens.textPrimary,
                    }}
                    className="w-full h-[34px] border rounded-[2px] font-mono text-[10px] font-bold uppercase tracking-wider hover:border-[#22C55E] cursor-pointer transition-colors"
                  >
                    {usingSafeDetour
                      ? "✓ ACTIVE: SAFE NORTHERN DETOUR"
                      : "VIEW ALTERNATE SAFE DETOUR"}
                  </button>
                </div>

                <button
                  onClick={handleExportEvaPlan}
                  className="w-full h-[42px] rounded-[2px] bg-[#E86A33] hover:bg-[#f0753e] text-[#090B0F] font-bold text-[12px] cursor-pointer transition-colors shrink-0"
                >
                  Confirm &amp; Export EVA Plan -&gt;
                </button>
              </>
            ) : (
              /* ================= SCREEN 04: SCIENCE TAB ================= */
              <>
                <div className="space-y-3">
                  <div>
                    <div className="font-mono text-[9.5px] font-bold text-[#38BDF8] uppercase tracking-wider">
                      ASTROBIOLOGY TARGET // SCORE{" "}
                      {selectedPlace.properties.science_score} / 100
                    </div>
                    <h2 className="text-[19px] font-bold mt-0.5 leading-tight">
                      {selectedPlace.properties.name}
                    </h2>
                    <div
                      style={{ color: themeTokens.textSecondary }}
                      className="font-mono text-[10.5px] mt-0.5"
                    >
                      {selectedPlace.geometry.coordinates[1].toFixed(4)} N,{" "}
                      {selectedPlace.geometry.coordinates[0].toFixed(4)} E ·
                      Elev{" "}
                      {selectedPlace.properties.elevation_m.toLocaleString("en-US")} m
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: isDark ? "#0D1924" : "#F0F9FF",
                      borderColor: "#38BDF8",
                    }}
                    className="p-3 border rounded-[2px]"
                  >
                    <div className="font-mono text-[9px] font-bold text-[#38BDF8] uppercase tracking-wider">
                      MINERAL SIGNATURE (CRISM / SHERLOC)
                    </div>
                    <div className="font-bold text-[13px] mt-1">
                      {selectedPlace.properties.mineral_signature}
                    </div>
                  </div>

                  <p
                    style={{ color: isDark ? "#CBD5E1" : "#334155" }}
                    className="text-[11.5px] leading-relaxed"
                  >
                    {selectedPlace.properties.summary}
                  </p>

                  <div className="space-y-2 pt-1">
                    <div
                      style={{ color: themeTokens.textSecondary }}
                      className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
                    >
                      OTHER JEZERO SCIENCE TARGETS
                    </div>

                    {EVARoutePlannerController.getAllScienceTargets()
                      .filter((f) => f.properties.id !== "hab-octavia")
                      .slice(0, 3)
                      .map((feat) => (
                        <button
                          key={feat.properties.id}
                          onClick={() => handleSearchSelect(feat)}
                          style={{
                            backgroundColor: themeTokens.cardBg,
                            borderColor:
                              selectedPlace.properties.id === feat.properties.id
                                ? "#38BDF8"
                                : themeTokens.borderColor,
                          }}
                          className="w-full p-2.5 border rounded-[2px] text-left cursor-pointer hover:border-[#38BDF8] transition-colors"
                        >
                          <div className="font-bold text-[12px]">
                            {feat.properties.name}
                          </div>
                          <div
                            style={{ color: themeTokens.textSecondary }}
                            className="font-mono text-[10px] mt-0.5"
                          >
                            Score {feat.properties.science_score} ·{" "}
                            {feat.properties.elevation_m.toLocaleString("en-US")} m ·{" "}
                            {feat.properties.category}
                          </div>
                        </button>
                      ))}
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="font-mono text-[9.5px] font-bold text-[#E86A33] uppercase tracking-wider">
                      TARGET APPROACH TELEMETRY ({computedRoute.nodes.length}{" "}
                      PTS)
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div
                        style={{
                          backgroundColor: themeTokens.cardBg,
                          borderColor: themeTokens.borderColor,
                        }}
                        className="p-2.5 border rounded-[2px]"
                      >
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Target EVA Elevation
                        </div>
                        <div className="font-mono text-[14.5px] font-bold mt-1">
                          {selectedPlace.properties.elevation_m.toLocaleString("en-US")}{" "}
                          m
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: themeTokens.cardBg,
                          borderColor: themeTokens.borderColor,
                        }}
                        className="p-2.5 border rounded-[2px]"
                      >
                        <div
                          style={{ color: themeTokens.textSecondary }}
                          className="text-[10px]"
                        >
                          Approach Max Slope
                        </div>
                        <div
                          style={{
                            color:
                              computedRoute.maxSlopeDeg > 15
                                ? "#EF4444"
                                : "#22C55E",
                          }}
                          className="font-mono text-[14.5px] font-bold mt-1"
                        >
                          {computedRoute.maxSlopeDeg.toFixed(1)}°
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // Automatically set route from Hab Airlock -> Midpoint -> Selected Science Target
                    setWaypoints([
                      {
                        id: "hab-start",
                        label: "Octavia Hab Base",
                        lon: 77.4509,
                        lat: 18.4446,
                      },
                      {
                        id: `target-${selectedPlace.properties.id}`,
                        label: selectedPlace.properties.name,
                        lon: selectedPlace.geometry.coordinates[0],
                        lat: selectedPlace.geometry.coordinates[1],
                      },
                    ]);
                    handleSelectTab("route");
                  }}
                  className="w-full h-[42px] rounded-[2px] bg-[#E86A33] hover:bg-[#f0753e] text-[#090B0F] font-bold text-[12px] cursor-pointer transition-colors shrink-0"
                >
                  Plan EVA Route to Target -&gt;
                </button>
              </>
            )}
          </div>
        </aside>

        {/* ================= RIGHT MAIN COLUMN ================= */}
        <div className="relative flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          {exportedBanner && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-[#0D231A] border border-[#22C55E] rounded-[2px] font-mono text-xs font-bold text-[#22C55E] shadow-xl">
              ✓ {exportedBanner}
            </div>
          )}

          {/* Real Interactive OpenLayers Viewport */}
          <div className="relative flex-1 min-h-0 w-full flex flex-col">
            <MarsBingMapViewport
              layerStates={layerStates}
              selectedPlace={selectedPlace}
              waypointNodes={computedRoute.nodes}
              routeSegments={computedRoute.segments}
              isMarkingMode={isMarkingMode && !isEmergency}
              nextWaypointPrompt={nextWaypointPrompt}
              onMapClickCoordinate={handleMapClickCoordinate}
              onSelectPlace={(place) => {
                setSelectedPlace(place);
                handleSelectTab("science");
              }}
              telemetry={telemetry}
              cameraRequest={cameraRequest}
              zoomSignal={zoomSignal}
              hoverProfileCoord={hoverProfileCoord}
              themeTokens={themeTokens}
              activeTab={activeTab}
              bottomProfilerOpen={
                (activeTab === "route" || showBottomProfiler) && !isEmergency
              }
            />

            {/* ================= FLOATING NASA TREK BASEMAPS SWITCHER ================= */}
            {showBasemapPanel && (
              <div
                style={{
                  backgroundColor: themeTokens.panelBg,
                  borderColor: themeTokens.borderColor,
                }}
                className="absolute top-3 right-[68px] z-20 w-[332px] border rounded-[2px] shadow-2xl overflow-hidden"
              >
                <div
                  style={{
                    backgroundColor: themeTokens.subHeaderBg,
                    borderColor: themeTokens.borderColor,
                  }}
                  className="h-[40px] px-4 border-b flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] font-bold tracking-wider uppercase">
                    NASA TREK BASEMAPS
                  </span>
                  <button
                    onClick={() => setShowBasemapPanel(false)}
                    style={{ color: themeTokens.textSecondary }}
                    className="font-mono text-[14px] font-bold hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <div className="p-3.5 space-y-3">
                  {basemapRegistry.getAllBasemaps().map((bm) => {
                    const isActive = bm.id === activeBasemapId;
                    return (
                      <button
                        key={bm.id}
                        onClick={() => setActiveBasemapId(bm.id)}
                        style={{
                          backgroundColor: isActive
                            ? isDark
                              ? "#1C1411"
                              : "#FFF7ED"
                            : themeTokens.cardBg,
                          borderColor: isActive
                            ? "#E86A33"
                            : themeTokens.borderColor,
                        }}
                        className="w-full h-[78px] p-1.5 border rounded-[2px] flex items-center gap-3.5 text-left cursor-pointer hover:border-[#E86A33] transition-colors"
                      >
                        <img
                          src={bm.thumbnailUrl}
                          alt={bm.title}
                          className="w-[88px] h-[64px] object-cover rounded-[1px] shrink-0"
                        />

                        <div className="min-w-0 flex-1 pr-1">
                          <div className="font-bold text-[12.5px] truncate">
                            {bm.title}
                          </div>
                          <div
                            style={{
                              color: isActive
                                ? "#E86A33"
                                : themeTokens.textSecondary,
                            }}
                            className="font-mono text-[10px] font-bold mt-1"
                          >
                            {isActive ? bm.activeSubtitle : bm.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= TOP-RIGHT MAP TOOL STRIP (44x224) ================= */}
            <div
              style={{
                backgroundColor: themeTokens.panelBg,
                borderColor: themeTokens.borderColor,
              }}
              className="absolute top-3 right-3 z-20 w-[44px] h-[224px] border rounded-[2px] flex flex-col"
            >
              {/* 1. Basemap Layers Toggle */}
              <button
                onClick={() => setShowBasemapPanel((prev) => !prev)}
                style={{ borderColor: themeTokens.borderColor }}
                className="h-[44px] w-full border-b flex items-center justify-center cursor-pointer hover:bg-[#151922]"
                title="Toggle NASA Trek Basemaps"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M 8 0 L 16 4 L 8 8 L 0 4 Z"
                    stroke={showBasemapPanel ? "#E86A33" : "#E2E8F0"}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 0 7 L 8 11 L 16 7 M 0 11 L 8 15 L 16 11"
                    stroke={showBasemapPanel ? "#E86A33" : "#94A3B8"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* 2. Draw / Mark Start -> 2nd -> End Waypoints & Split Profiler Toggle */}
              <button
                onClick={() => {
                  const next = !isMarkingMode;
                  setIsMarkingMode(next);
                  setShowBottomProfiler(true);
                  if (next) setActiveTab("route");
                }}
                style={{ borderColor: themeTokens.borderColor }}
                className="h-[44px] w-full border-b flex items-center justify-center cursor-pointer hover:bg-[#151922]"
                title="Mark Waypoints on Map (Start -> 2nd -> End) & Split Profiler"
              >
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                  <path
                    d="M 0 12 L 5 3 L 11 8 L 16 0"
                    stroke={isMarkingMode ? "#38BDF8" : "#E2E8F0"}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* 3. Real OpenLayers Zoom In */}
              <button
                onClick={() =>
                  setZoomSignal((z) => ({
                    delta: 0.9,
                    seq: (z?.seq ?? 0) + 1,
                  }))
                }
                style={{ borderColor: themeTokens.borderColor }}
                className="h-[44px] w-full border-b flex items-center justify-center font-mono text-[18px] font-bold cursor-pointer hover:bg-[#151922]"
                title="Zoom In"
              >
                +
              </button>

              {/* 4. Real OpenLayers Zoom Out */}
              <button
                onClick={() =>
                  setZoomSignal((z) => ({
                    delta: -0.9,
                    seq: (z?.seq ?? 0) + 1,
                  }))
                }
                style={{ borderColor: themeTokens.borderColor }}
                className="h-[44px] w-full border-b flex items-center justify-center font-mono text-[18px] font-bold cursor-pointer hover:bg-[#151922]"
                title="Zoom Out"
              >
                -
              </button>

              {/* 5. Center on Jezero Crater */}
              <button
                onClick={() =>
                  setCameraRequest((prev) => ({
                    seq: (prev?.seq ?? 0) + 1,
                    preset: {
                      id: "jezero_center",
                      label: "Jezero Crater",
                      center: [77.425, 18.45],
                      zoom: 12.2,
                    },
                  }))
                }
                className="flex-1 w-full flex items-center justify-center cursor-pointer hover:bg-[#151922]"
                title="Center on Jezero Crater (North Up)"
              >
                <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
                  <path d="M 5 0 L 10 8 L 5 6 L 0 8 Z" fill="#E86A33" />
                  <path d="M 0 9 L 5 11 L 10 9 L 5 17 Z" fill="#64748B" />
                </svg>
              </button>
            </div>
          </div>

          {/* ================= BOTTOM DOCKED 50/50 SPLIT PROFILER ================= */}
          {(activeTab === "route" || showBottomProfiler) && !isEmergency && (
            <MarsSplitBottomProfiler
              route={computedRoute}
              sunSamples={sunSamples}
              themeTokens={themeTokens}
              onHoverCoord={setHoverProfileCoord}
            />
          )}
        </div>
      </div>
    </div>
  );
}
