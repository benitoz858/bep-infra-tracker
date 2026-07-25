import Papa from "papaparse";

import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";
import { findDuplicateProjects, normalizeName } from "@/lib/services/duplicates";
import { ServiceError } from "@/lib/services/errors";
import { companyInputSchema } from "@/lib/validations/company";
import { projectInputSchema } from "@/lib/validations/project";
import { sourceCreateSchema } from "@/lib/validations/source";

/**
 * CSV import.
 *
 * Two-phase by design: `previewImport` parses, maps, validates and duplicate-checks
 * without writing anything, and `commitImport` writes only the rows the analyst
 * accepted. That means a bad file can never half-load, and the analyst sees every
 * row-level error before any data changes.
 *
 * Blank cells become `null`, never `0` — the same rule the forms follow. A CSV
 * with an empty power column must not assert that a campus draws no power.
 */

export type ImportEntity = "projects" | "companies" | "sources";

export type RowIssue = { column: string; message: string };

export type PreviewRow = {
  /** 1-based row number in the file, excluding the header. */
  rowNumber: number;
  raw: Record<string, string>;
  /** Parsed payload, present only when the row validated. */
  parsed?: unknown;
  issues: RowIssue[];
  duplicateOf?: { id: string; slug: string; name: string; score: number }[];
  /** Duplicated within the file itself. */
  duplicateOfRow?: number;
  status: "ok" | "warning" | "error";
};

export type ImportPreview = {
  entity: ImportEntity;
  /** Header names found in the file. */
  headers: string[];
  /** Canonical field each header was mapped to, or null if unrecognised. */
  mapping: Record<string, string | null>;
  unmappedHeaders: string[];
  missingRequired: string[];
  rows: PreviewRow[];
  counts: { total: number; ok: number; warning: number; error: number };
};

/** Canonical column names per entity, with the aliases we accept for each. */
const COLUMN_ALIASES: Record<ImportEntity, Record<string, string[]>> = {
  projects: {
    name: ["name", "project", "project_name", "title"],
    owner: ["owner", "owner_company", "company", "operator"],
    projectType: ["project_type", "type", "projecttype"],
    status: ["status", "project_status"],
    city: ["city", "town"],
    stateRegion: ["state_region", "state", "region", "province"],
    country: ["country"],
    latitude: ["latitude", "lat"],
    longitude: ["longitude", "lon", "lng", "long"],
    announcementDate: ["announcement_date", "announced", "announced_date"],
    expectedOpeningDate: ["expected_opening_date", "expected_opening", "eta"],
    actualOpeningDate: ["actual_opening_date", "actual_opening", "opened"],
    estimatedPowerMw: ["estimated_power_mw", "power_mw_estimated", "est_power_mw"],
    confirmedPowerMw: ["confirmed_power_mw", "power_mw_confirmed", "power_mw"],
    estimatedGpuCount: ["estimated_gpu_count", "gpus_estimated", "est_gpu_count"],
    confirmedGpuCount: ["confirmed_gpu_count", "gpus_confirmed", "gpu_count"],
    gpuModel: ["gpu_model", "accelerator", "accelerator_model"],
    computePlatform: ["compute_platform", "platform"],
    estimatedCapexUsd: ["estimated_capex_usd", "capex_estimated", "est_capex_usd"],
    confirmedCapexUsd: ["confirmed_capex_usd", "capex_confirmed", "capex_usd", "capex"],
    squareFeet: ["square_feet", "sqft", "floor_area_sqft"],
    coolingTechnology: ["cooling_technology", "cooling"],
    powerSource: ["power_source", "energy_source"],
    utilityProvider: ["utility_provider", "utility"],
    confidenceScore: ["confidence_score", "confidence"],
    tags: ["tags", "tag"],
    analystNotes: ["analyst_notes", "notes", "comment"],
  },
  companies: {
    name: ["name", "company", "company_name"],
    companyType: ["company_type", "type"],
    ticker: ["ticker", "symbol"],
    website: ["website", "url", "site"],
    headquartersCountry: ["headquarters_country", "hq", "hq_country", "country"],
    description: ["description", "about", "notes"],
  },
  sources: {
    projectSlug: ["project_slug", "slug", "project"],
    title: ["title", "headline"],
    publisher: ["publisher", "outlet", "source"],
    url: ["url", "link"],
    publicationDate: ["publication_date", "published", "date"],
    sourceType: ["source_type", "type"],
    reliabilityScore: ["reliability_score", "reliability"],
    isPrimarySource: ["is_primary_source", "primary"],
    excerpt: ["excerpt", "quote"],
  },
};

