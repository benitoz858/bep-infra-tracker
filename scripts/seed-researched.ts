/**
 * Seeds researched projects — with their sources and claims — into whatever
 * database DATABASE_URL points at.
 *
 *   DATABASE_URL=… npx tsx scripts/seed-researched.ts data/research/merged.json
 *
 * Input is the reviewed research JSON (see scripts/research-schema note below).
 * The shape rules mirror the hand-seeded originals:
 *
 * - The denormalised columns hold the current best answer; every figure also
 *   becomes a ProjectMetric row citing its source, so nothing on a project page
 *   is unattributed.
 * - `confirmed*` columns are only set when the research marked the capacity as
 *   actually energized; announced targets go to `estimated*`.
 * - Confidence ceiling by evidence: a primary company statement caps at HIGH,
 *   trade press at MEDIUM, single-source aggregation at LOW. CONFIRMED is
 *   reserved for operating capacity stated by a primary source.
 * - Idempotent by slug: an existing project is skipped, never overwritten —
 *   re-running after a partial failure must not clobber later hand edits.
 */
import fs from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { CompanyType, ConfidenceLevel, ProjectStatus, ProjectType, SourceType } from "../src/generated/prisma/enums";

type ResearchSource = {
  url: string;
  title: string;
  publisher: string | null;
  date: string | null;
  quote: string | null;
  sourceType: SourceType;
  isPrimary: boolean;
};

type ResearchProject = {
  name: string;
  slug: string;
  owner: string;
  ownerTicker: string | null;
  ownerType: CompanyType;
  projectType: ProjectType;
  status: ProjectStatus;
  city: string | null;
  stateRegion: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  powerMw: number | null;
  powerBasis: string;
  powerConfirmed: boolean;
  gpuCount: number | null;
  gpuModel: string | null;
  capexUsd: number | null;
  announcementDate: string | null;
  expectedOpening: string | null;
  sources: ResearchSource[];
  notes: string | null;
};

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx scripts/seed-researched.ts <merged.json>");
  process.exit(1);
}

const projects: ResearchProject[] = JSON.parse(fs.readFileSync(file, "utf8")).projects;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Evidence-based ceiling, applied regardless of what the research asserted. */
function confidenceFor(p: ResearchProject): ConfidenceLevel {
  const hasPrimary = p.sources.some((s) => s.isPrimary);
  if (p.powerConfirmed && hasPrimary) return "CONFIRMED";
  if (hasPrimary) return "HIGH";
  if (p.sources.length >= 2) return "MEDIUM";
  return "LOW";
}

function reliabilityFor(s: ResearchSource): number {
  if (s.isPrimary) return 95;
  const strong = /reuters|bloomberg|ft\.com|wsj|financial times|nikkei/i;
  const trade = /datacenterdynamics|datacenterfrontier|semianalysis/i;
  if (strong.test(`${s.publisher} ${s.url}`)) return 85;
  if (trade.test(`${s.publisher} ${s.url}`)) return 78;
  return 65;
}

function date(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  let added = 0;
  let skipped = 0;

  for (const p of projects) {
    const slug = p.slug || slugify(p.name);

    const existing = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      console.log(`  skip (exists)  ${slug}`);
      skipped += 1;
      continue;
    }

    const company =
      (await prisma.company.findFirst({ where: { name: p.owner }, select: { id: true } })) ??
      (await prisma.company.create({
        data: {
          name: p.owner,
          slug: slugify(p.owner),
          companyType: p.ownerType,
          ticker: p.ownerTicker,
        },
        select: { id: true },
      }));

    const confidence = confidenceFor(p);
    const confirmed = confidence === "CONFIRMED";

    const project = await prisma.project.create({
      data: {
        slug,
        name: p.name,
        ownerCompanyId: company.id,
        projectType: p.projectType,
        status: p.status,
        city: p.city,
        stateRegion: p.stateRegion,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
        announcementDate: date(p.announcementDate),
        expectedOpeningDate: date(p.expectedOpening),
        estimatedPowerMw: !confirmed && p.powerMw != null ? p.powerMw : null,
        confirmedPowerMw: confirmed && p.powerMw != null ? p.powerMw : null,
        estimatedGpuCount: !confirmed ? p.gpuCount : null,
        confirmedGpuCount: confirmed ? p.gpuCount : null,
        gpuModel: p.gpuModel,
        estimatedCapexUsd: p.capexUsd,
        analystNotes: p.notes,
        lastVerifiedAt: new Date(),
        isDemoData: false,
      },
      select: { id: true },
    });

    const sourceIds: string[] = [];
    for (const s of p.sources) {
      const src = await prisma.source.create({
        data: {
          projectId: project.id,
          title: s.title,
          publisher: s.publisher,
          url: s.url,
          publicationDate: date(s.date),
          sourceType: s.sourceType,
          excerpt: s.quote,
          reliabilityScore: reliabilityFor(s),
          isPrimarySource: s.isPrimary,
          accessedAt: new Date(),
        },
        select: { id: true },
      });
      sourceIds.push(src.id);
    }

    const cite = sourceIds[0] ?? null;
    const method = (extra: string) =>
      [`Basis: ${p.powerBasis}.`, extra, p.notes ? `Note: ${p.notes}` : null]
        .filter(Boolean)
        .join(" ");

    if (p.powerMw != null) {
      await prisma.projectMetric.create({
        data: {
          projectId: project.id,
          metricType: "POWER_MW",
          numericValue: p.powerMw,
          unit: "MW",
          confidenceLevel: confidence,
          methodology: method(confirmed ? "Stated as operating capacity." : "Announced target, not energized capacity."),
          sourceId: cite,
        },
      });
    }
    if (p.gpuCount != null) {
      await prisma.projectMetric.create({
        data: {
          projectId: project.id,
          metricType: "GPU_COUNT",
          numericValue: p.gpuCount,
          unit: "GPUs",
          confidenceLevel: confidence === "CONFIRMED" ? "CONFIRMED" : confidence,
          methodology: p.gpuModel ? `Model: ${p.gpuModel}.` : null,
          sourceId: cite,
        },
      });
    }
    if (p.capexUsd != null) {
      await prisma.projectMetric.create({
        data: {
          projectId: project.id,
          metricType: "CAPEX_USD",
          numericValue: p.capexUsd,
          unit: "USD",
          // Capex is announced spend, never "confirmed" by our definition.
          confidenceLevel: confidence === "CONFIRMED" ? "HIGH" : confidence,
          methodology: "Announced investment figure.",
          sourceId: cite,
        },
      });
    }

    console.log(`  added          ${slug}  (${confidence}, ${p.sources.length} source${p.sources.length === 1 ? "" : "s"})`);
    added += 1;
  }

  console.log(`\n${added} added, ${skipped} skipped (already present).`);
  await prisma.$disconnect();
}

void main();
