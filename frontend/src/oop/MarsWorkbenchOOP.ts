/**
 * Marswalk Explorer — Object-Oriented Programming (OOP) Domain & UI Architecture
 * Coordinates real OpenLayers IAU_2015:49900 mapping, A* / DEM terrain sampling,
 * multi-point Start -> Second -> End waypoint chaining, PLSS Suit O2 estimation,
 * NASA JPL 24h solar ephemeris, and Dark/Light theme management.
 */

import { marsDistanceM } from "@/lib/marsCrs";
import {
  ALL_MARS_PLACES,
  JEZERO_SCIENCE_TARGETS,
  NASA_LAYERS,
  ScienceTargetFeature,
} from "@/lib/marsData";
import { PlannerMode, planEvaRoute } from "@/lib/marsRouting";
import { computeMarsSunAngles, SunAnglePoint } from "@/lib/marsSunAngle";
import {
  ConditionScenario,
  getTelemetrySnapshot,
  MarsTelemetrySnapshot,
  RealWeather,
} from "@/lib/marsTelemetry";
import { getTerrainGrid } from "@/lib/marsTerrain";

export type WorkbenchThemeMode = "dark" | "light";
export type WorkbenchTabId = "overview" | "route" | "science";
export type BasemapId = "mola_clrshade" | "jezero_ctx_6m" | "viking_mdim21";
export type SlopeRiskLevel = "safe" | "caution" | "hazard";

export interface ThemeTokens {
  mode: WorkbenchThemeMode;
  canvasBg: string;
  subHeaderBg: string;
  panelBg: string;
  cardBg: string;
  controlBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  chartGrid: string;
}

/**
 * 1. OOP ThemeController: Manages Dark / Light Aerospace Lab Workbench Palettes
 */
export class ThemeController {
  private currentMode: WorkbenchThemeMode;

  private static readonly DARK_TOKENS: ThemeTokens = {
    mode: "dark",
    canvasBg: "#010409",
    subHeaderBg: "#161B22",
    panelBg: "#0D1117",
    cardBg: "#161B22",
    controlBg: "#21262D",
    borderColor: "#30363D",
    textPrimary: "#E6EDF3",
    textSecondary: "#848D97",
    textMuted: "#656C76",
    chartGrid: "#21262D",
  };

  private static readonly LIGHT_TOKENS: ThemeTokens = {
    mode: "light",
    canvasBg: "#E2E8F0",
    subHeaderBg: "#F1F5F9",
    panelBg: "#FFFFFF",
    cardBg: "#F8FAFC",
    controlBg: "#F1F5F9",
    borderColor: "#CBD5E1",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    chartGrid: "#E2E8F0",
  };

  constructor(initialMode: WorkbenchThemeMode = "dark") {
    this.currentMode = initialMode;
  }

  public getMode(): WorkbenchThemeMode {
    return this.currentMode;
  }

  public getTokens(): ThemeTokens {
    return this.currentMode === "dark"
      ? ThemeController.DARK_TOKENS
      : ThemeController.LIGHT_TOKENS;
  }
}

/**
 * 2. OOP Basemap Hierarchy: Abstract BasemapLayerDescriptor & BasemapRegistry
 */
export abstract class BasemapLayerDescriptor {
  public readonly id: BasemapId;
  public readonly title: string;
  public readonly subtitle: string;
  public readonly activeSubtitle: string;
  public readonly thumbnailUrl: string;

  constructor(
    id: BasemapId,
    title: string,
    subtitle: string,
    activeSubtitle: string,
    thumbnailUrl: string
  ) {
    this.id = id;
    this.title = title;
    this.subtitle = subtitle;
    this.activeSubtitle = activeSubtitle;
    this.thumbnailUrl = thumbnailUrl;
  }

  public abstract toOpenLayersState(): Record<
    string,
    { visible: boolean; opacity: number }
  >;
}

export class MolaShadedReliefBasemap extends BasemapLayerDescriptor {
  constructor() {
    super(
      "mola_clrshade",
      "MOLA Color Shaded Relief",
      "463 m/px DEM Elevation",
      "ACTIVE · 463 m/px DEM",
      "/figcraft/e9e6998bff23bb17fc15fd412e04631f4866c1c35ed54e1310a61d225f9b0cec.png"
    );
  }

