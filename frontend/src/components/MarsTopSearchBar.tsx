"use client";

import { useMemo, useState } from "react";
import { CornerUpRight, MapPin, Menu, Search, User, X } from "lucide-react";
import { ALL_MARS_PLACES, ScienceTargetFeature } from "@/lib/marsData";
import { MarsTelemetrySnapshot } from "@/lib/marsTelemetry";

export type LeftPanelTab = "place" | "directions" | "layers";

interface MarsTopSearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onSelectPlace: (place: ScienceTargetFeature) => void;
  onOpenDirections: () => void;
  onToggleMenu: () => void;
  onOpenConditions: () => void;
  telemetry: MarsTelemetrySnapshot;
}

export function MarsTopSearchBar({
  searchQuery,
  onSearchQueryChange,
  onSelectPlace,
  onOpenDirections,
  onToggleMenu,
  onOpenConditions,
  telemetry,
}: MarsTopSearchBarProps) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_MARS_PLACES.slice(0, 7);
    return ALL_MARS_PLACES.filter(
      (f) =>
        f.properties.name.toLowerCase().includes(q) ||
        f.properties.category.toLowerCase().includes(q) ||
        (f.properties.region ?? "").toLowerCase().includes(q) ||
        f.properties.mineral_signature.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  const statusPillClass =
    telemetry.evaStatus === "GO"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : telemetry.evaStatus === "CAUTION"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 z-30 shadow-xs">
      {/* Left Brand (Bing-Maps-style clean 4-tile grid + Mars Maps) */}
      <button
        onClick={() => onSelectPlace(ALL_MARS_PLACES[0])}
        className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
        title="Return to Jezero Hab Base"
      >
        <div className="grid grid-cols-2 gap-0.5 w-5 h-5 shrink-0">
          <span className="bg-orange-600 rounded-[1px]" />
          <span className="bg-amber-500 rounded-[1px]" />
          <span className="bg-sky-600 rounded-[1px]" />
          <span className="bg-rose-500 rounded-[1px]" />
        </div>
        <span className="hidden sm:inline text-sm font-semibold text-slate-800 tracking-tight group-hover:text-orange-600 transition-colors">
          Mars Maps
        </span>
      </button>

      {/* Center Search Pill + Directions Button */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl justify-center">
        <div className="relative flex-1 max-w-lg">
          <div className="flex items-center rounded-full bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow px-3.5 h-10 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15">
            <Search className="h-4 w-4 text-sky-600 shrink-0 mr-2.5" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 160)}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search Mars (Jezero Crater, Belva, Olympus Mons...)"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange("")}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {focused && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 max-h-80 overflow-y-auto">
              {suggestions.map((place) => (
                <button
                  key={place.properties.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSearchQueryChange(place.properties.name);
                    onSelectPlace(place);
                    setFocused(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {place.properties.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {place.properties.region ?? place.properties.category} ·{" "}
                        {place.properties.mineral_signature}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {place.properties.elevation_m} m
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Directions Button next to Search Pill (matching Bing Maps) */}
        <button
          onClick={onOpenDirections}
          className="flex flex-col items-center justify-center px-2 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 group"
          title="EVA Route Directions"
        >
          <span className="h-6 w-6 rounded-md bg-sky-600 text-white flex items-center justify-center shadow-xs group-hover:bg-sky-700">
            <CornerUpRight className="h-3.5 w-3.5" />
          </span>
          <span className="text-[10px] font-medium text-slate-600 leading-tight mt-0.5">
            Directions
          </span>
        </button>
      </div>

      {/* Right Utility Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenConditions}
          className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${statusPillClass}`}
          title="View Current Mars Conditions"
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          Sol {telemetry.sol} · {telemetry.evaStatus}
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600">
          <span className="text-[11px] font-medium">Crew EVA</span>
          <span className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
            <User className="h-4 w-4" />
          </span>
        </div>

        <button
          onClick={onToggleMenu}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle map panel"
          title="Layers & Mission Panel"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

