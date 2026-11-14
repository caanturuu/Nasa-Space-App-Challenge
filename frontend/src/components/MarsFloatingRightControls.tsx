"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  Footprints,
  Layers,
  MapPin,
  Minus,
  Navigation,
  PencilLine,
  Plus,
  SlidersHorizontal,
  Trash2,
  Wind,
  X,
} from "lucide-react";
import { NASA_LAYERS } from "@/lib/marsData";
import { ConditionScenario, MarsTelemetrySnapshot } from "@/lib/marsTelemetry";

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export type BasemapPresetId = "orbital" | "mola" | "viking" | "slope";

interface MarsFloatingRightControlsProps {
  layerStates: Record<string, LayerState>;
  onToggleLayer: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onSelectBasemapPreset: (preset: BasemapPresetId) => void;
  telemetry: MarsTelemetrySnapshot;
  scenario: ConditionScenario;
  onScenarioChange: (scenario: ConditionScenario) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterJezero: () => void;
  onResetGlobal: () => void;
  showProbeHud?: boolean;
  onToggleProbeHud?: () => void;
  isDrawingLine?: boolean;
  onToggleDrawLine?: () => void;
  showRoute?: boolean;
  onToggleAutoRoute?: () => void;
  onClearRoute?: () => void;
  hasActiveRoute?: boolean;
}

