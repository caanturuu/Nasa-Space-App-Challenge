/** Provenance labels so the UI can never silently present simulated numbers as measured data. */

export type DataSource =
  | "NASA_TREK_DEM"
  | "PDS_MOLA"
  | "JPL_HORIZONS"
  | "NASA_REMS"
  | "SIMULATED";

export interface ProvenanceTag {
  source: DataSource;
  label: string;
  real: boolean;
}

const LABELS: Record<DataSource, string> = {
  NASA_TREK_DEM: "NASA Trek DEM",
  PDS_MOLA: "PDS MOLA 4ppd",
  JPL_HORIZONS: "JPL Horizons",
  NASA_REMS: "NASA REMS / MSL",
  SIMULATED: "Simulasi",
};

export function provenanceTag(source: DataSource): ProvenanceTag {
  return { source, label: LABELS[source], real: source !== "SIMULATED" };
}

export function isReal(source: DataSource): boolean {
  return source !== "SIMULATED";
}
