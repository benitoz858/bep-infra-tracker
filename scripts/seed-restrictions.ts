/**
 * Seeds researched siting restrictions — with their sources and any explicit
 * project links — into whatever database DATABASE_URL points at.
 *
 *   DATABASE_URL=… npx tsx scripts/seed-restrictions.ts <restrictions.json>
 *
 * Shape rules, mirroring the project seeder:
 * - Idempotent by slug; existing restrictions are skipped, never overwritten.
 * - Every restriction carries at least one source with a quote.
 * - Project links are explicit and analyst-reviewed, never inferred from
 *   location strings — the input's `affectedProjects` names are resolved
 *   against existing projects by exact name match, and anything that does not
 *   resolve is reported rather than silently dropped, because a broken link
 *   is a review item, not a rounding error.
 * - A missing expiry on a TEMPORARY_BAN stays null: the schema deliberately
 *   surfaces "no end date was ever published" instead of inventing one.
 */
import fs from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type {
  BindingLevel,
  GridRegion,
  JurisdictionLevel,
  RestrictionImpact,
  RestrictionScope,
  RestrictionStatus,
  SourceType,
} from "../src/generated/prisma/enums";

type InputSource = {
  url: string;
  title: string;
  publisher: string | null;
  date: string | null;
  quote: string | null;
  sourceType: SourceType;
  isPrimary: boolean;
};

type InputRestriction = {
  jurisdiction: string;
  level: JurisdictionLevel;
  stateRegion: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  gridRegion: GridRegion | null;
  scope: RestrictionScope;
  bindingLevel: BindingLevel;
  status: RestrictionStatus;
  title: string;
  summary: string | null;
  citation: string | null;
  proposedDate: string | null;
  enactedDate: string | null;
  expiryDate: string | null;
  liftedDate?: string | null;
  affectedProjects?: { name: string; impact: RestrictionImpact; note?: string | null }[];
  sources: InputSource[];
  notes?: string | null;
};

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx scripts/seed-restrictions.ts <restrictions.json>");
  process.exit(1);
}

const input: InputRestriction[] = JSON.parse(fs.readFileSync(file, "utf8")).restrictions;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function date(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function reliabilityFor(s: InputSource): number {
  if (s.isPrimary || s.sourceType === "GOVERNMENT_FILING") return 92;
  if (/reuters|bloomberg|ft\.com|wsj/i.test(`${s.publisher} ${s.url}`)) return 85;
  if (/datacenterdynamics|datacenterfrontier/i.test(`${s.publisher} ${s.url}`)) return 78;
  return 65;
}

async function main() {
  let added = 0;
  let skipped = 0;
  const unresolved: string[] = [];

  for (const r of input) {
    const slug = slugify(`${r.jurisdiction}-${r.title}`).slice(0, 90);

    const existing = await prisma.restriction.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      console.log(`  skip (exists)  ${slug}`);
      skipped += 1;
      continue;
    }

    const created = await prisma.restriction.create({
      data: {
        slug,
        jurisdiction: r.jurisdiction,
        level: r.level,
        stateRegion: r.stateRegion,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        gridRegion: r.gridRegion,
        scope: r.scope,
        bindingLevel: r.bindingLevel,
        status: r.status,
        title: r.title,
        summary: r.summary,
        citation: r.citation,
        proposedDate: date(r.proposedDate),
        enactedDate: date(r.enactedDate),
        expiryDate: date(r.expiryDate),
        liftedDate: date(r.liftedDate),
        analystNotes: r.notes ?? null,
        lastVerifiedAt: new Date(),
        isDemoData: false,
      },
      select: { id: true },
    });

    for (const s of r.sources) {
      await prisma.restrictionSource.create({
        data: {
          restrictionId: created.id,
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
      });
    }

    let links = 0;
    for (const ap of r.affectedProjects ?? []) {
      const project = await prisma.project.findFirst({
        where: { name: ap.name },
        select: { id: true },
      });
      if (!project) {
        unresolved.push(`${r.jurisdiction} -> "${ap.name}"`);
        continue;
      }
      await prisma.projectRestriction.create({
        data: {
          projectId: project.id,
          restrictionId: created.id,
          impact: ap.impact,
          notes: ap.note ?? null,
        },
      });
      links += 1;
    }

    console.log(
      `  added          ${slug}  (${r.bindingLevel}/${r.status}, ${r.sources.length} src, ${links} project link${links === 1 ? "" : "s"})`,
    );
    added += 1;
  }

  console.log(`\n${added} added, ${skipped} skipped.`);
  if (unresolved.length) {
    console.log(`UNRESOLVED project links (fix names and re-run, or link by hand):`);
    for (const u of unresolved) console.log(`  ${u}`);
  }
  await prisma.$disconnect();
}

void main();