export function MarsFloatingRightControls({
  layerStates,
  onToggleLayer,
  onChangeOpacity,
  onSelectBasemapPreset,
  telemetry,
  scenario,
  onScenarioChange,
  onZoomIn,
  onZoomOut,
  onCenterJezero,
  onResetGlobal,
  isDrawingLine = false,
  onToggleDrawLine,
  showRoute = false,
  onToggleAutoRoute,
  onClearRoute,
  hasActiveRoute = false,
}: MarsFloatingRightControlsProps) {
  const [layersPopoverOpen, setLayersPopoverOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<BasemapPresetId>("viking");
  const [showMoreLayers, setShowMoreLayers] = useState(false);

  useEffect(() => {
    if (!layersPopoverOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-layer-dock]")) {
        setLayersPopoverOpen(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, [layersPopoverOpen]);

  const handleSelectMode = (id: BasemapPresetId) => {
    setActivePreset(id);
    onSelectBasemapPreset(id);
    setLayersPopoverOpen(false);
  };

  return (
    <aside className="absolute top-4 right-4 z-20 flex items-start gap-3 font-sans select-none pointer-events-none">
      {/* =========================================================================
          POPOVER 1: GOOGLE MAPS HORIZONTAL PILL DOCK (Sama Persis seperti Screenshot)
      ========================================================================= */}
      {layersPopoverOpen && (
        <div
          data-layer-dock
          onMouseLeave={() => setLayersPopoverOpen(false)}
          className="flex flex-col items-end gap-2 pointer-events-auto shrink-0 transition-opacity"
        >
          {/* Main Google Maps White Floating Dock */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl p-3 flex items-start gap-2 sm:gap-3 text-slate-800">
            {/* 1. Medan / MOLA Topografi Asli NASA */}
            <button
              onClick={() => handleSelectMode("mola")}
              className="flex flex-col items-center gap-1.5 w-14 sm:w-16 group cursor-pointer"
            >
              <div
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all relative ${activePreset === "mola"
                  ? "border-sky-600 ring-2 ring-sky-300 shadow-sm"
                  : "border-slate-300 group-hover:border-slate-400"
                  }`}
              >
                {/* Real NASA MOLA Color Shaded Relief Tile */}
                <img
                  src="/thumb-mola.jpg"
                  alt="NASA MOLA Topografi"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={`text-[11px] leading-tight text-center font-medium ${activePreset === "mola" ? "text-sky-700 font-bold" : "text-slate-700"
                  }`}
              >
                Medan
              </span>
            </button>

            {/* 2. Satelit / CTX Resolusi Tinggi Asli NASA */}
            <button
              onClick={() => handleSelectMode("orbital")}
              className="flex flex-col items-center gap-1.5 w-14 sm:w-16 group cursor-pointer"
            >
              <div
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all relative ${activePreset === "orbital"
                  ? "border-sky-600 ring-2 ring-sky-300 shadow-sm"
                  : "border-slate-300 group-hover:border-slate-400"
                  }`}
              >
                {/* Real NASA MRO CTX 5m Jezero Satellite Tile */}
                <img
                  src="/thumb-ctx.jpg"
                  alt="NASA MRO CTX Satelit"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={`text-[11px] leading-tight text-center font-medium ${activePreset === "orbital" ? "text-sky-700 font-bold" : "text-slate-700"
                  }`}
              >
                Satelit
              </span>
            </button>

            {/* 3. Warna Mars / Viking Color Asli NASA */}
            <button
              onClick={() => handleSelectMode("viking")}
              className="flex flex-col items-center gap-1.5 w-14 sm:w-16 group cursor-pointer"
            >
              <div
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all relative ${activePreset === "viking"
                  ? "border-sky-600 ring-2 ring-sky-300 shadow-sm"
                  : "border-slate-300 group-hover:border-slate-400"
                  }`}
              >
                {/* Real NASA Viking Color Mosaic Tile */}
                <img
                  src="/thumb-viking.jpg"
                  alt="NASA Viking Asli"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={`text-[11px] leading-tight text-center font-medium ${activePreset === "viking" ? "text-sky-700 font-bold" : "text-slate-700"
                  }`}
              >
                Asli
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          FIXED WIDTH VERTICAL TOOLBAR (56px) - Visible Dark Charcoal Outline
      ========================================================================= */}
      <div className="w-14 rounded-xl border-2 border-slate-900/90 bg-white shadow-2xl p-1.5 flex flex-col items-center gap-1.5 text-slate-900 pointer-events-auto shrink-0">
        {/* 1. Quick Layers Trigger */}
        <button
          data-layer-dock
          onClick={() => {
            setLayersPopoverOpen((v) => !v);
          }}
          className="w-11 h-11 rounded-lg border-[1.5px] border-slate-800/80 bg-slate-50 text-slate-950 hover:bg-slate-200 hover:border-slate-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
          title="Pilih Mode Lapisan Peta"
        >
          <Layers className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* 2. Route & Elevation Profile Navigation Tool */}
        <button
          onClick={onToggleDrawLine}
          className={`w-11 h-11 rounded-lg border-[1.5px] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs ${
            isDrawingLine
              ? "bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-300 animate-pulse"
              : "border-slate-800/80 bg-slate-50 text-slate-950 hover:bg-slate-200 hover:border-slate-900"
          }`}
          title={isDrawingLine ? "Sedang Menggambar Rute (Klik 2x di peta untuk selesai)" : "Navigasi Jalur & Ukur Elevasi (NASA Trek Draw Tool)"}
        >
          <MapPin className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* 3. Clear Route / Drawn Paths */}
        {(hasActiveRoute || isDrawingLine) && (
          <button
            onClick={onClearRoute}
            className="w-11 h-11 rounded-lg border-[1.5px] border-rose-700/80 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
            title="Hapus Rute & Garis Ukur"
          >
            <Trash2 className="w-5 h-5 stroke-[2.2]" />
          </button>
        )}

        {/* 4. Zoom In */}
        <button
          onClick={onZoomIn}
          className="w-11 h-11 rounded-lg border-[1.5px] border-slate-800/80 bg-slate-50 text-slate-950 hover:bg-slate-200 hover:border-slate-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
          title="Perbesar Peta"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* 7. Zoom Out */}
        <button
          onClick={onZoomOut}
          className="w-11 h-11 rounded-lg border-[1.5px] border-slate-800/80 bg-slate-50 text-slate-950 hover:bg-slate-200 hover:border-slate-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
          title="Perkecil Peta"
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* 8. North Compass */}
        <button
          onClick={onResetGlobal}
          className="w-11 h-11 rounded-lg border-[1.5px] border-slate-800/80 bg-slate-50 text-slate-950 hover:bg-slate-200 hover:border-slate-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
          title="Reset Orientasi Arah Utara & Global Mars"
        >
          <Compass className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>
    </aside>
  );
}