  public override toOpenLayersState() {
    return {
      mola_clrshade: { visible: true, opacity: 1.0 },
      viking_mdim21: { visible: false, opacity: 1.0 },
      ctx_global_5m: { visible: false, opacity: 1.0 },
      jezero_trek_ctx_6m: { visible: false, opacity: 1.0 },
      jezero_slope_overlay: { visible: false, opacity: 0.35 },
      science_targets: { visible: true, opacity: 1.0 },
      hazard_zones: { visible: true, opacity: 0.9 },
    };
  }
}

export class MroCtxOrthoBasemap extends BasemapLayerDescriptor {
  constructor() {
    super(
      "jezero_ctx_6m",
      "MRO CTX 6m OrthoMosaic",
      "6 m/px Jezero",
      "ACTIVE · 6 m/px Jezero",
      "/figcraft/0a1b3515a5bef91e2c28037dc2236956cb7dc11d5e30274a7492c50173b4f4ec.png"
    );
  }

  public override toOpenLayersState() {
    return {
      mola_clrshade: { visible: false, opacity: 1.0 },
      viking_mdim21: { visible: false, opacity: 1.0 },
      ctx_global_5m: { visible: false, opacity: 1.0 },
      jezero_trek_ctx_6m: { visible: true, opacity: 1.0 },
      jezero_slope_overlay: { visible: false, opacity: 0.35 },
      science_targets: { visible: true, opacity: 1.0 },
      hazard_zones: { visible: true, opacity: 0.9 },
    };
  }
}

export class VikingColorBasemap extends BasemapLayerDescriptor {
  constructor() {
    super(
      "viking_mdim21",
      "Viking Color MDIM 2.1",
      "232 m/px True Color",
      "ACTIVE · 232 m/px Color",
      "/figcraft/493c68cb53814a8e7990897b53e683c568986981716ebbac76e01e788d19204e.png"
    );
  }

  public override toOpenLayersState() {
    return {
      mola_clrshade: { visible: false, opacity: 1.0 },
      viking_mdim21: { visible: true, opacity: 1.0 },
      ctx_global_5m: { visible: false, opacity: 1.0 },
      jezero_trek_ctx_6m: { visible: false, opacity: 1.0 },
      jezero_slope_overlay: { visible: false, opacity: 0.35 },
      science_targets: { visible: true, opacity: 1.0 },
      hazard_zones: { visible: true, opacity: 0.9 },
    };
  }
}

export class BasemapRegistry {
  private readonly layers: Map<BasemapId, BasemapLayerDescriptor>;
  private activeId: BasemapId;

  constructor(initialId: BasemapId = "viking_mdim21") {
    this.layers = new Map<BasemapId, BasemapLayerDescriptor>([
      ["mola_clrshade", new MolaShadedReliefBasemap()],
      ["jezero_ctx_6m", new MroCtxOrthoBasemap()],
      ["viking_mdim21", new VikingColorBasemap()],
    ]);
    this.activeId = initialId;
  }

  public getAllBasemaps(): BasemapLayerDescriptor[] {
    return Array.from(this.layers.values());
  }

  public getActiveBasemap(): BasemapLayerDescriptor {
    return this.layers.get(this.activeId) ?? this.layers.get("viking_mdim21")!;
  }

  public static getLayerCount(): number {
    return NASA_LAYERS.length;
  }
}

/**
 * 3. OOP Waypoint & Segment Models (Real Mars Lon/Lat Coordinates)
 */
export interface WaypointInput {
  id: string;
  label: string;
  lon: number;
  lat: number;
}

export class WaypointNode {
  public readonly index: number;
  public readonly id: string;
  public readonly label: string;
  public readonly roleTag: string;
  public readonly lon: number;
  public readonly lat: number;
  public readonly elevationM: number;
  public readonly slopeDeg: number;
  public readonly cumulativeDistanceKm: number;
  public readonly badgeColor: string;
  public readonly metaColor: string;

  constructor(params: {
    index: number;
    id: string;
    label: string;
    roleTag: string;
    lon: number;
    lat: number;
    elevationM: number;
    slopeDeg: number;
    cumulativeDistanceKm: number;
    badgeColor: string;
    metaColor: string;
  }) {
    this.index = params.index;
    this.id = params.id;
    this.label = params.label;
    this.roleTag = params.roleTag;
    this.lon = params.lon;
    this.lat = params.lat;
    this.elevationM = params.elevationM;
    this.slopeDeg = params.slopeDeg;
    this.cumulativeDistanceKm = params.cumulativeDistanceKm;
    this.badgeColor = params.badgeColor;
    this.metaColor = params.metaColor;
  }

