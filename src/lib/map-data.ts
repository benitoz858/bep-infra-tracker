import type { ProjectStatus } from "@/generated/prisma/enums";
import { statusHex } from "@/lib/domain";
import { toNumber } from "@/lib/format";

/**
 * GeoJSON construction for the map, kept out of the map component so it can be
 * unit-tested without a Mapbox token or a browser. The component is a thin
 * renderer over what this module produces.
 */

export type SizeMetric = "power" | "gpus" | "capex";

export const SIZE_METRIC_LABEL: Record<SizeMetric, string> = {
  power: "Power (MW)",
  gpus: "GPU count",
  capex: "Capex (USD)",
};

export type MapProjectInput = {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  stateRegion: string | null;
  country: string;
  estimatedPowerMw: string | null;
  confirmedPowerMw: string | null;
  estimatedGpuCount: number | null;
  confirmedGpuCount: number | null;
  estimatedCapexUsd: string | null;
  confirmedCapexUsd: string | null;
  expectedOpeningDate: Date | string | null;
  isDemoData: boolean;
  ownerCompany: { name: string } | null;
};

export type MapFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    slug: string;
    name: string;
    status: ProjectStatus;
    color: string;
    owner: string;
    location: string;
    /** The value driving marker size, in the metric's own units. */
    metricValue: number;
    /** Pixel radius, precomputed so Mapbox needs no expression maths. */
    radius: number;
    powerMw: number | null;
    gpuCount: number | null;
    capexUsd: number | null;
    expectedOpening: string | null;
    isDemoData: boolean;
    isEstimated: boolean;
  };
};

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: MapFeature[];
};

/** Best-available value for a metric, plus whether it came from an estimate. */
export function metricFor(
  project: MapProjectInput,
  metric: SizeMetric,
): { value: number | null; estimated: boolean } {
  switch (metric) {
    case "power": {
      const confirmed = toNumber(project.confirmedPowerMw);
      if (confirmed !== null) return { value: confirmed, estimated: false };
      return { value: toNumber(project.estimatedPowerMw), estimated: true };
    }
    case "gpus": {
      if (project.confirmedGpuCount !== null)
        return { value: project.confirmedGpuCount, estimated: false };
      return { value: project.estimatedGpuCount, estimated: true };
    }
    case "capex": {
      const confirmed = toNumber(project.confirmedCapexUsd);
      if (confirmed !== null) return { value: confirmed, estimated: false };
      return { value: toNumber(project.estimatedCapexUsd), estimated: true };
    }
  }
}

export const MIN_RADIUS = 5;
export const MAX_RADIUS = 26;

/**
 * Square-root scaling, so marker *area* is proportional to the value. Linear
 * radius would make a 10x project look 100x bigger and badly mislead the eye.
 * Projects with no value for the chosen metric get MIN_RADIUS — they are still
 * real projects and must stay visible, just at the floor size.
 */
export function radiusFor(value: number | null, max: number): number {
  if (value === null || value <= 0 || max <= 0) return MIN_RADIUS;
  const ratio = Math.sqrt(Math.min(value, max) / max);
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

export function buildFeatureCollection(
  projects: MapProjectInput[],
  metric: SizeMetric,
): MapFeatureCollection {
  // Only projects with coordinates can be plotted; the caller is told how many
  // were dropped so the UI can say so rather than silently under-reporting.
  const plottable = projects.filter((p) => p.latitude !== null && p.longitude !== null);

  const values = plottable
    .map((p) => metricFor(p, metric).value)
    .filter((v): v is number => v !== null && v > 0);
  const max = values.length > 0 ? Math.max(...values) : 0;

  return {
    type: "FeatureCollection",
    features: plottable.map((p) => {
      const { value, estimated } = metricFor(p, metric);
      const opening =
        p.expectedOpeningDate instanceof Date
          ? p.expectedOpeningDate.toISOString()
          : (p.expectedOpeningDate ?? null);

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          // GeoJSON is [longitude, latitude] — the reverse of how coordinates
          // are usually written, and a classic source of mirrored maps.
          coordinates: [p.longitude as number, p.latitude as number],
        },
        properties: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          status: p.status,
          color: statusHex(p.status),
          owner: p.ownerCompany?.name ?? "Unattributed",
          location: [p.city, p.stateRegion, p.country].filter(Boolean).join(", "),
          metricValue: value ?? 0,
          radius: radiusFor(value, max),
          powerMw: metricFor(p, "power").value,
          gpuCount: metricFor(p, "gpus").value,
          capexUsd: metricFor(p, "capex").value,
          expectedOpening: opening,
          isDemoData: p.isDemoData,
          isEstimated: estimated,
        },
      };
    }),
  };
}

/** How many projects could not be plotted for want of coordinates. */
export function countUnplottable(projects: MapProjectInput[]): number {
  return projects.filter((p) => p.latitude === null || p.longitude === null).length;
}