const REQUIRED: Record<ImportEntity, string[]> = {
  projects: ["name", "country", "projectType", "status"],
  companies: ["name", "companyType"],
  sources: ["projectSlug", "title", "url", "sourceType"],
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Map file headers to canonical fields via the alias table. */
export function mapHeaders(
  entity: ImportEntity,
  headers: string[],
): { mapping: Record<string, string | null>; unmapped: string[] } {
  const aliases = COLUMN_ALIASES[entity];
  const lookup = new Map<string, string>();
  for (const [field, names] of Object.entries(aliases)) {
    for (const name of names) lookup.set(name, field);
    lookup.set(normalizeHeader(field), field);
  }

  const mapping: Record<string, string | null> = {};
  const unmapped: string[] = [];
  for (const header of headers) {
    const field = lookup.get(normalizeHeader(header)) ?? null;
    mapping[header] = field;
    if (!field) unmapped.push(header);
  }
  return { mapping, unmapped };
}

/** "TRUE"/"yes"/"1" → true. Anything else falsy-ish → false. */
function parseBool(value: string | undefined): boolean {
  return /^(true|yes|y|1)$/i.test((value ?? "").trim());
}

function cell(
  row: Record<string, string>,
  mapping: Record<string, string | null>,
  field: string,
): string {
  for (const [header, mapped] of Object.entries(mapping)) {
    if (mapped === field) return (row[header] ?? "").trim();
  }
  return "";
}

export function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    // Papa reports per-row errors too; only a fatal parse failure should abort.
    const fatal = result.errors.find((e) => e.row === undefined);
    if (fatal) {
      throw new ServiceError(
        "invalid_csv",
        `Could not parse the CSV: ${fatal.message}`,
        400,
      );
    }
  }

  return {
    headers: result.meta.fields ?? [],
    rows: result.data.filter((r) =>
      Object.values(r).some((v) => (v ?? "").trim() !== ""),
    ),
  };
}

