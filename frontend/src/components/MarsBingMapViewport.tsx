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
import ScaleLine from "ol/control/ScaleLine";
import { defaults as defaultControls } from "ol/control/defaults";
import { Circle as CircleStyle, Fill, Icon, Stroke, Style, Text } from "ol/style";
import BaseLayer from "ol/layer/Base";
import Draw from "ol/interaction/Draw";

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
import { EvaRouteResult } from "@/lib/marsRouting";
import { MarsTelemetrySnapshot } from "@/lib/marsTelemetry";
import { TerrainSample, getTerrainGrid, DrawnProfileResult, computeLineElevationProfile } from "@/lib/marsTerrain";
import { LayerState } from "./MarsFloatingRightControls";
import { MapPickMode } from "./MarsFloatingLeftCard";

const GMAPS_BLUE_PIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="0 0 24 28">
      <filter id="p-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
      <!-- Symmetrical white teardrop pin pointing straight down -->
      <path d="M12 2C7.03 2 3 6.03 3 11c0 6.6 8.1 14.5 8.5 14.9.3.3.7.3 1 0 .4-.4 8.5-8.3 8.5-14.9 0-4.97-4.03-9-9-9z" fill="#ffffff" filter="url(#p-sh)"/>
      <!-- Blue Circle inside -->
      <circle cx="12" cy="11" r="6.8" fill="#0284c7"/>
      <!-- White Dot in Center -->
      <circle cx="12" cy="11" r="2.5" fill="#ffffff"/>
    </svg>`
  );

const VIEW_RESOLUTIONS = Array.from({ length: 17 }, (_, z) => 0.703125 / Math.pow(2, z));

interface MarsBingMapViewportProps {
  layerStates: Record<string, LayerState>;
  selectedPlace: ScienceTargetFeature;
  route: EvaRouteResult | null;
  showRoute: boolean;
  startCoord: [number, number];
  endCoord: [number, number];
  pickMode: MapPickMode;
  onMapPickCoord: (coord: [number, number]) => void;
  onSelectPlace: (place: ScienceTargetFeature) => void;
  telemetry: MarsTelemetrySnapshot;
  cameraRequest: { preset: CameraPreset; seq: number } | null;
  zoomSignal: { delta: number; seq: number } | null;
  hoverProfileCoord: [number, number] | null;
  showProbeHud: boolean;
  mapDimension?: "2D" | "3D";
  isDrawingLine?: boolean;
  onLiveDrawLine?: (result: DrawnProfileResult) => void;
  onFinishDrawLine?: (result: DrawnProfileResult) => void;
  drawnRouteCoords?: [number, number][] | null;
}

export function MarsBingMapViewport({
  layerStates,
  selectedPlace,
  route,
  showRoute,
  startCoord,
  endCoord,
  pickMode,
  onMapPickCoord,
  onSelectPlace,
  telemetry,
  cameraRequest,
  zoomSignal,
  hoverProfileCoord,
  showProbeHud,
  mapDimension = "2D",
  isDrawingLine = false,
  onLiveDrawLine,
  onFinishDrawLine,
  drawnRouteCoords,
}: MarsBingMapViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const layersMapRef = useRef<Record<string, BaseLayer>>({});
  const routeSourceRef = useRef<VectorSource | null>(null);
  const drawnSourceRef = useRef<VectorSource | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const onLiveDrawRef = useRef(onLiveDrawLine);
  const onFinishDrawRef = useRef(onFinishDrawLine);
  const safeRangeSourceRef = useRef<VectorSource | null>(null);
  const activePinSourceRef = useRef<VectorSource | null>(null);
  const hoverSourceRef = useRef<VectorSource | null>(null);

  const pickModeRef = useRef<MapPickMode>(pickMode);
  const onMapPickRef = useRef(onMapPickCoord);
  const onSelectPlaceRef = useRef(onSelectPlace);

  const [cursorSample, setCursorSample] = useState<TerrainSample | null>({
    inJezeroDem: true,
    lon: 77.4509,
    lat: 18.4446,
    elevationM: -2570,
    slopeDeg: 1.2,
    hazardType: null,
  });

  const [mapScale, setMapScale] = useState<{ widthPx: number; text: string }>({
    widthPx: 90,
    text: "50 km",
  });

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    onMapPickRef.current = onMapPickCoord;
  }, [onMapPickCoord]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

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

              // Fallback for USGS ArcGIS server bug where zoom 1 eastern hemisphere (x >= 2) returns 500 error:
              // Use zoom 2 corresponding quarter tile so eastern Mars never displays black holes
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

    const hazardFeatures = JEZERO_HAZARDS.features.map(
      (feat) =>
        new Feature({
          geometry: new Polygon(feat.geometry.coordinates),
          hazardProps: feat.properties,
        })
    );
    const hazardLayer = new VectorLayer({
      visible: layerStates.hazard_zones?.visible ?? true,
      opacity: layerStates.hazard_zones?.opacity ?? 0.8,
      source: new VectorSource({ features: hazardFeatures }),
      style: (feature) => {
        const props = feature.get("hazardProps");
        const isCritical = props?.severity === "critical";
        return new Style({
          stroke: new Stroke({
            color: isCritical ? "rgba(244, 63, 94, 0.85)" : "rgba(249, 115, 22, 0.85)",
            width: 1.6,
            lineDash: [5, 4],
          }),
          fill: new Fill({
            color: isCritical ? "rgba(244, 63, 94, 0.12)" : "rgba(249, 115, 22, 0.12)",
          }),
        });
      },
    });
    layerInstances.hazard_zones = hazardLayer;
    orderedLayers.push(hazardLayer);

    const safeRangeSource = new VectorSource();
    safeRangeSourceRef.current = safeRangeSource;
    orderedLayers.push(new VectorLayer({ source: safeRangeSource }));

    const routeSource = new VectorSource();
    routeSourceRef.current = routeSource;
    orderedLayers.push(new VectorLayer({ source: routeSource }));

    const drawnSource = new VectorSource();
    drawnSourceRef.current = drawnSource;
    const drawnLayer = new VectorLayer({
      source: drawnSource,
      style: [
        new Style({ stroke: new Stroke({ color: "rgba(2, 132, 199, 0.4)", width: 8 }) }),
        new Style({ stroke: new Stroke({ color: "#38bdf8", width: 3.5, lineDash: [8, 6] }) }),
      ],
    });
    orderedLayers.push(drawnLayer);

    // Bing-Maps-style place labels across Jezero & Global Mars
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
        // Hide dense Jezero POIs when zoomed all the way out to global view
        if (isJezero && resolution > 0.04 && pf.properties.id !== "hab-octavia") {
          return undefined;
        }
        return new Style({
          image: new Icon({
            src: GMAPS_BLUE_PIN_SVG,
            anchor: [0.5, 0.95],
            scale: 0.95,
          }),
          text: new Text({
            text: pf.properties.name,
            textAlign: "right",
            textBaseline: "middle",
            offsetX: -16,
            offsetY: -15,
            font: isJezero
              ? "700 12px 'Helvetica Neue', Helvetica, Arial, sans-serif"
              : "700 13px 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fill: new Fill({ color: "#ffffff" }),
            stroke: new Stroke({ color: "#000000", width: 3.5 }),
          }),
        });
      },
    });
    layerInstances.science_targets = placesLayer;
    orderedLayers.push(placesLayer);

    const activePinSource = new VectorSource();
    activePinSourceRef.current = activePinSource;
    orderedLayers.push(new VectorLayer({ source: activePinSource }));

    const hoverSource = new VectorSource();
    hoverSourceRef.current = hoverSource;
    orderedLayers.push(
      new VectorLayer({
        source: hoverSource,
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: "#38bdf8" }),
            stroke: new Stroke({ color: "#0f172a", width: 2 }),
          }),
        }),
      })
    );

    layersMapRef.current = layerInstances;

    const map = new Map({
      target: containerRef.current,
      layers: orderedLayers,
      controls: defaultControls({ attribution: false, zoom: false, rotate: false }).extend([
        new ScaleLine({
          units: "metric",
          bar: false,
          minWidth: 80,
        }),
      ]),
      view: new View({
        projection: marsProjection,
        center: [0, 0],
        zoom: 2.2,
        resolutions: VIEW_RESOLUTIONS,
        constrainResolution: false,
        extent: [-180, -90, 180, 90],
      }),
    });

    map.on("pointermove", (evt) => {
      if (evt.dragging) return;
      const [lon, lat] = evt.coordinate as [number, number];
      setCursorSample(terrainGrid.samplePoint(lon, lat));
    });

    map.on("singleclick", (evt) => {
      if (pickModeRef.current !== "inspect") {
        const [lon, lat] = evt.coordinate as [number, number];
        onMapPickRef.current([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
        return;
      }

      map.forEachFeatureAtPixel(
        evt.pixel,
        (feature) => {
          const pf = feature.get("placeFeature") as ScienceTargetFeature | undefined;
          if (pf) {
            onSelectPlaceRef.current(pf);
            return true;
          }
          return false;
        },
        { hitTolerance: 10 }
      );
    });

    const updateScaleBar = () => {
      const view = map.getView();
      const res = view.getResolution();
      if (!res) return;
      const center = view.getCenter() || [0, 0];
      const lat = center[1];
      const latRad = (lat * Math.PI) / 180;
      const metersPerDegree = MARS_METERS_PER_DEGREE * Math.cos(latRad);
      const metersPerPixel = res * metersPerDegree;

      // Fixed 140px bar: compute the exact ground distance represented by 140px
      const totalMeters = 140 * metersPerPixel;

      let text = "";
      if (totalMeters >= 100_000) {
        text = `${Math.round(totalMeters / 1000)} km`;
      } else if (totalMeters >= 10_000) {
        text = `${(totalMeters / 1000).toFixed(1)} km`;
      } else if (totalMeters >= 1000) {
        text = `${(totalMeters / 1000).toFixed(2)} km`;
      } else if (totalMeters >= 10) {
        text = `${Math.round(totalMeters)} m`;
      } else {
        text = `${totalMeters.toFixed(1)} m`;
      }

      setMapScale({ widthPx: 140, text });
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

  useEffect(() => {
    for (const [id, st] of Object.entries(layerStates)) {
      const layer = layersMapRef.current[id];
      if (layer) {
        layer.setVisible(st.visible);
        layer.setOpacity(st.opacity);
      }
    }
  }, [layerStates]);

  // Active Bing-Maps-style Red Pin
  useEffect(() => {
    const src = activePinSourceRef.current;
    if (!src) return;
    src.clear();

    const pin = new Feature({ geometry: new Point(selectedPlace.geometry.coordinates) });
    pin.setStyle(
      new Style({
        image: new Icon({
          src: GMAPS_BLUE_PIN_SVG,
          anchor: [0.5, 0.95],
          scale: 1.25,
        }),
        text: new Text({
          text: `${selectedPlace.properties.name}\n${selectedPlace.properties.region ?? "Mars"}`,
          textAlign: "right",
          textBaseline: "middle",
          offsetX: -18,
          offsetY: -20,
          font: "700 13px 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fill: new Fill({ color: "#ffffff" }),
          stroke: new Stroke({ color: "#000000", width: 4 }),
        }),
      })
    );
    src.addFeature(pin);
  }, [selectedPlace]);

  // Route polyline (visible when Directions mode/route active)
  useEffect(() => {
    const src = routeSourceRef.current;
    if (!src) return;
    src.clear();
    if (!showRoute || !route) return;

    const directFeature = new Feature({
      geometry: new LineString(route.directCoordinates),
    });
    directFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: "rgba(244, 63, 94, 0.55)",
          width: 2,
          lineDash: [5, 5],
        }),
      })
    );
    src.addFeature(directFeature);

    const optFeature = new Feature({
      geometry: new LineString(route.coordinates),
    });
    optFeature.setStyle([
      new Style({ stroke: new Stroke({ color: "rgba(14, 165, 233, 0.35)", width: 8 }) }),
      new Style({ stroke: new Stroke({ color: "#0ea5e9", width: 3.5 }) }),
    ]);
    src.addFeature(optFeature);

    const startPin = new Feature({ geometry: new Point(startCoord) });
    startPin.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#10b981" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      })
    );
    src.addFeature(startPin);

    const endPin = new Feature({ geometry: new Point(endCoord) });
    endPin.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: "#f97316" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      })
    );
    src.addFeature(endPin);
  }, [showRoute, route, startCoord, endCoord]);

  // Safe EVA range ring
  useEffect(() => {
    const src = safeRangeSourceRef.current;
    if (!src) return;
    src.clear();
    if (telemetry.maxSafeRangeM <= 0) return;
    const ring = buildMarsCircleRing(77.4509, 18.4446, telemetry.maxSafeRangeM);
    if (ring.length === 0) return;

    const circleFeature = new Feature({ geometry: new Polygon([ring]) });
    circleFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color:
            telemetry.evaStatus === "CAUTION"
              ? "rgba(245, 158, 11, 0.85)"
              : "rgba(16, 185, 129, 0.4)",
          width: 1.6,
          lineDash: [7, 6],
        }),
      })
    );
    src.addFeature(circleFeature);
  }, [telemetry.maxSafeRangeM, telemetry.evaStatus]);

  useEffect(() => {
    if (!cameraRequest || !mapRef.current) return;
    mapRef.current.getView().animate({
      center: cameraRequest.preset.center,
      zoom: cameraRequest.preset.zoom,
      duration: 600,
    });
  }, [cameraRequest]);

  useEffect(() => {
    if (!zoomSignal || !mapRef.current) return;
    const view = mapRef.current.getView();
    const cur = view.getZoom() ?? 11;
    view.animate({ zoom: cur + zoomSignal.delta, duration: 220 });
  }, [zoomSignal]);

  useEffect(() => {
    onLiveDrawRef.current = onLiveDrawLine;
  }, [onLiveDrawLine]);

  useEffect(() => {
    onFinishDrawRef.current = onFinishDrawLine;
  }, [onFinishDrawLine]);

  // NASA Trek Interactive Draw Line Tool
  useEffect(() => {
    const map = mapRef.current;
    const drawnSource = drawnSourceRef.current;
    if (!map || !drawnSource) return;

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (isDrawingLine) {
      drawnSource.clear();
      const draw = new Draw({
        source: drawnSource,
        type: "LineString",
        stopClick: true,
        style: [
          new Style({
            stroke: new Stroke({ color: "rgba(2, 132, 199, 0.4)", width: 7 }),
          }),
          new Style({
            stroke: new Stroke({ color: "#38bdf8", width: 3.5, lineDash: [8, 6] }),
          }),
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "#0284c7" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          }),
        ],
      });

      let sketchGeom: LineString | null = null;
      let lastThrottleTime = 0;

      draw.on("drawstart", (evt) => {
        sketchGeom = evt.feature.getGeometry() as LineString;
        if (sketchGeom) {
          sketchGeom.on("change", () => {
            const now = performance.now();
            if (now - lastThrottleTime < 40) return; // 25 FPS super responsive update
            lastThrottleTime = now;
            if (!sketchGeom) return;
            const coords = sketchGeom.getCoordinates() as [number, number][];
            if (coords && coords.length >= 2) {
              const liveProfile = computeLineElevationProfile(coords);
              onLiveDrawRef.current?.(liveProfile);
            }
          });
        }
      });

      draw.on("drawend", (evt) => {
        sketchGeom = null;
        const geom = evt.feature.getGeometry() as LineString;
        if (geom) {
          const coords = geom.getCoordinates() as [number, number][];
          const result = computeLineElevationProfile(coords);
          onFinishDrawRef.current?.(result);
        }
      });

      map.addInteraction(draw);
      drawInteractionRef.current = draw;
    }

    return () => {
      if (drawInteractionRef.current && mapRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current = null;
      }
    };
  }, [isDrawingLine]);

  useEffect(() => {
    if (drawnRouteCoords === null && drawnSourceRef.current) {
      drawnSourceRef.current.clear();
    }
  }, [drawnRouteCoords]);

  useEffect(() => {
    const src = hoverSourceRef.current;
    if (!src) return;
    src.clear();
    if (hoverProfileCoord) {
      src.addFeature(new Feature({ geometry: new Point(hoverProfileCoord) }));
    }
  }, [hoverProfileCoord]);

  return (
    <div className={`relative flex-1 w-full h-full bg-[#090c12] overflow-hidden ${mapDimension === "3D" ? "mars-viewport-3d" : "mars-viewport-2d"}`}>
      <div
        ref={containerRef}
        className={`w-full h-full ${
          isDrawingLine
            ? "cursor-crosshair"
            : pickMode !== "inspect"
              ? "cursor-crosshair"
              : "cursor-grab"
        }`}
      />

      {pickMode !== "inspect" && !isDrawingLine && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-lg border border-sky-300 pointer-events-none">
          Click inside Jezero EVA Grid to set{" "}
          {pickMode === "pick_start" ? "START (Habitat)" : "DESTINATION"}
        </div>
      )}

      {/* NASA Trek Scale Bar & Cursor Status Bar */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-none select-none">
        {/* Scale Line Bar */}
        <div className="flex flex-col items-end">
          <span className="text-[12px] font-bold text-white font-mono [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)] mb-0.5">
            {mapScale.text}
          </span>
          <div
            className="w-[140px] h-2.5 border-b-2 border-l-2 border-r-2 border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
          />
        </div>

        {/* Lat, Lon & Elev */}
        {showProbeHud && cursorSample && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)] font-semibold">
            <span>Lat: {cursorSample.lat.toFixed(5)}°,</span>
            <span>Lon: {cursorSample.lon.toFixed(5)}°,</span>
            <span className="text-sky-300">
              Elev: {cursorSample.elevationM != null ? `${cursorSample.elevationM}m` : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Clean Bing-Maps-style Bottom-Right Attribution Bar (hidden) */}
    </div>
  );
}

