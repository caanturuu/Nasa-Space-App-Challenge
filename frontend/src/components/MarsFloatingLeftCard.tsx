"use client";

import {
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerUpRight,
  Crosshair,
  Gauge,
  Layers,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ALL_MARS_PLACES,
  MISSION_PRESETS,
  MissionPreset,
  NASA_LAYERS,
  ScienceTargetFeature,
} from "@/lib/marsData";
import { EvaRouteResult, PlannerMode } from "@/lib/marsRouting";
import { MarsTelemetrySnapshot } from "@/lib/marsTelemetry";
import { LayerState } from "./MarsFloatingRightControls";
import { LeftPanelTab } from "./MarsTopSearchBar";

export type MapPickMode = "inspect" | "pick_start" | "pick_end";

interface MarsFloatingLeftCardProps {
  isOpen: boolean;
  activeTab: LeftPanelTab;
  onSetOpen: (open: boolean) => void;
  onSetTab: (tab: LeftPanelTab) => void;
  selectedPlace: ScienceTargetFeature;
  onSelectPlace: (place: ScienceTargetFeature) => void;
  startCoord: [number, number];
  endCoord: [number, number];
  mode: PlannerMode;
  maxSlopeDeg: number;
  pickMode: MapPickMode;
  route: EvaRouteResult | null;
  routeError: string | null;
  telemetry: MarsTelemetrySnapshot;
  onChangeMode: (mode: PlannerMode) => void;
  onChangeMaxSlope: (val: number) => void;
  onChangePickMode: (mode: MapPickMode) => void;
  onApplyPreset: (preset: MissionPreset) => void;
  onStartDirectionsToSelected: () => void;
  onHoverProfileCoord: (coord: [number, number] | null) => void;
  layerStates: Record<string, LayerState>;
  onToggleLayer: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
}