export async function previewImport(
  entity: ImportEntity,
  csvText: string,
): Promise<ImportPreview> {
  const { headers, rows } = parseCsv(csvText);
  const { mapping, unmapped } = mapHeaders(entity, headers);

  const mappedFields = new Set(Object.values(mapping).filter(Boolean) as string[]);
  const missingRequired = REQUIRED[entity].filter((f) => !mappedFields.has(f));

  const previewRows: PreviewRow[] = [];
  // Tracks name+country keys already seen in this file, to flag in-file dupes.
  const seenKeys = new Map<string, number>();

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 1;
    const issues: RowIssue[] = [];
    let parsed: unknown;
    let duplicateOf: PreviewRow["duplicateOf"];
    let duplicateOfRow: number | undefined;

    if (missingRequired.length > 0) {
      issues.push({
        column: missingRequired.join(", "),
        message: "Required column is missing from the file.",
      });
    } else if (entity === "projects") {
      const get = (field: string) => cell(raw, mapping, field);
      const ownerName = get("owner");

      // Owner is given by name in a CSV; resolve to an id, and say so rather
      // than silently dropping the relationship.
      let ownerCompanyId: string | null = null;
      if (ownerName) {
        const company = await prisma.company.findFirst({
          where: { name: { equals: ownerName, mode: "insensitive" } },
          select: { id: true },
        });
        if (company) ownerCompanyId = company.id;
        else
          issues.push({
            column: "owner",
            message: `No company named "${ownerName}". It will import unattributed — create the company first to link it.`,
          });
      }

      const candidate = {
        name: get("name"),
        country: get("country"),
        projectType: get("projectType").toUpperCase(),
        status: get("status").toUpperCase(),
        city: get("city"),
        stateRegion: get("stateRegion"),
        latitude: get("latitude"),
        longitude: get("longitude"),
        announcementDate: get("announcementDate"),
        expectedOpeningDate: get("expectedOpeningDate"),
        actualOpeningDate: get("actualOpeningDate"),
        estimatedPowerMw: get("estimatedPowerMw"),
        confirmedPowerMw: get("confirmedPowerMw"),
        estimatedGpuCount: get("estimatedGpuCount"),
        confirmedGpuCount: get("confirmedGpuCount"),
        gpuModel: get("gpuModel"),
        computePlatform: get("computePlatform"),
        estimatedCapexUsd: get("estimatedCapexUsd"),
        confirmedCapexUsd: get("confirmedCapexUsd"),
        squareFeet: get("squareFeet"),
        coolingTechnology: get("coolingTechnology"),
        powerSource: get("powerSource"),
        utilityProvider: get("utilityProvider"),
        confidenceScore: get("confidenceScore"),
        analystNotes: get("analystNotes"),
        ownerCompanyId,
        tagNames: get("tags")
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean),
        suppliers: [],
        sources: [],
        metrics: [],
        // An import cannot interactively acknowledge duplicates; they are
        // surfaced in the preview and the analyst decides per row.
        acknowledgeDuplicate: true,
      };

      const result = projectInputSchema.safeParse(candidate);
      if (result.success) {
        parsed = result.data;

        const key = `${normalizeName(candidate.name)}|${candidate.country.toLowerCase()}`;
        const firstSeen = seenKeys.get(key);
        if (firstSeen !== undefined) duplicateOfRow = firstSeen;
        else seenKeys.set(key, rowNumber);

        const dupes = await findDuplicateProjects({
          name: candidate.name,
          country: candidate.country,
          city: candidate.city || null,
          stateRegion: candidate.stateRegion || null,
          ownerCompanyId,
        });
        if (dupes.length > 0) {
          duplicateOf = dupes.map((d) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
            score: d.score,
          }));
        }
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            column: String(issue.path[0] ?? "row"),
            message: issue.message,
          });
        }
      }
    } else if (entity === "companies") {
      const get = (field: string) => cell(raw, mapping, field);
      const result = companyInputSchema.safeParse({
        name: get("name"),
        companyType: get("companyType").toUpperCase(),
        ticker: get("ticker"),
        website: get("website"),
        headquartersCountry: get("headquartersCountry"),
        description: get("description"),
      });
      if (result.success) {
        parsed = result.data;
        const existing = await prisma.company.findUnique({
          where: { slug: slugify(result.data.name) },
          select: { id: true, name: true, slug: true },
        });
        if (existing) {
          duplicateOf = [{ ...existing, score: 100 }];
        }
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            column: String(issue.path[0] ?? "row"),
            message: issue.message,
          });
        }
      }
    } else {
      const get = (field: string) => cell(raw, mapping, field);
      const slug = get("projectSlug");
      const project = await prisma.project.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!project) {
        issues.push({
          column: "project_slug",
          message: `No project with slug "${slug}".`,
        });
      } else {
        const result = sourceCreateSchema.safeParse({
          projectId: project.id,
          title: get("title"),
          publisher: get("publisher"),
          url: get("url"),
          publicationDate: get("publicationDate"),
          sourceType: get("sourceType").toUpperCase(),
          reliabilityScore: get("reliabilityScore"),
          isPrimarySource: parseBool(get("isPrimarySource")),
          excerpt: get("excerpt"),
          allowDuplicateUrl: false,
        });
        if (result.success) parsed = result.data;
        else
          for (const issue of result.error.issues) {
            issues.push({
              column: String(issue.path[0] ?? "row"),
              message: issue.message,
            });
          }
      }
    }

    const hasBlockingIssue = !parsed;
    previewRows.push({
      rowNumber,
      raw,
      parsed,
      issues,
      duplicateOf,
      duplicateOfRow,
      status: hasBlockingIssue
        ? "error"
        : issues.length > 0 || duplicateOf || duplicateOfRow !== undefined
          ? "warning"
          : "ok",
    });
  }

  return {
    entity,
    headers,
    mapping,
    unmappedHeaders: unmapped,
    missingRequired,
    rows: previewRows,
    counts: {
      total: previewRows.length,
      ok: previewRows.filter((r) => r.status === "ok").length,
      warning: previewRows.filter((r) => r.status === "warning").length,
      error: previewRows.filter((r) => r.status === "error").length,
    },
  };
}

export type CommitResult = {
  created: number;
  skipped: number;
  failed: { rowNumber: number; message: string }[];
};

/**
 * Writes the accepted rows. `acceptedRowNumbers` is the explicit allow-list from
 * the preview UI — nothing imports that the analyst did not tick, so a warning
 * row is skipped by default rather than sneaking in.
 */
export async function commitImport(
  entity: ImportEntity,
  csvText: string,
  acceptedRowNumbers: number[],
  userId: string | null,
): Promise<CommitResult> {
  const preview = await previewImport(entity, csvText);
  const accepted = new Set(acceptedRowNumbers);

  const result: CommitResult = { created: 0, skipped: 0, failed: [] };

  for (const row of preview.rows) {
    if (!accepted.has(row.rowNumber) || !row.parsed) {
      result.skipped += 1;
      continue;
    }

    try {
      if (entity === "projects") {
        const { createProject } = await import("@/lib/services/projects");
        await createProject(row.parsed as never, userId);
      } else if (entity === "companies") {
        const { createCompany } = await import("@/lib/services/companies");
        await createCompany(row.parsed as never);
      } else {
        const { createSource } = await import("@/lib/services/sources");
        await createSource(row.parsed as never);
      }
      result.created += 1;
    } catch (error) {
      // One bad row must not abort the rest; report it and continue.
      result.failed.push({
        rowNumber: row.rowNumber,
        message: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }

  return result;
}
