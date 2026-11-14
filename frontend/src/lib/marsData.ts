export type LayerCategory = "basemap" | "imagery" | "overlay" | "vector";

export interface MarsLayerConfig {
  id: string;
  title: string;
  mission: string;
  category: LayerCategory;
  protocol: "wmts" | "image_overlay" | "vector";
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  defaultOpacity: number;
  defaultVisible: boolean;
  crs: string;
  tileUrlTemplate?: string;
  /** Real upstream tile URL; the proxy at /api/tiles/... fetches this. */
  upstreamTileUrl?: string;
  description: string;
}

export interface ScienceTargetProperties {
  id: string;
  name: string;
  category: string;
  mission_ref: string;
  mineral_signature: string;
  science_score: number;
  elevation_m: number;
  summary: string;
  region?: string;
  inJezeroGrid?: boolean;
}

export interface ScienceTargetFeature {
  type: "Feature";
  properties: ScienceTargetProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface HazardProperties {
  id: string;
  name: string;
  hazard_type: "dust_trap" | "steep_cliff" | "crater_wall";
  severity: "high" | "critical";
  penalty_factor: number;
  thermal_inertia_note: string;
}

export interface HazardFeature {
  type: "Feature";
  properties: HazardProperties;
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

export interface CameraPreset {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
}

export interface MissionPreset {
  id: string;
  label: string;
  startId: string;
  endId: string;
  mode: "safest" | "balanced" | "max_science";
}

export const NASA_LAYERS: MarsLayerConfig[] = [
  {
    id: "mola_clrshade",
    title: "MOLA Color Shaded Relief",
    mission: "Mars Global Surveyor (MOLA)",
    category: "basemap",
    protocol: "wmts",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 7,
    defaultOpacity: 1.0,
    defaultVisible: false,
    crs: "EPSG:104905",
    tileUrlTemplate: "/api/tiles/mola_clrshade/{z}/{y}/{x}",
    upstreamTileUrl:
      "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg",
    description: "Global Martian elevation shaded relief (~463 m/px) for macro basin orientation.",
  },
  {
    id: "viking_mdim21",
    title: "Viking Color Mosaic (MDIM 2.1)",
    mission: "Viking Orbiter 1 & 2",
    category: "basemap",
    protocol: "wmts",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 7,
    defaultOpacity: 1.0,
    defaultVisible: true,
    crs: "EPSG:104905",
    tileUrlTemplate: "/api/tiles/viking_mdim21/{z}/{y}/{x}",
    upstreamTileUrl:
      "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg",
    description: "Natural-color global Mars mosaic (~232 m/px) for rusty terrain realism.",
  },
  {
    id: "ctx_global_5m",
    title: "MRO CTX 5m Context Mosaic",
    mission: "Mars Reconnaissance Orbiter (CTX)",
    category: "imagery",
    protocol: "wmts",
    tileSize: 512,
    minZoom: 0,
    maxZoom: 11,
    defaultOpacity: 1.0,
    defaultVisible: false,
    crs: "EPSG:104905",
    tileUrlTemplate: "/api/tiles/ctx_global_5m/{z}/{y}/{x}",
    upstreamTileUrl: "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}",
    description: "High-resolution (~5 m/px) satellite imagery showing crater rims and delta fans.",
  },
  {
    id: "jezero_trek_ctx_6m",
    title: "NASA Trek Jezero CTX 6m OrthoMosaic",
    mission: "NASA Mars Trek / MRO CTX (JEZ_ctx_B_soc_008)",
    category: "imagery",
    protocol: "wmts",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 14,
    defaultOpacity: 1.0,
    defaultVisible: false,
    crs: "EPSG:104905",
    tileUrlTemplate: "/api/tiles/jezero_trek_ctx_6m/{z}/{y}/{x}",
    upstreamTileUrl:
      "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/{z}/{y}/{x}.png",
    description: "Official NASA Space Apps reference layer: Controlled CTX 6m orthomosaic over Jezero Crater landing area.",
  },
  {
    id: "jezero_slope_overlay",
    title: "Jezero EVA Slope & Hazard Heatmap",
    mission: "Derived MOLA / HiRISE Slope Grid",
    category: "overlay",
    protocol: "image_overlay",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 18,
    defaultOpacity: 0.38,
    defaultVisible: false,
    crs: "IAU_2015:49900",
    description: "Color-coded EVA slope risk overlay (yellow 10-15°, orange 15-20°, red >20°).",
  },
  {
    id: "science_targets",
    title: "Mars Landmarks & Science Targets",
    mission: "NASA / USGS / MRO CRISM",
    category: "vector",
    protocol: "vector",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 18,
    defaultOpacity: 1.0,
    defaultVisible: true,
    crs: "IAU_2015:49900",
    description: "Labels for major Martian landmarks and Jezero Crater astrobiology targets.",
  },
  {
    id: "hazard_zones",
    title: "THEMIS / HiRISE Hazard Polygons",
    mission: "Mars Odyssey THEMIS / HiRISE",
    category: "vector",
    protocol: "vector",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 18,
    defaultOpacity: 0.8,
    defaultVisible: true,
    crs: "IAU_2015:49900",
    description: "Mapped steep cliffs, crater walls, and low thermal-inertia dust traps.",
  },
];

export const JEZERO_SCIENCE_TARGETS: {
  type: "FeatureCollection";
  crs: { type: "name"; properties: { name: string } };
  features: ScienceTargetFeature[];
} = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "IAU_2015:49900" } },
  features: [
    {
      type: "Feature",
      properties: {
        id: "hab-octavia",
        name: "Octavia E. Butler Hab Base",
        region: "Jezero Crater, Mars",
        category: "Habitat / Base",
        mission_ref: "Mars 2020 Perseverance Landing Site",
        mineral_signature: "Basaltic Crater Floor (Máaz Formation)",
        science_score: 40,
        elevation_m: -2568,
        summary: "Primary EVA airlock staging point on flat basaltic floor with clear orbiter line-of-sight.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.4509, 18.4446] },
    },
    {
      type: "Feature",
      properties: {
        id: "kodiak-butte",
        name: "Kodiak Remnant Butte",
        region: "Jezero Crater, Mars",
        category: "Stratigraphy",
        mission_ref: "Perseverance Mastcam-Z / CRISM",
        mineral_signature: "Cross-bedded Deltaic Mudstone & Siltstone",
        science_score: 88,
        elevation_m: -2518,
        summary: "Exposed Gilbert-type delta foreset beds confirming ancient Jezero paleolake water levels.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.419, 18.431] },
    },
    {
      type: "Feature",
      properties: {
        id: "delta-front-hawksbill",
        name: "Hawksbill Gap Delta Front",
        region: "Jezero Crater, Mars",
        category: "Astrobiology",
        mission_ref: "MRO CRISM / SHERLOC",
        mineral_signature: "Fe/Mg Phyllosilicates & Sulfates",
        science_score: 96,
        elevation_m: -2485,
        summary: "High-priority biosignature preservation zone rich in fine-grained lake clays.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.405, 18.458] },
    },
    {
      type: "Feature",
      properties: {
        id: "belva-rim",
        name: "Belva Crater Rim",
        region: "Jezero Delta, Mars",
        category: "Impact Geology",
        mission_ref: "MRO HiRISE / Perseverance",
        mineral_signature: "Excavated Subsurface Carbonate & Sandstone",
        science_score: 85,
        elevation_m: -2410,
        summary: "0.9 km impact crater exposing deep vertical strata of the upper delta fan; steep inner wall.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.392, 18.472] },
    },
    {
      type: "Feature",
      properties: {
        id: "seitah-north",
        name: "Séítah Olivine Ridge",
        region: "Jezero Crater, Mars",
        category: "Igneous Petrology",
        mission_ref: "MRO CRISM / PIXL",
        mineral_signature: "Olivine & Alteration Carbonates",
        science_score: 91,
        elevation_m: -2555,
        summary: "Ancient igneous cumulate unit with carbonation veins near mobile sand ripples.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.434, 18.4385] },
    },
    {
      type: "Feature",
      properties: {
        id: "margin-carbonate",
        name: "Margin Carbonate Unit",
        region: "Jezero Rim, Mars",
        category: "Astrobiology",
        mission_ref: "MRO CRISM Spectral Unit",
        mineral_signature: "Hydrated Mg-Carbonates & Silica",
        science_score: 94,
        elevation_m: -2440,
        summary: "Shoreline carbonate deposits ideal for stromatolite-like fossil texture search.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.386, 18.486] },
    },
    {
      type: "Feature",
      properties: {
        id: "neretva-channel",
        name: "Neretva Vallis Inlet",
        region: "Jezero West, Mars",
        category: "Hydrology",
        mission_ref: "MRO CTX / MOLA",
        mineral_signature: "Fluvial Conglomerate & Cobbles",
        science_score: 82,
        elevation_m: -2365,
        summary: "Ancient river breach channel feeding Jezero Lake; strong relay visibility.",
        inJezeroGrid: true,
      },
      geometry: { type: "Point", coordinates: [77.372, 18.492] },
    },
  ],
};

export const GLOBAL_MARS_LANDMARKS: ScienceTargetFeature[] = [
  {
    type: "Feature",
    properties: {
      id: "olympus-mons",
      name: "Olympus Mons",
      region: "Tharsis Volcanic Province",
      category: "Shield Volcano",
      mission_ref: "MOLA / Viking / Mars Express",
      mineral_signature: "Basaltic Lava Flows",
      science_score: 90,
      elevation_m: 21229,
      summary: "Tallest planetary mountain and shield volcano in the Solar System (~21.9 km relief).",
      inJezeroGrid: false,
    },
    geometry: { type: "Point", coordinates: [-133.8, 18.65] },
  },
  {
    type: "Feature",
    properties: {
      id: "valles-marineris",
      name: "Valles Marineris",
      region: "Equatorial Canyon System",
      category: "Tectonic Canyon",
      mission_ref: "Viking / THEMIS / MRO",
      mineral_signature: "Layered Sulfates & Basalt",
      science_score: 93,
      elevation_m: -4800,
      summary: "4,000 km canyon system exposing kilometers of Martian crustal stratigraphy.",
      inJezeroGrid: false,
    },
    geometry: { type: "Point", coordinates: [-59.2, -13.9] },
  },
  {
    type: "Feature",
    properties: {
      id: "gale-crater",
      name: "Gale Crater (Curiosity)",
      region: "Aeolis Mons / Mount Sharp",
      category: "Rover Landing Site",
      mission_ref: "MSL Curiosity (2012–present)",
      mineral_signature: "Lacustrine Mudstones & Clay-Sulfate Transition",
      science_score: 95,
      elevation_m: -4501,
      summary: "154 km crater explored by NASA's Curiosity rover with REMS weather station.",
      inJezeroGrid: false,
    },
    geometry: { type: "Point", coordinates: [137.8, -5.4] },
  },
  {
    type: "Feature",
    properties: {
      id: "insight-elysium",
      name: "Elysium Planitia (InSight)",
      region: "Western Elysium",
      category: "Geophysical Lander",
      mission_ref: "NASA InSight (2018–2022)",
      mineral_signature: "Volcanic Plains Regolith",
      science_score: 84,
      elevation_m: -2655,
      summary: "Smooth equatorial volcanic plain where InSight recorded marsquakes and crustal thickness.",
      inJezeroGrid: false,
    },
    geometry: { type: "Point", coordinates: [135.6234, 4.5024] },
  },
  {
    type: "Feature",
    properties: {
      id: "hellas-planitia",
      name: "Hellas Planitia",
      region: "Southern Highlands",
      category: "Impact Basin",
      mission_ref: "MOLA / Mars Odyssey",
      mineral_signature: "Dust & High-Pressure Surface Atmosphere",
      science_score: 79,
      elevation_m: -7152,
      summary: "Largest visible impact basin on Mars (~2,300 km wide) with highest surface air pressure.",
      inJezeroGrid: false,
    },
    geometry: { type: "Point", coordinates: [70.5, -42.4] },
  },
];

export const ALL_MARS_PLACES: ScienceTargetFeature[] = [
  ...JEZERO_SCIENCE_TARGETS.features,
  ...GLOBAL_MARS_LANDMARKS,
];

export const JEZERO_HAZARDS: {
  type: "FeatureCollection";
  crs: { type: "name"; properties: { name: string } };
  features: HazardFeature[];
} = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "IAU_2015:49900" } },
  features: [
    {
      type: "Feature",
      properties: {
        id: "haz-seitah-sand",
        name: "South Séítah Dust Trap",
        hazard_type: "dust_trap",
        severity: "high",
        penalty_factor: 6.5,
        thermal_inertia_note: "Low THEMIS night IR thermal inertia; loose eolian sand risks boot sinkage.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.424, 18.431],
            [77.441, 18.431],
            [77.441, 18.442],
            [77.424, 18.442],
            [77.424, 18.431],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "haz-delta-scarp",
        name: "Neretva Delta Escarpment",
        hazard_type: "steep_cliff",
        severity: "critical",
        penalty_factor: 12.0,
        thermal_inertia_note: "Slope >22° with loose talus boulders; traverse restricted to mapped pass corridors.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.4075, 18.448],
            [77.4165, 18.448],
            [77.4165, 18.463],
            [77.4075, 18.463],
            [77.4075, 18.448],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "haz-belva-bowl",
        name: "Belva Crater Inner Wall",
        hazard_type: "crater_wall",
        severity: "critical",
        penalty_factor: 15.0,
        thermal_inertia_note: "25–32° unstable impact wall; line-of-sight RF attenuation inside crater bowl.",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.386, 18.468],
            [77.397, 18.468],
            [77.397, 18.4775],
            [77.386, 18.4775],
            [77.386, 18.468],
          ],
        ],
      },
    },
  ],
};

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "jezero_eva", label: "Jezero Crater", center: [77.418, 18.458], zoom: 11.4 },
  { id: "delta_front", label: "Neretva Delta", center: [77.402, 18.462], zoom: 12.4 },
  { id: "belva_rim", label: "Belva Crater", center: [77.391, 18.473], zoom: 13.0 },
  { id: "mars_global", label: "Global Mars", center: [40.0, 8.0], zoom: 2.0 },
];

export const MISSION_PRESETS: MissionPreset[] = [
  {
    id: "delta_astrobio",
    label: "Hab → Hawksbill Delta (Astrobiology)",
    startId: "hab-octavia",
    endId: "delta-front-hawksbill",
    mode: "safest",
  },
  {
    id: "kodiak_strat",
    label: "Hab → Kodiak Butte (Stratigraphy)",
    startId: "hab-octavia",
    endId: "kodiak-butte",
    mode: "max_science",
  },
  {
    id: "carbonate_rim",
    label: "Hab → Margin Carbonates (Long EVA)",
    startId: "hab-octavia",
    endId: "margin-carbonate",
    mode: "balanced",
  },
];