  public get coordinates(): [number, number] {
    return [this.lon, this.lat];
  }
}

export class RouteSegment {
  public readonly fromIndex: number;
  public readonly toIndex: number;
  public readonly coordinates: [number, number][];
  public readonly distanceM: number;
  public readonly maxSlopeDeg: number;
  public readonly riskLevel: SlopeRiskLevel;
  public readonly strokeColor: string;
  public readonly subLegs: {
    coords: [[number, number], [number, number]];
    slopeDeg: number;
    color: string;
  }[];

  constructor(params: {
    fromIndex: number;
    toIndex: number;
    coordinates: [number, number][];
    distanceM: number;
    maxSlopeDeg: number;
    subLegs: {
      coords: [[number, number], [number, number]];
      slopeDeg: number;
      color: string;
    }[];
  }) {
    this.fromIndex = params.fromIndex;
    this.toIndex = params.toIndex;
    this.coordinates = params.coordinates;
    this.distanceM = params.distanceM;
    this.maxSlopeDeg = params.maxSlopeDeg;
    this.riskLevel = RouteSegment.classifySlope(this.maxSlopeDeg);
    this.strokeColor = RouteSegment.getColorForRisk(this.riskLevel);
    this.subLegs = params.subLegs;
  }

  public static classifySlope(
    slopeDeg: number,
    cautionThreshold = 10.0,
    hazardThreshold = 15.0
  ): SlopeRiskLevel {
    if (slopeDeg > hazardThreshold) return "hazard";
    if (slopeDeg >= cautionThreshold) return "caution";
    return "safe";
  }

  public static getColorForRisk(risk: SlopeRiskLevel): string {
    if (risk === "hazard") return "#EF4444";
    if (risk === "caution") return "#F59E0B";
    return "#22C55E";
  }
}

export interface ProfileSamplePoint {
  distanceM: number;
  distanceKm: number;
  elevationM: number;
  slopeDeg: number;
  riskLevel: SlopeRiskLevel;
  color: string;
  lon: number;
  lat: number;
}

export interface ComputedRouteModel {
  nodes: WaypointNode[];
  segments: RouteSegment[];
  profileSamples: ProfileSamplePoint[];
  totalDistanceM: number;
  totalDistanceKm: number;
  minElevationM: number;
  maxElevationM: number;
  targetElevationM: number;
  totalAscentM: number;
  maxSlopeDeg: number;
  peakSlopeDistanceKm: number;
  walkMinutes: number;
  slopeDistribution: {
    safePct: number;
    cautionPct: number;
    hazardPct: number;
  };
  overallRisk: SlopeRiskLevel;
  exceedsLimit: boolean;
}

export interface CorridorPresetSpec {
  id: string;
  title: string;
  targetId: string;
  waypoints: WaypointInput[];
}

/**
 * 4. OOP SuitLifeSupportModel: Computes real Suit O2 Reserve Fuel Gauge from active route
 */
export class SuitLifeSupportModel {
  private readonly baselineReservePct: number;
  private readonly capacityMinutes: number;

  constructor(baselineReservePct = 84, capacityMinutes = 370) {
    this.baselineReservePct = baselineReservePct;
    this.capacityMinutes = capacityMinutes;
  }

  public evaluate(
    route: ComputedRouteModel,
    isEmergency: boolean
  ) {
    const startPct = isEmergency ? 66 : this.baselineReservePct;
    const totalMin = Math.round((startPct / 100) * this.capacityMinutes);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;

    // Physical PLSS O2 consumption proportional to walk time, ascent & steep terrain
    const rawCost =
      route.nodes.length < 2
        ? 0
        : Math.max(
            4,
            Math.min(
              62,
              Math.round(
                route.totalDistanceKm * 6.4 +
                  route.totalAscentM * 0.03 +
                  (route.maxSlopeDeg > 15 ? 2.5 : 0)
              )
            )
          );

    const tripO2CostPct = isEmergency ? Math.max(8, Math.min(22, rawCost)) : rawCost;
    const returnMarginPct = Math.max(0, startPct - tripO2CostPct);
    const marginStatus =
      returnMarginPct >= 45
        ? "SAFE"
        : returnMarginPct >= 25
          ? "CAUTION"
          : "CRITICAL";

    const batteryPct = Math.max(
      52,
      Math.min(100, isEmergency ? 78 : Math.round(100 - route.totalDistanceKm * 1.8))
    );

    return {
      headerReserveText: `${startPct}% · ${hrs}h ${String(mins).padStart(2, "0")}m`,
      cyanWidthPct: returnMarginPct,
      orangeWidthPct: tripO2CostPct,
      tripO2CostPct,
      returnMarginPct,
      marginStatus,
      batteryPct,
      footerLeftText: isEmergency
        ? `Return Est: -${tripO2CostPct}% O2`
        : `Trip Est: -${tripO2CostPct}% O2`,
      footerRightText: isEmergency
        ? `At Hab: ${returnMarginPct}% (OK)`
        : `Return Margin: ${returnMarginPct}% (${marginStatus})`,
    };
  }
}

