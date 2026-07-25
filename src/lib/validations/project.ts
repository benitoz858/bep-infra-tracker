import { z } from "zod";

import {
  ConfidenceLevel,
  MetricType,
  ProjectCompanyRole,
  ProjectStatus,
  ProjectType,
  SourceType,
} from "@/generated/prisma/enums";
import {
  optionalDate,
  optionalLatitude,
  optionalLongitude,
  optionalNonNegativeInt,
  optionalNonNegativeNumber,
  optionalScore,
  optionalString,
  optionalText,
  optionalUrl,
  paginationSchema,
  requiredString,
  requiredUrl,
} from "@/lib/validations/common";

const projectStatus = z.enum(ProjectStatus);
const projectType = z.enum(ProjectType);

/** Statuses that legitimately have an actual opening date. */
const OPENED_STATUSES: ProjectStatus[] = ["OPERATIONAL", "PARTIALLY_OPERATIONAL"];

// Upper bounds are sanity rails, not forecasts: they catch a unit slip (GW typed
// into an MW field) without rejecting a plausibly enormous real project.
const MAX_MW = 100_000;
const MAX_GPUS = 50_000_000;
const MAX_CAPEX = 1_000_000_000_000;

export const supplierLinkSchema = z.object({
  companyId: z.string().min(1, "Choose a company."),
  role: z.enum(ProjectCompanyRole),
  notes: optionalString(500),
});

export const sourceInputSchema = z.object({
  id: z.string().optional(),
  title: requiredString("Source title"),
  publisher: optionalString(200),
  url: requiredUrl,
  publicationDate: optionalDate,
  sourceType: z.enum(SourceType),
  excerpt: optionalText(4000),
  archivedUrl: optionalUrl,
  reliabilityScore: optionalScore("Reliability score"),
  isPrimarySource: z.coerce.boolean().default(false),
  accessedAt: optionalDate,
});

export const metricInputSchema = z
  .object({
    id: z.string().optional(),
    metricType: z.enum(MetricType),
    numericValue: optionalNonNegativeNumber("Metric value"),
    textValue: optionalString(1000),
    unit: optionalString(40),
    confidenceLevel: z.enum(ConfidenceLevel),
    methodology: optionalText(4000),
    effectiveDate: optionalDate,
    // Index into the submitted sources array, or an existing Source id.
    sourceId: optionalString(60),
  })
  .refine((m) => m.numericValue !== null || m.textValue !== null, {
    message: "A metric needs either a numeric value or a text value.",
    path: ["numericValue"],
  });

/**
 * The shape both the create and edit forms submit.
 *
 * Cross-field data-quality rules live in `superRefine` below rather than in the
 * service, so the form, the API and the CSV importer all enforce them
 * identically and surface the same messages.
 */
export const projectInputSchema = z
  .object({
    name: requiredString("Project name"),
    slug: optionalString(80),
    description: optionalText(8000),
    ownerCompanyId: optionalString(60),

    projectType: projectType,
    status: projectStatus,

    city: optionalString(120),
    stateRegion: optionalString(120),
    country: requiredString("Country", 120),
    latitude: optionalLatitude,
    longitude: optionalLongitude,

    announcementDate: optionalDate,
    expectedOpeningDate: optionalDate,
    actualOpeningDate: optionalDate,

    estimatedPowerMw: optionalNonNegativeNumber("Estimated power (MW)", MAX_MW),
    confirmedPowerMw: optionalNonNegativeNumber("Confirmed power (MW)", MAX_MW),
    estimatedGpuCount: optionalNonNegativeInt("Estimated GPU count", MAX_GPUS),
    confirmedGpuCount: optionalNonNegativeInt("Confirmed GPU count", MAX_GPUS),
    gpuModel: optionalString(160),
    computePlatform: optionalString(160),

    estimatedCapexUsd: optionalNonNegativeNumber("Estimated capex (USD)", MAX_CAPEX),
    confirmedCapexUsd: optionalNonNegativeNumber("Confirmed capex (USD)", MAX_CAPEX),

    squareFeet: optionalNonNegativeInt("Square feet", 100_000_000),
    coolingTechnology: optionalString(200),
    powerSource: optionalString(200),
    utilityProvider: optionalString(200),

    confidenceScore: optionalScore("Confidence score"),
    analystNotes: optionalText(20_000),
    lastVerifiedAt: optionalDate,

    tagNames: z.array(z.string().trim().min(1)).default([]),
    suppliers: z.array(supplierLinkSchema).default([]),
    sources: z.array(sourceInputSchema).default([]),
    metrics: z.array(metricInputSchema).default([]),

    /** Set by the UI to proceed past a soft duplicate warning. */
    acknowledgeDuplicate: z.coerce.boolean().default(false),
    /** Set by the UI to allow a source URL already used on this project. */
    allowDuplicateSourceUrl: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // An actual opening date only makes sense once something has opened.
    if (data.actualOpeningDate && !OPENED_STATUSES.includes(data.status)) {
      ctx.addIssue({
        code: "custom",
        path: ["actualOpeningDate"],
        message:
          "An actual opening date requires status Operational or Partially operational.",
      });
    }

    // Coordinates are only meaningful as a pair.
    if ((data.latitude === null) !== (data.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: [data.latitude === null ? "latitude" : "longitude"],
        message: "Latitude and longitude must both be provided, or both left blank.",
      });
    }

    // A CONFIRMED metric must cite something. This is the hard version of the
    // rule; the service re-checks it after sources are persisted, because a
    // metric may reference a source submitted in the same request.
    data.metrics.forEach((m, i) => {
      if (m.confidenceLevel === "CONFIRMED" && !m.sourceId) {
        ctx.addIssue({
          code: "custom",
          path: ["metrics", i, "sourceId"],
          message: "A confirmed metric must cite a source.",
        });
      }
    });

    // Source URLs unique per project unless explicitly overridden.
    if (!data.allowDuplicateSourceUrl) {
      const seen = new Map<string, number>();
      data.sources.forEach((s, i) => {
        const key = s.url.trim().toLowerCase().replace(/\/+$/, "");
        const first = seen.get(key);
        if (first !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["sources", i, "url"],
            message: "This URL is already cited on this project.",
          });
        } else {
          seen.set(key, i);
        }
      });
    }
  });

