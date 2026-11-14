"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import ImageStatic from "ol/source/ImageStatic";
import VectorSource from "ol/source/Vector";
import Projection from "ol/proj/Projection";
import TileGrid from "ol/tilegrid/TileGrid";
import { defaults as defaultControls } from "ol/control/defaults";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import BaseLayer from "ol/layer/Base";

import {
  JEZERO_BOUNDS,
  MARS_CRS_CODE,
  MARS_METERS_PER_DEGREE,
  buildMarsCircleRing,
} from "@/lib/marsCrs";
import {
  ALL_MARS_PLACES,
  CameraPreset,
  JEZERO_HAZARDS,
  NASA_LAYERS,
  ScienceTargetFeature,
} from "@/lib/marsData";
import { MarsTelemetrySnapshot } from "@/lib/marsTelemetry";
import { TerrainSample, getTerrainGrid } from "@/lib/marsTerrain";
import {
  RouteSegment,
  ThemeTokens,
  WaypointNode,
  WorkbenchTabId,
} from "@/oop/MarsWorkbenchOOP";

const VIEW_RESOLUTIONS = Array.from(
  { length: 17 },
  (_, z) => 0.703125 / Math.pow(2, z)
);

export interface LayerState {
  visible: boolean;
  opacity: number;
}

interface MarsBingMapViewportProps {
  layerStates: Record<string, LayerState>;
  selectedPlace: ScienceTargetFeature;
  waypointNodes: WaypointNode[];
  routeSegments: RouteSegment[];
  isMarkingMode: boolean;
  nextWaypointPrompt: string;
  onMapClickCoordinate: (coord: [number, number]) => void;
  onSelectPlace: (place: ScienceTargetFeature) => void;
  telemetry: MarsTelemetrySnapshot;
  cameraRequest: { preset: CameraPreset; seq: number } | null;
  zoomSignal: { delta: number; seq: number } | null;
  hoverProfileCoord: [number, number] | null;
  themeTokens: ThemeTokens;
  activeTab: WorkbenchTabId;
  bottomProfilerOpen: boolean;
}