/**
 * 5. OOP SolarEphemerisModel: 24h NASA JPL Mars Solar Geometry
 */
export class SolarEphemerisModel {
  private readonly samples: SunAnglePoint[];
  public readonly currentHour = 13.4; // 13:24 LMST

  constructor(latDeg = 18.4446, lonDeg = 77.4509, realSamples?: SunAnglePoint[] | null) {
    this.samples =
      realSamples && realSamples.length >= 2
        ? realSamples
        : computeMarsSunAngles(latDeg, lonDeg);
  }

  public getSamples(): SunAnglePoint[] {
    return this.samples;
  }

  public getCurrentAtLmst(): { azimuthDeg: number; elevationDeg: number } {
    const h13 = this.samples[13] ?? { azimuthDeg: 318, elevationDeg: 52 };
    const h14 = this.samples[14] ?? h13;
    const az = Math.round(h13.azimuthDeg + (h14.azimuthDeg - h13.azimuthDeg) * 0.4);
    const el = Math.round(h13.elevationDeg + (h14.elevationDeg - h13.elevationDeg) * 0.4);
    return {
      azimuthDeg: az,
      elevationDeg: el,
    };
  }
}

/**
 * 6. OOP EVARoutePlannerController: Real A* & Multi-Point Terrain Evaluator
 */