export type ProjectInput = z.infer<typeof projectInputSchema>;

/**
 * Non-blocking data-quality warnings. These are surfaced to the analyst but
 * never reject a save: the spec asks for a warning when the expected opening
 * precedes the announcement, which is odd but can be legitimate for a project
 * announced after work began.
 */
export function projectWarnings(data: {
  announcementDate?: Date | null;
  expectedOpeningDate?: Date | null;
  actualOpeningDate?: Date | null;
  status: ProjectStatus;
  estimatedPowerMw?: number | null;
  confirmedPowerMw?: number | null;
  estimatedGpuCount?: number | null;
  confirmedGpuCount?: number | null;
  confidenceScore?: number | null;
  sources?: unknown[];
}): string[] {
  const warnings: string[] = [];

  if (
    data.announcementDate &&
    data.expectedOpeningDate &&
    data.expectedOpeningDate < data.announcementDate
  ) {
    warnings.push(
      "Expected opening date is before the announcement date. Check both dates.",
    );
  }

  if (
    data.confirmedPowerMw !== null &&
    data.confirmedPowerMw !== undefined &&
    data.estimatedPowerMw !== null &&
    data.estimatedPowerMw !== undefined &&
    data.confirmedPowerMw > data.estimatedPowerMw
  ) {
    warnings.push(
      "Confirmed power exceeds the estimate — the estimate is probably stale and should be revised upward.",
    );
  }

  if (
    data.confirmedGpuCount !== null &&
    data.confirmedGpuCount !== undefined &&
    data.estimatedGpuCount !== null &&
    data.estimatedGpuCount !== undefined &&
    data.confirmedGpuCount > data.estimatedGpuCount
  ) {
    warnings.push("Confirmed GPU count exceeds the estimate. Revise the estimate.");
  }

  if (OPENED_STATUSES.includes(data.status) && !data.actualOpeningDate) {
    warnings.push(
      "Status says the project has opened but no actual opening date is recorded.",
    );
  }

  if (data.sources && data.sources.length === 0) {
    warnings.push(
      "No sources attached. This project will enter the verification queue.",
    );
  }

  if (
    data.confidenceScore !== null &&
    data.confidenceScore !== undefined &&
    data.confidenceScore >= 80 &&
    data.sources &&
    data.sources.length < 2
  ) {
    warnings.push(
      "A confidence score of 80+ with fewer than two sources is hard to justify.",
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Query / filter parsing for the projects table. Kept here so the URL is the
// single source of truth for table state and can be parsed identically on the
// server (page) and in the export endpoint.
// ---------------------------------------------------------------------------

export const SORTABLE_FIELDS = [
  "name",
  "status",
  "country",
  "projectType",
  "powerMw",
  "gpuCount",
  "expectedOpeningDate",
  "lastVerifiedAt",
  "confidenceScore",
  "createdAt",
  "updatedAt",
] as const;

export type SortableField = (typeof SORTABLE_FIELDS)[number];

/** `?sort=powerMw.desc` */
const sortSchema = z
  .string()
  .optional()
  .transform((value) => {
    const [field, dir] = (value ?? "updatedAt.desc").split(".");
    const safeField = (SORTABLE_FIELDS as readonly string[]).includes(field ?? "")
      ? (field as SortableField)
      : "updatedAt";
    return {
      field: safeField,
      direction: dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  });

/** Comma-separated repeated filter values: `?status=OPERATIONAL,DELAYED`. */
const csvEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is T => (values as readonly string[]).includes(s)),
    );

const csvStrings = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const projectQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: csvEnum(Object.values(ProjectStatus)),
    projectType: csvEnum(Object.values(ProjectType)),
    country: csvStrings,
    ownerId: csvStrings,
    gpuModel: csvStrings,
    tag: csvStrings,
    minPowerMw: z.coerce.number().min(0).optional(),
    openingYear: z.coerce.number().int().min(1990).max(2100).optional(),
    needsVerification: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
    includeDemo: z
      .string()
      .optional()
      // Demo rows are shown by default; hiding them is the explicit choice.
      .transform((v) => v !== "0" && v !== "false"),
    sort: sortSchema,
  })
  .and(paginationSchema);

export type ProjectQuery = z.infer<typeof projectQuerySchema>;