export function MarsBingMapViewport({
  layerStates,
  selectedPlace,
  waypointNodes,
  routeSegments,
  isMarkingMode,
  nextWaypointPrompt,
  onMapClickCoordinate,
  onSelectPlace,
  telemetry,
  cameraRequest,
  zoomSignal,
  hoverProfileCoord,
  themeTokens,
  activeTab,
  bottomProfilerOpen,
}: MarsBingMapViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const layersMapRef = useRef<Record<string, BaseLayer>>({});
  const routeSourceRef = useRef<VectorSource | null>(null);
  const safeRangeSourceRef = useRef<VectorSource | null>(null);
  const activePinSourceRef = useRef<VectorSource | null>(null);
  const hoverSourceRef = useRef<VectorSource | null>(null);

  const isMarkingRef = useRef<boolean>(isMarkingMode);
  const onMapClickRef = useRef(onMapClickCoordinate);
  const onSelectPlaceRef = useRef(onSelectPlace);

  const [cursorSample, setCursorSample] = useState<TerrainSample>({
    inJezeroDem: true,
    lon: 77.4509,
    lat: 18.4446,
    elevationM: -2568,
    slopeDeg: 4.2,
    hazardType: null,
  });

  const [mapScaleText, setMapScaleText] = useState<string>("500 m");

  useEffect(() => {
    isMarkingRef.current = isMarkingMode;
  }, [isMarkingMode]);

  useEffect(() => {
    onMapClickRef.current = onMapClickCoordinate;
  }, [onMapClickCoordinate]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  // Initialize Real OpenLayers Mars Map (IAU_2015:49900 + NASA Trek WMTS + Interactive Pan/Zoom/Click)
  useEffect(() => {
    if (!containerRef.current) return;

    const marsProjection = new Projection({
      code: MARS_CRS_CODE,
      units: "degrees",
      extent: [-180, -90, 180, 90],
      worldExtent: [-180, -90, 180, 90],
      metersPerUnit: MARS_METERS_PER_DEGREE,
    });

    const terrainGrid = getTerrainGrid();
    const layerInstances: Record<string, BaseLayer> = {};
    const orderedLayers: BaseLayer[] = [];

    for (const cfg of NASA_LAYERS) {
      const initial = layerStates[cfg.id] ?? {
        visible: cfg.defaultVisible,
        opacity: cfg.defaultOpacity,
      };

      if (cfg.protocol === "wmts" && cfg.tileUrlTemplate) {
        const res0 = 360 / (cfg.tileSize * 2);
        const resolutions = Array.from(
          { length: cfg.maxZoom + 1 },
          (_, z) => res0 / Math.pow(2, z)
        );
        const tileGrid = new TileGrid({
          extent: [-180, -90, 180, 90],
          origin: [-180, 90],
          resolutions,
          tileSize: [cfg.tileSize, cfg.tileSize],
        });

        const tileLayer = new TileLayer({
          visible: initial.visible,
          opacity: initial.opacity,
          source: new XYZ({
            projection: marsProjection,
            tileGrid,
            crossOrigin: "anonymous",
            wrapX: false,
            tileUrlFunction: (tileCoord) => {
              if (!tileCoord) return undefined;
              const [z, x, y] = tileCoord;
              if (z < cfg.minZoom || z > cfg.maxZoom) return undefined;
              const maxX = Math.pow(2, z + 1);
              const maxY = Math.pow(2, z);
              if (x < 0 || x >= maxX || y < 0 || y >= maxY) return undefined;

              if (cfg.id === "ctx_global_5m" && z === 1 && x >= 2) {
                const z2 = 2;
                const x2 = x * 2;
                const y2 = y * 2;
                return cfg.tileUrlTemplate!
                  .replace("{z}", String(z2))
                  .replace("{y}", String(y2))
                  .replace("{x}", String(x2));
              }

              return cfg.tileUrlTemplate!
                .replace("{z}", String(z))
                .replace("{y}", String(y))
                .replace("{x}", String(x));
            },
          }),
        });
        layerInstances[cfg.id] = tileLayer;
        orderedLayers.push(tileLayer);
      } else if (cfg.protocol === "image_overlay") {
        const dataUrl = terrainGrid.renderSlopeOverlayDataUrl();
        const imgLayer = new ImageLayer({
          visible: initial.visible,
          opacity: initial.opacity,
          source: new ImageStatic({
            url: dataUrl,
            projection: marsProjection,
            imageExtent: [
              JEZERO_BOUNDS.lonMin,
              JEZERO_BOUNDS.latMin,
              JEZERO_BOUNDS.lonMax,
              JEZERO_BOUNDS.latMax,
            ],
          }),
        });
        layerInstances[cfg.id] = imgLayer;
        orderedLayers.push(imgLayer);
      }
    }

    // 1. SOLID Hazard Polygons (with ! SEITAH DUST TRAP badge matching UI1.figcraft)
    const hazardFeatures = JEZERO_HAZARDS.features.map(
      (feat) =>
        new Feature({
          geometry: new Polygon(feat.geometry.coordinates),
          hazardProps: feat.properties,
        })
    );
    const hazardLayer = new VectorLayer({
      visible: layerStates.hazard_zones?.visible ?? true,
      opacity: layerStates.hazard_zones?.opacity ?? 0.9,
      source: new VectorSource({ features: hazardFeatures }),
      style: (feature) => {
        const props = feature.get("hazardProps");
        const isDustTrap = props?.id === "haz-seitah-sand";
        return new Style({
          stroke: new Stroke({
            color: "rgba(239, 68, 68, 0.8)",
            width: 1.8, // 100% SOLID (no lineDash)
          }),
          fill: new Fill({
            color: "rgba(239, 68, 68, 0.16)",
          }),
          text: isDustTrap
            ? new Text({
                text: "! SEITAH DUST TRAP",
                font: "700 10px Consolas, monospace",
                fill: new Fill({ color: "#FCA5A5" }),
                backgroundFill: new Fill({ color: "#1E0E10" }),
                backgroundStroke: new Stroke({ color: "#EF4444", width: 1 }),
                padding: [4, 7, 4, 7],
              })
            : undefined,
        });
      },
    });
    layerInstances.hazard_zones = hazardLayer;
    orderedLayers.push(hazardLayer);

    // 2. SOLID 5.5 km EVA SAFE RADIUS Circle
    const safeRangeSource = new VectorSource();
    safeRangeSourceRef.current = safeRangeSource;
    orderedLayers.push(new VectorLayer({ source: safeRangeSource }));

    // 3. SOLID Multi-Point Route Segments & Numbered Waypoints (1 -> 2 -> 3 -> 4)
    const routeSource = new VectorSource();
    routeSourceRef.current = routeSource;
    orderedLayers.push(new VectorLayer({ source: routeSource }));

    // 4. Rectangular Pill POI Pins (matching UI1.figcraft styling)
    const placeFeatures = ALL_MARS_PLACES.map(
      (feat) =>
        new Feature({
          geometry: new Point(feat.geometry.coordinates),
          placeFeature: feat,
        })
    );
    const placesLayer = new VectorLayer({
      visible: layerStates.science_targets?.visible ?? true,
      opacity: layerStates.science_targets?.opacity ?? 1.0,
      source: new VectorSource({ features: placeFeatures }),
      style: (feature, resolution) => {
        const pf = feature.get("placeFeature") as ScienceTargetFeature;
        const isJezero = pf.properties.inJezeroGrid;
        if (isJezero && resolution > 0.04 && pf.properties.id !== "hab-octavia") {
          return undefined;
        }

        const isHab = pf.properties.id === "hab-octavia";
        const isDelta = pf.properties.id === "delta-front-hawksbill";
        const isBelva = pf.properties.id === "belva-rim";

        const dotColor = isHab
          ? "#22C55E"
          : isDelta
            ? "#38BDF8"
            : isBelva
              ? "#E86A33"
              : "#94A3B8";
        const borderColor = isHab
          ? "#22C55E"
          : isDelta
            ? "#38BDF8"
            : "#334155";
        const textColor = isHab
          ? "#F8FAFC"
          : isDelta
            ? "#E0F2FE"
            : "#E2E8F0";

        const labelText = isDelta
          ? "Hawksbill Delta · 96"
          : isHab
            ? "Octavia Hab Base"
            : pf.properties.name;

        return [
          new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: dotColor }),
              stroke: new Stroke({ color: "#090B0F", width: 2 }),
            }),
          }),
          new Style({
            text: new Text({
              text: labelText,
              textAlign: "left",
              textBaseline: "middle",
              offsetX: 11,
              font: "700 11px Bahnschrift, 'Helvetica Neue', sans-serif",
              fill: new Fill({ color: textColor }),
              backgroundFill: new Fill({ color: "#0E1117" }),
              backgroundStroke: new Stroke({ color: borderColor, width: 1 }),
              padding: [4, 7, 4, 7],
            }),
          }),
        ];
      },
    });
    layerInstances.science_targets = placesLayer;
    orderedLayers.push(placesLayer);

    // 5. Active Highlighted POI Halo
    const activePinSource = new VectorSource();
    activePinSourceRef.current = activePinSource;
    orderedLayers.push(new VectorLayer({ source: activePinSource }));

    // 6. Elevation Profile Hover Pin
    const hoverSource = new VectorSource();
    hoverSourceRef.current = hoverSource;
    orderedLayers.push(
      new VectorLayer({
        source: hoverSource,
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: "#38BDF8" }),
            stroke: new Stroke({ color: "#090B0F", width: 2.5 }),
          }),
        }),
      })
    );

    layersMapRef.current = layerInstances;

    const map = new Map({
      target: containerRef.current,
      layers: orderedLayers,
      controls: defaultControls({
        attribution: false,
        zoom: false,
        rotate: false,
      }),
      view: new View({
        projection: marsProjection,
        center: [77.425, 18.45],
        zoom: 12.2,
        resolutions: VIEW_RESOLUTIONS,
        constrainResolution: false,
        extent: [-180, -90, 180, 90],
      }),
    });

    map.on("pointermove", (evt) => {
      if (evt.dragging || !evt.coordinate) return;
      const [lon, lat] = evt.coordinate as [number, number];
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      setCursorSample(terrainGrid.samplePoint(lon, lat));
    });

    map.on("singleclick", (evt) => {
      // In waypoint marking mode, clicking anywhere places the next waypoint (Start -> 2nd -> End)
      if (isMarkingRef.current) {
        const [lon, lat] = evt.coordinate as [number, number];
        onMapClickRef.current([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
        return;
      }

      // Otherwise check if a POI marker was clicked first; if not, still allow clicking in Route tab
      let clickedPlace: ScienceTargetFeature | null = null;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (feature) => {
          const pf = feature.get("placeFeature") as
            | ScienceTargetFeature
            | undefined;
          if (pf) {
            clickedPlace = pf;
            return true;
          }
          return false;
        },
        { hitTolerance: 10 }
      );

      if (clickedPlace) {
        onSelectPlaceRef.current(clickedPlace);
        return;
      }

      const [lon, lat] = evt.coordinate as [number, number];
      onMapClickRef.current([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
    });

    const updateScaleBar = () => {
      const view = map.getView();
      const res = view.getResolution();
      if (!res) return;
      const center = view.getCenter() || [77.425, 18.45];
      const lat = center[1];
      const latRad = (lat * Math.PI) / 180;
      const metersPerDegree = MARS_METERS_PER_DEGREE * Math.cos(latRad);
      const metersPerPixel = res * metersPerDegree;
      const totalMeters = 72 * metersPerPixel;

      let text = "500 m";
      if (totalMeters >= 100_000) {
        text = `${Math.round(totalMeters / 1000)} km`;
      } else if (totalMeters >= 1000) {
        text = `${(totalMeters / 1000).toFixed(1)} km`;
      } else {
        text = `${Math.max(10, Math.round(totalMeters / 10) * 10)} m`;
      }
      setMapScaleText(text);
    };

    map.on("postrender", updateScaleBar);
    updateScaleBar();

    mapRef.current = map;
    return () => {
      map.un("postrender", updateScaleBar);
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger OpenLayers resize when bottom profiler opens/closes
  useEffect(() => {
    const id = window.setTimeout(() => {
      mapRef.current?.updateSize();
    }, 60);
    return () => window.clearTimeout(id);
  }, [bottomProfilerOpen, telemetry.evaStatus]);

  // Sync Basemap Layers (MOLA / MRO CTX 6m / Viking)
  useEffect(() => {
    for (const [id, st] of Object.entries(layerStates)) {
      const layer = layersMapRef.current[id];
      if (layer) {
        layer.setVisible(st.visible);
        layer.setOpacity(st.opacity);
      }
    }
  }, [layerStates]);

  // Highlight Selected Place
  useEffect(() => {
    const src = activePinSourceRef.current;
    if (!src) return;
    src.clear();
    const halo = new Feature({
      geometry: new Point(selectedPlace.geometry.coordinates),
    });
    halo.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: "rgba(56, 189, 248, 0.18)" }),
          stroke: new Stroke({ color: "#38BDF8", width: 2 }),
        }),
      })
    );
    src.addFeature(halo);
  }, [selectedPlace]);

  // Render SOLID Multi-Point Route Segments + Numbered Circular Waypoint Badges (1, 2, 3...)
  useEffect(() => {
    const src = routeSourceRef.current;
    if (!src) return;
    src.clear();

    // 1. Dark casing + slope-colored SOLID segments
    for (const seg of routeSegments) {
      if (seg.coordinates.length >= 2) {
        const casing = new Feature({
          geometry: new LineString(seg.coordinates),
        });
        casing.setStyle(
          new Style({
            stroke: new Stroke({
              color: "#090B0F",
              width: 8,
              lineCap: "round",
              lineJoin: "round",
            }),
          })
        );
        src.addFeature(casing);
      }

      for (const sub of seg.subLegs) {
        const subFeature = new Feature({
          geometry: new LineString(sub.coords),
        });
        subFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color: sub.color,
              width: 4,
              lineCap: "round",
              lineJoin: "round",
            }),
          })
        );
        src.addFeature(subFeature);
      }
    }

    // 2. Filled Circular Waypoint Badges (1 -> 2 -> 3 -> End)
    for (const wp of waypointNodes) {
      const nodeFeature = new Feature({
        geometry: new Point(wp.coordinates),
      });
      nodeFeature.setStyle([
        new Style({
          image: new CircleStyle({
            radius: 11.5,
            fill: new Fill({ color: wp.badgeColor }),
            stroke: new Stroke({ color: "#090B0F", width: 2 }),
          }),
          text: new Text({
            text: String(wp.index),
            font: "700 11px Consolas, monospace",
            fill: new Fill({ color: "#090B0F" }),
            textAlign: "center",
            textBaseline: "middle",
          }),
        }),
        new Style({
          text: new Text({
            text: `${wp.roleTag.toUpperCase()} · ${wp.label}`,
            textAlign: "left",
            textBaseline: "middle",
            offsetX: 16,
            font: "700 9.5px Consolas, monospace",
            fill: new Fill({
              color:
                wp.badgeColor === "#EF4444"
                  ? "#FCA5A5"
                  : wp.badgeColor === "#F59E0B"
                    ? "#FDE68A"
                    : "#E2E8F0",
            }),
            backgroundFill: new Fill({ color: "#12161E" }),
            backgroundStroke: new Stroke({ color: wp.badgeColor, width: 1 }),
            padding: [3, 6, 3, 6],
          }),
        }),
      ]);
      src.addFeature(nodeFeature);
    }
  }, [waypointNodes, routeSegments]);

  // Render SOLID 5.5 km EVA SAFE RADIUS Circle
  useEffect(() => {
    const src = safeRangeSourceRef.current;
    if (!src) return;
    src.clear();
    const radiusM =
      telemetry.maxSafeRangeM > 0 ? telemetry.maxSafeRangeM : 5500;
    const ring = buildMarsCircleRing(77.4509, 18.4446, radiusM);
    if (ring.length === 0) return;

    const isAbort = telemetry.evaStatus === "ABORT";
    const isCaution = telemetry.evaStatus === "CAUTION";
    const strokeCol = isAbort
      ? "rgba(239, 68, 68, 0.75)"
      : isCaution
        ? "rgba(245, 158, 11, 0.75)"
        : "rgba(34, 197, 94, 0.55)";

    const circleFeature = new Feature({ geometry: new Polygon([ring]) });
    circleFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: strokeCol,
          width: 1.6, // 100% SOLID (no lineDash)
        }),
        text: new Text({
          text: isAbort
            ? "PERIMETER LOCKED · RETURN TO HAB"
            : "5.5 km EVA SAFE RADIUS",
          font: "700 10px Consolas, monospace",
          fill: new Fill({ color: isAbort ? "#FCA5A5" : "#4ADE80" }),
          stroke: new Stroke({ color: "#090B0F", width: 3 }),
        }),
      })
    );
    src.addFeature(circleFeature);
  }, [telemetry.maxSafeRangeM, telemetry.evaStatus]);

  // Real OpenLayers Camera Fly Animation
  useEffect(() => {
    if (!cameraRequest || !mapRef.current) return;
    mapRef.current.getView().animate({
      center: cameraRequest.preset.center,
      zoom: cameraRequest.preset.zoom,
      duration: 450,
    });
  }, [cameraRequest]);

  // Real OpenLayers Zoom In / Zoom Out Signal
  useEffect(() => {
    if (!zoomSignal || !mapRef.current) return;
    const view = mapRef.current.getView();
    const cur = view.getZoom() ?? 12.2;
    view.animate({
      zoom: Math.max(1.5, Math.min(16, cur + zoomSignal.delta)),
      duration: 200,
    });
  }, [zoomSignal]);

  // Sync Elevation Profile Hover Dot onto Real OpenLayers Map
  useEffect(() => {
    const src = hoverSourceRef.current;
    if (!src) return;
    src.clear();
    if (hoverProfileCoord) {
      src.addFeature(new Feature({ geometry: new Point(hoverProfileCoord) }));
    }
  }, [hoverProfileCoord]);

  return (
    <div
      style={{
        borderColor:
          activeTab === "science" && telemetry.evaStatus !== "ABORT"
            ? "#22C55E"
            : "transparent",
      }}
      className={`relative flex-1 w-full h-full bg-[#090B0F] overflow-hidden select-none ${
        activeTab === "science" && telemetry.evaStatus !== "ABORT"
          ? "border-2"
          : ""
      }`}
    >
      {/* Real Interactive OpenLayers Viewport */}
      <div
        ref={containerRef}
        className={`w-full h-full ${
          isMarkingMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
      />

      {/* Waypoint Marking Mode Indicator Pill */}
      {isMarkingMode && (
        <div
          style={{
            backgroundColor: themeTokens.panelBg,
            borderColor: "#E86A33",
            color: themeTokens.textPrimary,
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 border rounded-[2px] font-mono text-[10.5px] font-bold flex items-center gap-2 shadow-xl pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#E86A33] animate-pulse" />
          <span className="text-[#E86A33]">{nextWaypointPrompt}</span>
          <span style={{ color: themeTokens.textSecondary }}>
            · Drag/Scroll anytime to pan &amp; zoom
          </span>
        </div>
      )}

      {/* Bottom-Right Docked Map Scale Bar (Matching UI1.figcraft) */}
      <div
        style={{
          backgroundColor: themeTokens.panelBg,
          borderColor: themeTokens.borderColor,
        }}
        className="absolute bottom-3 right-3 z-20 min-w-[316px] h-[28px] border rounded-[2px] px-3 flex items-center justify-between gap-3 pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-[40px] h-[2px] bg-[#F8FAFC] shrink-0" />
          <span
            style={{ color: themeTokens.textPrimary }}
            className="font-mono text-[10px] font-bold"
          >
            {mapScaleText}
          </span>
        </div>
        <span
          style={{ color: themeTokens.textSecondary }}
          className="font-mono text-[10px] font-bold"
        >
          | &nbsp;{cursorSample.lat.toFixed(4)} N &nbsp;
          {cursorSample.lon.toFixed(4)} E &nbsp;
          {cursorSample.elevationM !== null
            ? `${Math.round(cursorSample.elevationM)} m`
            : "-2568 m"}
        </span>
      </div>
    </div>
  );
}