export class EVARoutePlannerController {
  public static readonly CORRIDOR_PRESETS: CorridorPresetSpec[] = [
    {
      id: "corridor-kodiak",
      title: "Hab -> Kodiak Butte (4 pts)",
      targetId: "kodiak-butte",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "South Basin Turn", lon: 77.4395, lat: 18.4355 },
        { id: "wp-3", label: "Kodiak Apron", lon: 77.4285, lat: 18.4295 },
        { id: "wp-4", label: "Kodiak Butte", lon: 77.419, lat: 18.431 },
      ],
    },
    {
      id: "corridor-hawksbill",
      title: "Hab -> Hawksbill Delta (4 pts)",
      targetId: "delta-front-hawksbill",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "North Flat Turn", lon: 77.4375, lat: 18.454 },
        { id: "wp-3", label: "Delta Ridge Climb", lon: 77.4215, lat: 18.4625 },
        { id: "wp-4", label: "Hawksbill Delta Front", lon: 77.405, lat: 18.458 },
      ],
    },
    {
      id: "corridor-belva",
      title: "Hab -> Belva Crater Rim (5 pts)",
      targetId: "belva-rim",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "North Ridge Pass", lon: 77.436, lat: 18.4555 },
        { id: "wp-3", label: "Upper Delta Apron", lon: 77.421, lat: 18.464 },
        { id: "wp-4", label: "Belva Outer Bench", lon: 77.404, lat: 18.4685 },
        { id: "wp-5", label: "Belva Crater Rim", lon: 77.392, lat: 18.472 },
      ],
    },
    {
      id: "corridor-seitah",
      title: "Hab -> Séítah Ridge (4 pts)",
      targetId: "seitah-north",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "South Máaz Basin", lon: 77.443, lat: 18.4405 },
        { id: "wp-3", label: "Séítah East Bench", lon: 77.437, lat: 18.4395 },
        { id: "wp-4", label: "Séítah Olivine Ridge", lon: 77.434, lat: 18.4385 },
      ],
    },
    {
      id: "corridor-carbonate",
      title: "Hab -> Margin Carbonates (5 pts)",
      targetId: "margin-carbonate",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "North Flat Turn", lon: 77.4375, lat: 18.454 },
        { id: "wp-3", label: "Delta North Bypass", lon: 77.418, lat: 18.47 },
        { id: "wp-4", label: "Carbonate Terrace", lon: 77.399, lat: 18.4795 },
        { id: "wp-5", label: "Margin Carbonate Unit", lon: 77.386, lat: 18.486 },
      ],
    },
    {
      id: "corridor-neretva",
      title: "Hab -> Neretva Vallis (5 pts)",
      targetId: "neretva-channel",
      waypoints: [
        { id: "wp-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
        { id: "wp-2", label: "North Ridge Pass", lon: 77.436, lat: 18.4555 },
        { id: "wp-3", label: "Upper Delta Canyon", lon: 77.412, lat: 18.4735 },
        { id: "wp-4", label: "Neretva River Breach", lon: 77.389, lat: 18.484 },
        { id: "wp-5", label: "Neretva Vallis Inlet", lon: 77.372, lat: 18.492 },
      ],
    },
  ];

  public static readonly SAFE_DETOUR_PRESET: WaypointInput[] = [
    { id: "det-1", label: "Octavia Hab Base", lon: 77.4509, lat: 18.4446 },
    { id: "det-2", label: "North Flat Basin", lon: 77.442, lat: 18.4635 },
    { id: "det-3", label: "Low-Grade Pass", lon: 77.421, lat: 18.4685 },
    { id: "det-4", label: "Hawksbill Delta Front", lon: 77.405, lat: 18.458 },
  ];

  public static readonly EMERGENCY_RETURN_WAYPOINTS: WaypointInput[] = [
    { id: "em-1", label: "Hawksbill Field Pos", lon: 77.405, lat: 18.458 },
    { id: "em-2", label: "Safe Bypass Turn", lon: 77.429, lat: 18.449 },
    { id: "em-3", label: "Octavia Hab Airlock", lon: 77.4509, lat: 18.4446 },
  ];

  public static computeRoute(
    waypoints: WaypointInput[],
    mode: PlannerMode,
    maxSlopeLimitDeg: number,
    useAStar = true
  ): ComputedRouteModel {
    const grid = getTerrainGrid();

    if (waypoints.length === 0) {
      return {
        nodes: [],
        segments: [],
        profileSamples: [],
        totalDistanceM: 0,
        totalDistanceKm: 0,
        minElevationM: -2568,
        maxElevationM: -2568,
        targetElevationM: -2568,
        totalAscentM: 0,
        maxSlopeDeg: 0,
        peakSlopeDistanceKm: 0,
        walkMinutes: 0,
        slopeDistribution: { safePct: 100, cautionPct: 0, hazardPct: 0 },
        overallRisk: "safe",
        exceedsLimit: false,
      };
    }

    if (waypoints.length === 1) {
      const wp = waypoints[0];
      const s = grid.samplePoint(wp.lon, wp.lat);
      const elev = Math.round(s.elevationM ?? -2568);
      const slp = Number((s.slopeDeg ?? 0).toFixed(1));
      const node = new WaypointNode({
        index: 1,
        id: wp.id,
        label: "Start",
        roleTag: "Start",
        lon: wp.lon,
        lat: wp.lat,
        elevationM: elev,
        slopeDeg: slp,
        cumulativeDistanceKm: 0,
        badgeColor: "#22C55E",
        metaColor: "#94A3B8",
      });
      return {
        nodes: [node],
        segments: [],
        profileSamples: [
          {
            distanceM: 0,
            distanceKm: 0,
            elevationM: elev,
            slopeDeg: slp,
            riskLevel: "safe",
            color: "#22C55E",
            lon: wp.lon,
            lat: wp.lat,
          },
        ],
        totalDistanceM: 0,
        totalDistanceKm: 0,
        minElevationM: elev,
        maxElevationM: elev,
        targetElevationM: elev,
        totalAscentM: 0,
        maxSlopeDeg: slp,
        peakSlopeDistanceKm: 0,
        walkMinutes: 0,
        slopeDistribution: { safePct: 100, cautionPct: 0, hazardPct: 0 },
        overallRisk: "safe",
        exceedsLimit: false,
      };
    }

    const segments: RouteSegment[] = [];
    const profileSamples: ProfileSamplePoint[] = [];
    const nodeCumDistKm: number[] = [0];
    const nodeMaxSlopes: number[] = [
      Number((grid.samplePoint(waypoints[0].lon, waypoints[0].lat).slopeDeg ?? 0).toFixed(1)),
    ];

    let totalDistanceM = 0;
    let totalAscentM = 0;
    let maxSlopeSeen = 0;
    let peakSlopeDistanceKm = 0;

    // Cap total profile samples so very long legs (e.g. 5000+ km) stay renderable.
    let approxLenM = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      approxLenM += marsDistanceM(
        waypoints[i].lon,
        waypoints[i].lat,
        waypoints[i + 1].lon,
        waypoints[i + 1].lat
      );
    }
    const sampleStepM = Math.max(45, approxLenM / 480);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      let legCoords: [number, number][] = [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ];

      // Run real A* terrain pathfinder inside Jezero DEM
      if (
        useAStar &&
        grid.inBounds(from.lon, from.lat) &&
        grid.inBounds(to.lon, to.lat)
      ) {
        try {
          let astar;
          try {
            astar = planEvaRoute(
              from.lon,
              from.lat,
              to.lon,
              to.lat,
              mode,
              mode === "safest" ? maxSlopeLimitDeg : Math.max(20, maxSlopeLimitDeg + 4)
            );
          } catch {
            astar = planEvaRoute(
              from.lon,
              from.lat,
              to.lon,
              to.lat,
              mode,
              26
            );
          }
          if (astar.coordinates.length >= 2) {
            // Preserve exact clicked start/end coordinates + smoothed A* spine
            const step = Math.max(1, Math.floor(astar.coordinates.length / 10));
            const spine: [number, number][] = [[from.lon, from.lat]];
            for (let k = step; k < astar.coordinates.length - 1; k += step) {
              spine.push(astar.coordinates[k]);
            }
            spine.push([to.lon, to.lat]);
            legCoords = spine;
          }
        } catch {
          legCoords = [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ];
        }
      }

      let legDistM = 0;
      let legMaxSlope = 0;
      const subLegs: {
        coords: [[number, number], [number, number]];
        slopeDeg: number;
        color: string;
      }[] = [];

      // Sample along every sub-leg so slope colors reflect actual terrain
      for (let k = 0; k < legCoords.length - 1; k++) {
        const [lon1, lat1] = legCoords[k];
        const [lon2, lat2] = legCoords[k + 1];
        const segD = marsDistanceM(lon1, lat1, lon2, lat2);
        const subSteps = Math.min(600, Math.max(3, Math.ceil(segD / sampleStepM)));

        let subLegPeakSlope = 0;
        for (let s = 0; s <= subSteps; s++) {
          const t = s / subSteps;
          const lon = lon1 + (lon2 - lon1) * t;
          const lat = lat1 + (lat2 - lat1) * t;
          const sample = grid.samplePoint(lon, lat);
          const elev = Math.round(sample.elevationM ?? -2540);
          const slp = Number((sample.slopeDeg ?? 4.5).toFixed(1));
          const stepD = s === 0 ? 0 : segD / subSteps;
          totalDistanceM += stepD;
          legDistM += stepD;

          if (slp > subLegPeakSlope) subLegPeakSlope = slp;
          if (slp > legMaxSlope) legMaxSlope = slp;
          if (slp > maxSlopeSeen) {
            maxSlopeSeen = slp;
            peakSlopeDistanceKm = Number((totalDistanceM / 1000).toFixed(2));
          }

          if (profileSamples.length > 0) {
            const prevElev = profileSamples[profileSamples.length - 1].elevationM;
            if (elev > prevElev) totalAscentM += elev - prevElev;
          }

          const risk = RouteSegment.classifySlope(slp, 10, 15);
          if (s > 0 || (i === 0 && k === 0)) {
            profileSamples.push({
              distanceM: Math.round(totalDistanceM),
              distanceKm: Number((totalDistanceM / 1000).toFixed(2)),
              elevationM: elev,
              slopeDeg: slp,
              riskLevel: risk,
              color: RouteSegment.getColorForRisk(risk),
              lon,
              lat,
            });
          }
        }

        const subRisk = RouteSegment.classifySlope(subLegPeakSlope, 10, 15);
        subLegs.push({
          coords: [
            [lon1, lat1],
            [lon2, lat2],
          ],
          slopeDeg: Number(subLegPeakSlope.toFixed(1)),
          color: RouteSegment.getColorForRisk(subRisk),
        });
      }

      nodeCumDistKm.push(Number((totalDistanceM / 1000).toFixed(2)));
      nodeMaxSlopes.push(Number(legMaxSlope.toFixed(1)));

      segments.push(
        new RouteSegment({
          fromIndex: i + 1,
          toIndex: i + 2,
          coordinates: legCoords,
          distanceM: Math.round(legDistM),
          maxSlopeDeg: Number(legMaxSlope.toFixed(1)),
          subLegs,
        })
      );
    }

    const nodes: WaypointNode[] = waypoints.map((wp, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === waypoints.length - 1;
      const sample = grid.samplePoint(wp.lon, wp.lat);
      const elev = Math.round(sample.elevationM ?? -2540);
      const segSlp = nodeMaxSlopes[idx] ?? 0;
      const risk = RouteSegment.classifySlope(segSlp, 10, 15);

      const computedLabel = isFirst
        ? "Start"
        : isLast
          ? "End"
          : `Point ${idx + 1}`;

      const roleTag = computedLabel;

      const badgeColor = isFirst
        ? "#22C55E"
        : isLast
          ? "#38BDF8"
          : RouteSegment.getColorForRisk(risk);

      const metaColor = isFirst
        ? "#94A3B8"
        : RouteSegment.getColorForRisk(risk);

      return new WaypointNode({
        index: idx + 1,
        id: wp.id,
        label: computedLabel,
        roleTag,
        lon: wp.lon,
        lat: wp.lat,
        elevationM: elev,
        slopeDeg: segSlp,
        cumulativeDistanceKm: nodeCumDistKm[idx] ?? 0,
        badgeColor,
        metaColor,
      });
    });

    const totalDistanceKm = Number((totalDistanceM / 1000).toFixed(2));
    const walkMinutes = Math.max(
      1,
      Math.round(totalDistanceM / 63 + totalAscentM * 0.08)
    );

    const nSamples = Math.max(1, profileSamples.length);
    const safePct = Math.round(
      (profileSamples.filter((p) => p.riskLevel === "safe").length / nSamples) * 100
    );
    const cautionPct = Math.round(
      (profileSamples.filter((p) => p.riskLevel === "caution").length / nSamples) * 100
    );
    const hazardPct = Math.max(0, 100 - safePct - cautionPct);

    let minElevationM = -2568;
    let maxElevationM = -2485;
    if (profileSamples.length > 0) {
      minElevationM = profileSamples[0].elevationM;
      maxElevationM = profileSamples[0].elevationM;
      for (const p of profileSamples) {
        if (Number.isFinite(p.elevationM)) {
          if (p.elevationM < minElevationM) minElevationM = p.elevationM;
          if (p.elevationM > maxElevationM) maxElevationM = p.elevationM;
        }
      }
    }
    const targetElevationM =
      nodes.length > 0 ? nodes[nodes.length - 1].elevationM : -2485;

    const overallRisk = RouteSegment.classifySlope(maxSlopeSeen, 10, 15);

    return {
      nodes,
      segments,
      profileSamples,
      totalDistanceM: Math.round(totalDistanceM),
      totalDistanceKm,
      minElevationM,
      maxElevationM,
      targetElevationM,
      totalAscentM: Math.round(totalAscentM),
      maxSlopeDeg: Number(maxSlopeSeen.toFixed(1)),
      peakSlopeDistanceKm,
      walkMinutes,
      slopeDistribution: { safePct, cautionPct, hazardPct },
      overallRisk,
      exceedsLimit: maxSlopeSeen > maxSlopeLimitDeg,
    };
  }

  public static getAllScienceTargets(): ScienceTargetFeature[] {
    return JEZERO_SCIENCE_TARGETS.features;
  }

  public static findPlaceByQuery(query: string): ScienceTargetFeature | undefined {
    const q = query.trim().toLowerCase();
    return ALL_MARS_PLACES.find(
      (p) =>
        p.properties.name.toLowerCase().includes(q) ||
        p.properties.category.toLowerCase().includes(q)
    );
  }

  public static getEnvironmentSnapshot(
    scenario: ConditionScenario,
    tick: number,
    realWeather?: RealWeather | null
  ): MarsTelemetrySnapshot {
    return getTelemetrySnapshot(scenario, tick, realWeather);
  }

  public static getPlannerModes(): { id: PlannerMode; label: string }[] {
    return [
      { id: "safest", label: "Safest" },
      { id: "balanced", label: "Balanced" },
      { id: "max_science", label: "Max Science" },
    ];
  }
}