export function MarsFloatingLeftCard({
  isOpen,
  activeTab,
  onSetOpen,
  onSetTab,
  selectedPlace,
  onSelectPlace,
  startCoord,
  endCoord,
  mode,
  maxSlopeDeg,
  pickMode,
  route,
  routeError,
  telemetry,
  onChangeMode,
  onChangeMaxSlope,
  onChangePickMode,
  onApplyPreset,
  onStartDirectionsToSelected,
  onHoverProfileCoord,
  layerStates,
  onToggleLayer,
  onChangeOpacity,
}: MarsFloatingLeftCardProps) {
  const [lon, lat] = selectedPlace.geometry.coordinates;

  return (
    <>
      {/* Middle-left collapse tab handle (matching Bing Maps left edge tab) */}
      {!isOpen && (
        <button
          onClick={() => onSetOpen(true)}
          title="Open Mars Info & EVA Directions"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-12 w-5 rounded-r-lg bg-white/95 border border-l-0 border-slate-200 shadow-lg flex items-center justify-center text-slate-600 hover:text-sky-600 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Floating Left Bing-Maps-Style Card */}
      {isOpen && (
        <div className="absolute top-4 left-4 bottom-6 w-[360px] max-w-[calc(100vw-2rem)] z-20 flex pointer-events-none">
          <div className="pointer-events-auto flex-1 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800">
            {/* Card Tabs + Close */}
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "place", label: "Place" },
                    { id: "directions", label: "Directions" },
                    { id: "layers", label: "Layers" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSetTab(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeTab === t.id
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onSetOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                title="Collapse panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {/* TAB 1: PLACE DETAILS */}
              {activeTab === "place" && (
                <>
                  <div className="rounded-xl bg-gradient-to-br from-orange-950 via-amber-900 to-slate-900 text-white p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-200/90">
                      <span>{selectedPlace.properties.category}</span>
                      <span>ELEV {selectedPlace.properties.elevation_m} m</span>
                    </div>
                    <h2 className="text-base font-bold leading-snug">
                      {selectedPlace.properties.name}
                    </h2>
                    <p className="text-xs text-amber-100/80">
                      {selectedPlace.properties.region ?? "Mars Surface"} ·{" "}
                      {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={onStartDirectionsToSelected}
                      disabled={!selectedPlace.properties.inJezeroGrid}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        selectedPlace.properties.inJezeroGrid
                          ? "bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <CornerUpRight className="h-4 w-4" />
                      {selectedPlace.properties.inJezeroGrid
                        ? "Directions from Hab"
                        : "Outside Jezero EVA Grid"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Science Value</span>
                      <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
                        SCI {selectedPlace.properties.science_score} / 100
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Mineral / Geologic Signature
                      </span>
                      <p className="text-slate-800 font-medium">
                        {selectedPlace.properties.mineral_signature}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Mission Reference
                      </span>
                      <p className="text-slate-700">{selectedPlace.properties.mission_ref}</p>
                    </div>
                    <p className="text-slate-600 leading-relaxed pt-1 border-t border-slate-200/70">
                      {selectedPlace.properties.summary}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Explore Other Mars Locations
                    </span>
                    <div className="space-y-1">
                      {ALL_MARS_PLACES.map((p) => (
                        <button
                          key={p.properties.id}
                          onClick={() => onSelectPlace(p)}
                          className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            p.properties.id === selectedPlace.properties.id
                              ? "bg-sky-50 text-sky-800 font-semibold border border-sky-200"
                              : "hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="truncate">{p.properties.name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {p.properties.inJezeroGrid ? "Jezero" : "Global"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: DIRECTIONS / EVA ROUTE PLANNER */}
              {activeTab === "directions" && (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Quick Marswalk Routes
                    </span>
                    <div className="grid gap-1.5">
                      {MISSION_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => onApplyPreset(preset)}
                          className="text-left rounded-lg border border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50 px-2.5 py-1.5 text-xs text-slate-700 font-medium flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{preset.label}</span>
                          <Navigation className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          onChangePickMode(pickMode === "pick_start" ? "inspect" : "pick_start")
                        }
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          pickMode === "pick_start"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
                        }`}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                        {pickMode === "pick_start" ? "Click Map..." : "Set Start"}
                      </button>
                      <button
                        onClick={() =>
                          onChangePickMode(pickMode === "pick_end" ? "inspect" : "pick_end")
                        }
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          pickMode === "pick_end"
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-rose-400"
                        }`}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                        {pickMode === "pick_end" ? "Click Map..." : "Set Dest"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600">
                      <div className="bg-white rounded-lg border border-slate-200 px-2 py-1">
                        <span className="text-emerald-600 font-bold block">FROM</span>
                        {startCoord[1].toFixed(4)}°N, {startCoord[0].toFixed(4)}°E
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 px-2 py-1">
                        <span className="text-rose-600 font-bold block">TO</span>
                        {endCoord[1].toFixed(4)}°N, {endCoord[0].toFixed(4)}°E
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "safest", label: "Safest" },
                          { id: "balanced", label: "Balanced" },
                          { id: "max_science", label: "Max Science" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onChangeMode(m.id)}
                          className={`rounded-lg py-1 text-[11px] font-semibold cursor-pointer ${
                            mode === m.id
                              ? "bg-sky-600 text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                        <span>Max Safe Slope</span>
                        <span className="font-mono text-sky-700 font-bold">{maxSlopeDeg}°</span>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={25}
                        step={1}
                        value={maxSlopeDeg}
                        onChange={(e) => onChangeMaxSlope(Number(e.target.value))}
                        className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {routeError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                      {routeError}
                    </div>
                  )}

                  {route && (
                    <div className="space-y-2.5">
                      {(telemetry.maxSafeRangeM === 0 ||
                        route.metrics.totalDistanceM > telemetry.maxSafeRangeM) && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700">
                          <strong>Range Alert:</strong> Route (
                          {(route.metrics.totalDistanceM / 1000).toFixed(2)} km) exceeds current{" "}
                          {telemetry.evaStatus} radius (
                          {(telemetry.maxSafeRangeM / 1000).toFixed(1)} km).
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-sky-600" /> Distance
                          </span>
                          <p className="font-bold text-slate-800 mt-0.5">
                            {(route.metrics.totalDistanceM / 1000).toFixed(2)} km
                          </p>
                          <span className="text-[10px] text-slate-500">
                            +{route.metrics.totalAscentM}m ascent
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-amber-600" /> Duration
                          </span>
                          <p className="font-bold text-slate-800 mt-0.5">
                            {route.metrics.estimatedDurationMin} min
                          </p>
                          <span className="text-[10px] text-slate-500">
                            Max slope {route.metrics.maxSlopeDeg}°
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Gauge className="h-3 w-3 text-emerald-600" /> O₂ Used
                          </span>
                          <p className="font-bold text-emerald-700 mt-0.5">
                            {route.metrics.oxygenUsedPct}%
                          </p>
                          <span className="text-[10px] text-slate-500">
                            Return {route.metrics.roundTripO2Pct}%
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <BatteryCharging className="h-3 w-3 text-sky-600" /> Suit Power
                          </span>
                          <p className="font-bold text-sky-700 mt-0.5">
                            {route.metrics.batteryUsedPct}%
                          </p>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            {route.metrics.pointOfNoReturnOk ? "Margin OK" : "Tight Margin"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] space-y-1">
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Terrain-Aware A*
                        </div>
                        <p className="text-slate-600">
                          {route.directBaseline.exceedsSafeSlope ||
                          route.directBaseline.hazardsCrossed.length > 0
                            ? `Direct line hits ${route.directBaseline.maxSlopeDeg}° slope. Optimal path detours under ${route.metrics.maxSlopeDeg}°.`
                            : "Direct corridor clear; optimized for slope & science."}
                        </p>
                      </div>

                      {route.nearbyScienceTargets.length > 0 && (
                        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2.5 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-sky-800 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Science POIs Nearby
                          </span>
                          {route.nearbyScienceTargets.map((st) => (
                            <div
                              key={st.id}
                              className="flex items-center justify-between text-[11px] text-slate-700"
                            >
                              <span className="truncate">{st.name}</span>
                              <span className="font-mono text-sky-700 shrink-0">
                                {st.distanceFromRouteM}m
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Compact Elevation & Slope Profile Chart inside Directions */}
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1">
                          Elevation (m) & Slope (°) Profile
                        </div>
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={route.profile}
                              margin={{ top: 4, right: 6, left: -14, bottom: 0 }}
                              onMouseMove={(state) => {
                                const idx = state?.activeTooltipIndex;
                                if (typeof idx === "number" && route.profile[idx]) {
                                  const pt = route.profile[idx];
                                  onHoverProfileCoord([pt.lon, pt.lat]);
                                }
                              }}
                              onMouseLeave={() => onHoverProfileCoord(null)}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="distanceM"
                                tick={{ fill: "#64748b", fontSize: 9 }}
                                tickFormatter={(v) => `${Math.round(Number(v) / 100) / 10}km`}
                              />
                              <YAxis
                                yAxisId="elev"
                                domain={["auto", "auto"]}
                                tick={{ fill: "#0284c7", fontSize: 9 }}
                              />
                              <YAxis
                                yAxisId="slope"
                                orientation="right"
                                domain={[0, 28]}
                                hide
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: "10px",
                                  borderRadius: "8px",
                                  borderColor: "#cbd5e1",
                                }}
                                labelFormatter={(l) => `Dist: ${l} m`}
                              />
                              <ReferenceLine
                                yAxisId="slope"
                                y={maxSlopeDeg}
                                stroke="#ef4444"
                                strokeDasharray="3 3"
                              />
                              <Area
                                yAxisId="elev"
                                type="monotone"
                                dataKey="elevationM"
                                name="Elev (m)"
                                stroke="#0284c7"
                                fill="#bae6fd"
                                fillOpacity={0.55}
                              />
                              <Line
                                yAxisId="slope"
                                type="monotone"
                                dataKey="slopeDeg"
                                name="Slope (°)"
                                stroke="#ea580c"
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 3: LAYERS */}
              {activeTab === "layers" && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-orange-600" />
                    Multi-Mission NASA Data Stack
                  </div>
                  {NASA_LAYERS.map((layer) => {
                    const st = layerStates[layer.id] ?? {
                      visible: layer.defaultVisible,
                      opacity: layer.defaultOpacity,
                    };
                    return (
                      <div
                        key={layer.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{layer.title}</p>
                            <p className="text-[10px] text-sky-700 font-medium">{layer.mission}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={st.visible}
                            onChange={() => onToggleLayer(layer.id)}
                            className="h-4 w-4 accent-sky-600 cursor-pointer mt-0.5"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">{layer.description}</p>
                        {st.visible && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 w-9">
                              {Math.round(st.opacity * 100)}%
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={st.opacity}
                              onChange={(e) => onChangeOpacity(layer.id, Number(e.target.value))}
                              className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Collapse Arrow attached to right edge of floating card */}
          <button
            onClick={() => onSetOpen(false)}
            title="Hide panel"
            className="pointer-events-auto self-center -ml-px h-10 w-5 rounded-r-lg bg-white border border-l-0 border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-sky-600 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
