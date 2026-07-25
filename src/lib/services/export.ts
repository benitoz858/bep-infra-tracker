import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { buildProjectWhere } from "@/lib/services/projects";
import type { ProjectQuery } from "@/lib/validations/project";

/**
 * CSV and JSON export.
 *
 * Two rules make an export trustworthy:
 *   - Unknown stays empty. A blank CSV cell means "not disclosed"; it is never
 *     written as 0, because a spreadsheet SUM would then treat missing data as
 *     a real zero and understate the total.
 *   - Estimated and confirmed stay in separate columns. Flattening them to one
 *     "power_mw" column would strip the provenance that is the point of the
 *     product, so the export carries both plus which one is authoritative.
 */

/** RFC 4180 quoting. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === "object" && "toString" in value
        ? String(value)
        : String(value);
  if (str === "") return "";
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // CRLF per RFC 4180 — Excel is happier and other tools do not care.
  return `${lines.join("\r\n")}\r\n`;
}

const PROJECT_EXPORT_HEADERS = [
  "slug",
  "name",
  "owner",
  "owner_ticker",
  "project_type",
  "status",
  "city",
  "state_region",
  "country",
  "latitude",
  "longitude",
  "announcement_date",
  "expected_opening_date",
  "actual_opening_date",
  "estimated_power_mw",
  "confirmed_power_mw",
  "power_mw_basis",
  "estimated_gpu_count",
  "confirmed_gpu_count",
  "gpu_model",
  "compute_platform",
  "estimated_capex_usd",
  "confirmed_capex_usd",
  "square_feet",
  "cooling_technology",
  "power_source",
  "utility_provider",
  "confidence_score",
  "source_count",
  "primary_source_count",
  "metric_count",
  "tags",
  "suppliers",
  "last_verified_at",
  "is_demo_data",
  "analyst_notes",
];

async function fetchForExport(query: ProjectQuery) {
  return prisma.project.findMany({
    where: await buildProjectWhere(query),
    orderBy: { name: "asc" },
    include: {
      ownerCompany: { select: { name: true, ticker: true } },
      tags: { select: { name: true } },
      companies: { include: { company: { select: { name: true } } } },
      sources: { select: { isPrimarySource: true } },
      _count: { select: { metrics: true } },
    },
    // Bounded so a mis-filtered export cannot try to stream the whole table.
    take: 20_000,
  });
}

export async function exportProjectsCsv(query: ProjectQuery): Promise<string> {
  const projects = await fetchForExport(query);

  const rows = projects.map((p) => [
    p.slug,
    p.name,
    p.ownerCompany?.name ?? "",
    p.ownerCompany?.ticker ?? "",
    p.projectType,
    p.status,
    p.city,
    p.stateRegion,
    p.country,
    p.latitude,
    p.longitude,
    p.announcementDate,
    p.expectedOpeningDate,
    p.actualOpeningDate,
    p.estimatedPowerMw,
    p.confirmedPowerMw,
    // Tells the reader which of the two columns to trust for this row.
    p.confirmedPowerMw !== null
      ? "confirmed"
      : p.estimatedPowerMw !== null
        ? "estimated"
        : "",
    p.estimatedGpuCount,
    p.confirmedGpuCount,
    p.gpuModel,
    p.computePlatform,
    p.estimatedCapexUsd,
    p.confirmedCapexUsd,
    p.squareFeet,
    p.coolingTechnology,
    p.powerSource,
    p.utilityProvider,
    p.confidenceScore,
    p.sources.length,
    p.sources.filter((s) => s.isPrimarySource).length,
    p._count.metrics,
    p.tags.map((t) => t.name).join("; "),
    p.companies.map((c) => `${c.company.name} (${c.role})`).join("; "),
    p.lastVerifiedAt,
    p.isDemoData ? "TRUE" : "FALSE",
    p.analystNotes,
  ]);

  return toCsv(PROJECT_EXPORT_HEADERS, rows);
}

export async function exportProjectsJson(query: ProjectQuery) {
  const projects = await fetchForExport(query);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      count: projects.length,
      // Stated on every export so a downstream consumer cannot mistake a mixed
      // total for a set of confirmed facts.
      disclaimer:
        "Figures combine confirmed disclosures with analyst estimates. Check confidence and sources per project before use. Rows with isDemoData=true are illustrative seed data and must not be used in analysis.",
      demoRowCount: projects.filter((p) => p.isDemoData).length,
    },
    projects: projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      owner: p.ownerCompany
        ? { name: p.ownerCompany.name, ticker: p.ownerCompany.ticker }
        : null,
      projectType: p.projectType,
      status: p.status,
      location: {
        city: p.city,
        stateRegion: p.stateRegion,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
      },
      timeline: {
        announcementDate: p.announcementDate,
        expectedOpeningDate: p.expectedOpeningDate,
        actualOpeningDate: p.actualOpeningDate,
      },
      power: {
        estimatedMw: toNumber(p.estimatedPowerMw),
        confirmedMw: toNumber(p.confirmedPowerMw),
        source: p.powerSource,
        utilityProvider: p.utilityProvider,
      },
      compute: {
        estimatedGpuCount: p.estimatedGpuCount,
        confirmedGpuCount: p.confirmedGpuCount,
        gpuModel: p.gpuModel,
        computePlatform: p.computePlatform,
      },
      capex: {
        estimatedUsd: toNumber(p.estimatedCapexUsd),
        confirmedUsd: toNumber(p.confirmedCapexUsd),
      },
      building: { squareFeet: p.squareFeet, coolingTechnology: p.coolingTechnology },
      tags: p.tags.map((t) => t.name),
      suppliers: p.companies.map((c) => ({ name: c.company.name, role: c.role })),
      evidence: {
        sourceCount: p.sources.length,
        primarySourceCount: p.sources.filter((s) => s.isPrimarySource).length,
        metricCount: p._count.metrics,
      },
      confidenceScore: p.confidenceScore,
      lastVerifiedAt: p.lastVerifiedAt,
      isDemoData: p.isDemoData,
      analystNotes: p.analystNotes,
    })),
  };
}

export async function exportCompaniesCsv(): Promise<string> {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { ownedProjects: true, projectLinks: true } } },
  });

  return toCsv(
    [
      "slug",
      "name",
      "company_type",
      "ticker",
      "website",
      "headquarters_country",
      "owned_project_count",
      "linked_project_count",
      "description",
    ],
    companies.map((c) => [
      c.slug,
      c.name,
      c.companyType,
      c.ticker,
      c.website,
      c.headquartersCountry,
      c._count.ownedProjects,
      c._count.projectLinks,
      c.description,
    ]),
  );
}

export async function exportSourcesCsv(): Promise<string> {
  const sources = await prisma.source.findMany({
    orderBy: [{ projectId: "asc" }, { publicationDate: "desc" }],
    include: { project: { select: { slug: true, name: true, isDemoData: true } } },
    take: 20_000,
  });

  return toCsv(
    [
      "project_slug",
      "project_name",
      "title",
      "publisher",
      "url",
      "publication_date",
      "source_type",
      "reliability_score",
      "is_primary_source",
      "archived_url",
      "accessed_at",
      "excerpt",
      "is_demo_data",
    ],
    sources.map((s) => [
      s.project.slug,
      s.project.name,
      s.title,
      s.publisher,
      s.url,
      s.publicationDate,
      s.sourceType,
      s.reliabilityScore,
      s.isPrimarySource ? "TRUE" : "FALSE",
      s.archivedUrl,
      s.accessedAt,
      s.excerpt,
      s.project.isDemoData ? "TRUE" : "FALSE",
    ]),
  );
}

export async function exportMetricsCsv(): Promise<string> {
  const metrics = await prisma.projectMetric.findMany({
    orderBy: [{ projectId: "asc" }, { metricType: "asc" }],
    include: {
      project: { select: { slug: true, name: true, isDemoData: true } },
      source: { select: { title: true, url: true, publisher: true } },
    },
    take: 50_000,
  });

  return toCsv(
    [
      "project_slug",
      "project_name",
      "metric_type",
      "numeric_value",
      "text_value",
      "unit",
      "confidence_level",
      "effective_date",
      "methodology",
      "source_title",
      "source_publisher",
      "source_url",
      "is_demo_data",
    ],
    metrics.map((m) => [
      m.project.slug,
      m.project.name,
      m.metricType,
      m.numericValue,
      m.textValue,
      m.unit,
      m.confidenceLevel,
      m.effectiveDate,
      m.methodology,
      m.source?.title,
      m.source?.publisher,
      m.source?.url,
      m.project.isDemoData ? "TRUE" : "FALSE",
    ]),
  );
}

/** Downloadable blank templates for the CSV importers. */
export const CSV_TEMPLATES = {
  projects: toCsv(
    [
      "name",
      "owner",
      "project_type",
      "status",
      "city",
      "state_region",
      "country",
      "latitude",
      "longitude",
      "announcement_date",
      "expected_opening_date",
      "actual_opening_date",
      "estimated_power_mw",
      "confirmed_power_mw",
      "estimated_gpu_count",
      "confirmed_gpu_count",
      "gpu_model",
      "compute_platform",
      "estimated_capex_usd",
      "confirmed_capex_usd",
      "square_feet",
      "cooling_technology",
      "power_source",
      "utility_provider",
      "confidence_score",
      "tags",
      "analyst_notes",
    ],
    [
      [
        "Example AI Campus Phase 1",
        "Microsoft",
        "HYPERSCALE_CAMPUS",
        "UNDER_CONSTRUCTION",
        "Ashburn",
        "Virginia",
        "United States",
        "39.0438",
        "-77.4874",
        "2026-01-15",
        "2027-09-01",
        "",
        "450",
        "",
        "90000",
        "",
        "NVIDIA GB300",
        "NVIDIA Blackwell Ultra",
        "4200000000",
        "",
        "1200000",
        "Direct-to-chip liquid",
        "Grid",
        "Dominion Energy",
        "65",
        "NVIDIA; liquid cooling",
        "Leave a cell blank when a value is unknown. Never enter 0 for unknown.",
      ],
    ],
  ),
  companies: toCsv(
    [
      "name",
      "company_type",
      "ticker",
      "website",
      "headquarters_country",
      "description",
    ],
    [
      [
        "Example Neocloud",
        "NEOCLOUD",
        "EXMPL",
        "https://example.com",
        "United States",
        "GPU cloud provider.",
      ],
    ],
  ),
  sources: toCsv(
    [
      "project_slug",
      "title",
      "publisher",
      "url",
      "publication_date",
      "source_type",
      "reliability_score",
      "is_primary_source",
      "excerpt",
    ],
    [
      [
        "example-ai-campus-phase-1",
        "Company announces campus",
        "Microsoft",
        "https://news.microsoft.com/",
        "2026-01-15",
        "COMPANY_ANNOUNCEMENT",
        "95",
        "TRUE",
        "Quote the sentence that supports the claim.",
      ],
    ],
  ),
} as const;
