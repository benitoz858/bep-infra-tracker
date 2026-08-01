/**
 * Corrections from the 2026-08-01 adversarial re-verification.
 *
 *   DATABASE_URL=… npx tsx scripts/corrections-2026-08-01.ts [--apply]
 *
 * Three independent fact-checking passes re-researched every confirmed-power
 * claim, the eleven largest announced figures, and the eight early rows that
 * rested on aggregator citations. This script applies what they found. Kept in
 * the repo, not run-and-deleted: a public tracker's corrections are part of its
 * record, and every change here also writes a ProjectRevision row so the
 * project page shows what changed and why.
 *
 * The recurring failure it fixes: figures recorded as CONFIRMED that their
 * sources state as targets, and current-vs-target conflation (NAVER recorded at
 * its 2028 expansion figure rather than the 55 MW actually deployed). Which is
 * the exact error class this product exists to catch in others' numbers.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { ConfidenceLevel, ProjectStatus, SourceType } from "../src/generated/prisma/enums";

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type NewSource = {
  url: string;
  title: string;
  publisher: string;
  date: string | null;
  quote: string | null;
  sourceType: SourceType;
  isPrimary: boolean;
};

type Correction = {
  slug: string;
  summary: string;
  set?: {
    status?: ProjectStatus;
    estimatedPowerMw?: number | null;
    confirmedPowerMw?: number | null;
    estimatedGpuCount?: number | null;
    estimatedCapexUsd?: number | null;
    gpuModel?: string;
  };
  appendNote: string;
  addSources?: NewSource[];
  /** Replaces the methodology on the most recent POWER_MW claim. */
  powerMethodology?: string;
  powerConfidence?: ConfidenceLevel;
  addClaims?: {
    metricType: "POWER_MW" | "GPU_COUNT" | "CAPEX_USD";
    numericValue: number;
    unit: string;
    confidenceLevel: ConfidenceLevel;
    methodology: string;
    sourceUrl?: string;
  }[];
};

const EPOCH_NOTE =
  "Epoch AI's satellite-derived directory estimate — an analyst figure, not an operator statement, recorded at ESTIMATED confidence.";

const CORRECTIONS: Correction[] = [
  {
    slug: "stargate-abilene-texas",
    summary:
      "Correction: confirmed operating 300→200 MW (Oracle's own statement); Epoch's 421 MW IT added as a labelled estimate",
    set: { confirmedPowerMw: 200 },
    appendNote:
      "CORRECTION 2026-08-01: the previous 300 MW confirmed figure was Epoch's April total-facility-power estimate, which Epoch itself revised. Oracle stated 'In Abilene, 200MW is already operational' (April 2026) — that operator statement is what the confirmed column now carries. Epoch's live directory estimates 421 MW IT across Buildings 1–4 (May 2026), projecting 843 MW / all eight buildings by ~November 2026; recorded as a separate estimate. OpenAI capped the site at 1.2 GW in March 2026.",
    addSources: [
      {
        url: "https://epoch.ai/data/ai-data-centers/directory/openai-stargate-abilene",
        title: "OpenAI Stargate Abilene — Epoch AI Data Centers directory",
        publisher: "Epoch AI",
        date: "2026-05-23",
        quote: "Buildings 3 and 4 are estimated to be operational... 'In Abilene, 200MW is already operational'",
        sourceType: "INDUSTRY_REPORT",
        isPrimary: false,
      },
    ],
    powerMethodology:
      "Basis: IT load. 200 MW operator-confirmed operating (Oracle, April 2026). Site target 1.2 GW.",
    powerConfidence: "CONFIRMED",
    addClaims: [
      {
        metricType: "POWER_MW",
        numericValue: 421,
        unit: "MW",
        confidenceLevel: "ESTIMATED",
        methodology: `Basis: IT load. ${EPOCH_NOTE} Buildings 1–4 operational; 843 MW projected by Q4 2026.`,
        sourceUrl: "https://epoch.ai/data/ai-data-centers/directory/openai-stargate-abilene",
      },
    ],
  },
  {
    slug: "xai-colossus-1",
    summary:
      "Correction: 300 MW was a design target misrecorded as confirmed operating power; GPU count (230k) stands on Musk's statement",
    set: { confirmedPowerMw: null, estimatedPowerMw: 300 },
    appendNote:
      "CORRECTION 2026-08-01: the 300 MW previously shown as confirmed was Tom's Hardware's Phase 1+2 consumption target, wrongly attributed to a Musk statement that covered only the GPU count. Documented power: 150 MW grid interconnection energized May 2025 (MLGW/TVA), a further 150 MW approved February 2026 (energization unconfirmed), and ~247 MW of permitted on-site gas generation. The 230,000-GPU figure is primary (Musk, July 2025) and stands. Recent reporting has Colossus 1 shifted to inference duty.",
    powerMethodology:
      "Basis: site power. Phase 1+2 design target — not measured operating draw. 150 MW grid energized May 2025; ~247 MW on-site generation permitted.",
    powerConfidence: "MEDIUM",
  },
  {
    slug: "kddi-osaka-sakai-data-center-former-sharp-sakai-plant",
    summary:
      "Correction: 48 MW reclassified from confirmed to estimated — KDDI's own release states no megawatt figure; 48 MW is trade-press facility capacity",
    set: { confirmedPowerMw: null, estimatedPowerMw: 48 },
    appendNote:
      "CORRECTION 2026-08-01: operations since 2026-01-22 are primary-sourced (KDDI), but the 48 MW figure appears only in trade press and describes facility capacity, not critical IT load. Reclassified from confirmed operating to an estimate accordingly.",
    powerMethodology:
      "Basis: site power. Facility capacity per trade press; KDDI's own releases state no megawatt figure. Operating since 2026-01-22 (KDDI, primary).",
    powerConfidence: "MEDIUM",
  },
  {
    slug: "poolside-project-horizon-fort-stockton",
    summary:
      "Status correction: ANNOUNCED → PAUSED — CoreWeave lease terminated March 2026, site idle, revival talks quiet",
    set: { status: "PAUSED" },
    appendNote:
      "CORRECTION 2026-08-01: the CoreWeave anchor lease was terminated in late March 2026 after Poolside's ~$2B raise failed to close; the site sits idle. A scaled-down ~400 MW revival with Google was mooted and those talks have gone quiet. The 2 GW figure remains the announced campus plan only; PAUSED removes it from the credible pipeline.",
  },
  {
    slug: "xai-colossus-2-memphis",
    summary:
      "Correction: GPU estimate 555k→440k installed (Epoch); 2 GW clarified as Musk's post-third-building target, ~946 MW IT operating",
    set: { estimatedGpuCount: 440000 },
    appendNote:
      "CORRECTION 2026-08-01: the 2 GW figure is Musk's claimed total site capacity after the third-building purchase (Dec 2025), not current capacity — Epoch estimates 946 MW IT operating (Aug 2026), projecting 1,531 MW by Q1 2027. The prior 555k GPU figure was an Introl estimate; Musk's own statement was 550k GB200/GB300s as a first batch, and Epoch estimates ~440k Blackwell chips installed, which is now recorded.",
    powerMethodology:
      "Basis: site power. Musk-claimed total after third building; ~946 MW IT operating per Epoch (Aug 2026), 1,531 MW projected Q1 2027.",
    powerConfidence: "MEDIUM",
    addSources: [
      {
        url: "https://epoch.ai/data/ai-data-centers/directory/colossus-2",
        title: "Colossus 2 — Epoch AI Data Centers directory",
        publisher: "Epoch AI",
        date: "2026-08-01",
        quote: "1,112k H100-equivalents of compute, supported by 946 MW of IT power",
        sourceType: "INDUSTRY_REPORT",
        isPrimary: false,
      },
    ],
  },
  {
    slug: "meta-hyperion-louisiana",
    summary:
      "Update: Meta formally expanded Hyperion to 5 GW / $50B+ (July 2026); primary source replaces aggregator citation",
    set: { estimatedCapexUsd: 50_000_000_000 },
    appendNote:
      "UPDATE 2026-08-01: Meta's July 13, 2026 announcement formally expanded Hyperion to 5 GW and more than $50B (from 2 GW/~$27B). Committed phase: 2 GW by 2030; full build reported ~2032. Nothing is operating yet — Epoch projects 1,676 MW IT by Q1 2028.",
    addSources: [
      {
        url: "https://datacenters.atmeta.com/2026/07/deepening-our-investment-in-richland-parish-louisiana/",
        title: "Deepening our investment in Richland Parish, Louisiana",
        publisher: "Meta",
        date: "2026-07-13",
        quote: "5 GW in compute capacity — the largest in Meta's fleet",
        sourceType: "COMPANY_ANNOUNCEMENT",
        isPrimary: true,
      },
    ],
    addClaims: [
      {
        metricType: "CAPEX_USD",
        numericValue: 50_000_000_000,
        unit: "USD",
        confidenceLevel: "HIGH",
        methodology: "Meta's own announcement: 'more than $50 billion in the Richland Parish region'.",
        sourceUrl: "https://datacenters.atmeta.com/2026/07/deepening-our-investment-in-richland-parish-louisiana/",
      },
    ],
  },
  {
    slug: "meta-prometheus-new-albany",
    summary:
      "Update: Prometheus is running — status → PARTIALLY_OPERATIONAL, Epoch estimates 631 MW IT of the ~1 GW nameplate",
    set: { status: "PARTIALLY_OPERATIONAL" },
    appendNote:
      "UPDATE 2026-08-01: Epoch lists Prometheus operational at an estimated 631 MW IT (854 MW projected by Q4 2026) against the ~1 GW announced cluster scale. Status moved to partially operational; the 1 GW figure remains the announced nameplate. Not operator-confirmed capacity, so nothing enters the confirmed column.",
    addSources: [
      {
        url: "https://epoch.ai/data/ai-data-centers/directory/meta-prometheus",
        title: "Meta Prometheus — Epoch AI Data Centers directory",
        publisher: "Epoch AI",
        date: "2026-05-28",
        quote: "631 MW",
        sourceType: "INDUSTRY_REPORT",
        isPrimary: false,
      },
    ],
    addClaims: [
      {
        metricType: "POWER_MW",
        numericValue: 631,
        unit: "MW",
        confidenceLevel: "ESTIMATED",
        methodology: `Basis: IT load. ${EPOCH_NOTE}`,
        sourceUrl: "https://epoch.ai/data/ai-data-centers/directory/meta-prometheus",
      },
    ],
  },
  {
    slug: "microsoft-fairwater-atlanta",
    summary:
      "Update: 350 MW launch floor was badly stale — Epoch estimates 636 MW IT across four operational buildings; status → PARTIALLY_OPERATIONAL",
    set: { status: "PARTIALLY_OPERATIONAL", estimatedPowerMw: 636 },
    appendNote:
      "UPDATE 2026-08-01: the 350 MW figure was the building-1 floor at the November 2025 launch. Epoch now estimates 636 MW IT with buildings 3 and 4 operational by June 2026. Microsoft's own materials still state no megawatt figure, so this is an analyst estimate, not confirmed capacity.",
    addSources: [
      {
        url: "https://epoch.ai/data/ai-data-centers/directory/microsoft-fairwater-atlanta",
        title: "Microsoft Fairwater Atlanta — Epoch AI Data Centers directory",
        publisher: "Epoch AI",
        date: "2026-08-01",
        quote: "636 MW",
        sourceType: "INDUSTRY_REPORT",
        isPrimary: false,
      },
    ],
    powerMethodology: `Basis: IT load. ${EPOCH_NOTE} Prior 350 MW was the reported building-1 floor at launch.`,
    powerConfidence: "ESTIMATED",
  },
  {
    slug: "microsoft-fairwater-wisconsin",
    summary:
      "Update: first facility complete and fully operational (Microsoft, June 2026); estimate refined 350→369 MW IT; status → PARTIALLY_OPERATIONAL",
    set: { status: "PARTIALLY_OPERATIONAL", estimatedPowerMw: 369 },
    appendNote:
      "UPDATE 2026-08-01: Microsoft announced completion of the first Mount Pleasant facility on 2026-06-23 ('now fully operational'). Epoch estimates 369 MW IT currently, projecting 2,263 MW by Q2 2028 with the second facility (2028); Microsoft has separately proposed two further Mount Pleasant campuses (~$13.3B, ~2 GW). No operator megawatt figure exists, so the capacity stays an estimate.",
    addSources: [
      {
        url: "https://news.microsoft.com/source/2026/06/23/microsoft-completes-construction-on-first-datacenter-facility-in-mount-pleasant-wisconsin/",
        title: "Microsoft completes construction on first datacenter facility in Mount Pleasant, Wisconsin",
        publisher: "Microsoft",
        date: "2026-06-23",
        quote: "With our Fairwater datacenter now fully operational, Wisconsin is now home to the world's most powerful supercomputer.",
        sourceType: "COMPANY_ANNOUNCEMENT",
        isPrimary: true,
      },
    ],
    powerMethodology: `Basis: IT load. ${EPOCH_NOTE}`,
    powerConfidence: "ESTIMATED",
  },
  {
    slug: "project-rainier-new-carlisle",
    summary:
      "Update: IT-vs-site ambiguity resolved — Epoch estimates 910 MW IT; >1M Trainium2 chips per Amazon; full site >2.2 GW at completion",
    set: { estimatedPowerMw: 910, estimatedGpuCount: 1045000, gpuModel: "AWS Trainium2" },
    appendNote:
      "UPDATE 2026-08-01: the prior 1,000 MW figure did not distinguish IT load from site power. Epoch estimates 910 MW IT operating (1,925 MW projected by Q1 2028); Amazon's own materials state 'more than 1 million Trainium2 chips' by end-2025, with Epoch estimating 1,045k. CNBC reports the full ~30-building site will draw more than 2.2 GW at completion.",
    addSources: [
      {
        url: "https://epoch.ai/data/ai-data-centers/directory/anthropic-amazon-new-carlisle",
        title: "Anthropic / Amazon New Carlisle — Epoch AI Data Centers directory",
        publisher: "Epoch AI",
        date: "2026-08-01",
        quote: "an estimated 686k H100-equivalents of compute, supported by 910 MW of IT power",
        sourceType: "INDUSTRY_REPORT",
        isPrimary: false,
      },
      {
        url: "https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster",
        title: "AWS Project Rainier: AI Trainium chips compute cluster",
        publisher: "Amazon",
        date: "2025-10-29",
        quote: "nearly half a million Trainium2 chips",
        sourceType: "COMPANY_ANNOUNCEMENT",
        isPrimary: true,
      },
    ],
    powerMethodology: `Basis: IT load. ${EPOCH_NOTE} Full site reported >2.2 GW at completion (~30 buildings).`,
    powerConfidence: "ESTIMATED",
  },
  {
    slug: "naver-gak-sejong-ai-factory",
    summary:
      "Correction: 200 MW was the 2028 expansion target, not current capacity — corrected to the 55 MW initial deployment",
    set: { estimatedPowerMw: 55 },
    appendNote:
      "CORRECTION 2026-08-01: the NVIDIA/NAVER/Brookfield announcement (2026-07-24) is explicit that the DSX buildout expands 'from 55 megawatts to 200 megawatts by 2028'. The row previously carried the 2028 target as if current; it now records 55 MW, with 200 MW by 2028 and a stated 1 GW long-term intent held as targets.",
    addSources: [
      {
        url: "https://nvidianews.nvidia.com/news/naver-nvidia-and-brookfield-to-expand-koreas-national-ai-factory-infrastructure-buildout",
        title: "NAVER, NVIDIA and Brookfield to Expand Korea's National AI Factory Infrastructure Buildout",
        publisher: "NVIDIA / NAVER / Brookfield",
        date: "2026-07-24",
        quote: "expand the initial NVIDIA DSX AI factory buildout at GAK Sejong data center from 55 megawatts to 200 megawatts by 2028",
        sourceType: "COMPANY_ANNOUNCEMENT",
        isPrimary: true,
      },
    ],
    powerMethodology:
      "Basis: unclear. 55 MW initial DSX deployment per the joint announcement; 200 MW by 2028 and 1 GW long-term are targets, not current capacity.",
    powerConfidence: "HIGH",
  },
  {
    slug: "stargate-michigan-saline-township",
    summary: "Update: capex now corroborated at ~$16B by multiple outlets (was withheld over $7–16B conflict)",
    set: { estimatedCapexUsd: 16_000_000_000 },
    appendNote:
      "UPDATE 2026-08-01: capex was previously withheld because reports conflicted ($7B at announcement vs $16B later). Multiple outlets (CNBC at groundbreaking, Tom's Hardware, Manchester Mirror) now consistently report ~$16B; recorded at MEDIUM confidence. The $7B origin figure is retained here for the record.",
    addClaims: [
      {
        metricType: "CAPEX_USD",
        numericValue: 16_000_000_000,
        unit: "USD",
        confidenceLevel: "MEDIUM",
        methodology:
          "Consistently reported by multiple outlets since the June 2026 groundbreaking; not confirmed by the companies. Announcement-era reports said ~$7B.",
      },
    ],
  },
  {
    slug: "campus-ia-fouju-ile-de-france",
    summary:
      "Update: French Senate record shows only 700 MW of the 1.4 GW has been contracted with RTE",
    appendNote:
      "UPDATE 2026-08-01: a French Senate question record (May 2026) confirms the 1.4 GW target and the public inquiry (open 30 April–30 May 2026), and states that only 700 MW has so far been contracted with grid operator RTE — half the headline figure. MGX holds a majority of the capital.",
    addSources: [
      {
        url: "https://www.senat.fr/questions/base/2026/qSEQ260508929.html",
        title: "Question écrite — data center Campus IA (Fouju)",
        publisher: "Sénat (France)",
        date: "2026-05-01",
        quote: "une puissance électrique de 1,4 gigawatt",
        sourceType: "GOVERNMENT_FILING",
        isPrimary: true,
      },
    ],
  },
];

async function main() {
  console.log(APPLY ? "APPLYING corrections" : "DRY RUN — pass --apply to write");
  let applied = 0;

  for (const c of CORRECTIONS) {
    const project = await prisma.project.findUnique({
      where: { slug: c.slug },
      select: {
        id: true,
        name: true,
        status: true,
        estimatedPowerMw: true,
        confirmedPowerMw: true,
        estimatedGpuCount: true,
        estimatedCapexUsd: true,
        analystNotes: true,
      },
    });
    if (!project) {
      console.log(`  MISSING ${c.slug}`);
      continue;
    }

    console.log(`\n  ${project.name}`);
    console.log(`    ${c.summary}`);

    if (!APPLY) {
      applied += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          ...(c.set ?? {}),
          analystNotes: [project.analystNotes, c.appendNote].filter(Boolean).join("\n\n"),
          lastVerifiedAt: new Date(),
        },
      });

      // The correction is part of the public record: one revision row per
      // project, carrying before/after for the fields that moved.
      await tx.projectRevision.create({
        data: {
          projectId: project.id,
          userId: null,
          changeSummary: c.summary,
          previousData: {
            status: project.status,
            estimatedPowerMw: project.estimatedPowerMw?.toString() ?? null,
            confirmedPowerMw: project.confirmedPowerMw?.toString() ?? null,
            estimatedGpuCount: project.estimatedGpuCount,
            estimatedCapexUsd: project.estimatedCapexUsd?.toString() ?? null,
          },
          newData: (c.set as object) ?? {},
        },
      });

      const sourceIdByUrl = new Map<string, string>();
      for (const s of c.addSources ?? []) {
        const existing = await tx.source.findFirst({
          where: { projectId: project.id, url: s.url },
          select: { id: true },
        });
        if (existing) {
          sourceIdByUrl.set(s.url, existing.id);
          continue;
        }
        const created = await tx.source.create({
          data: {
            projectId: project.id,
            url: s.url,
            title: s.title,
            publisher: s.publisher,
            publicationDate: s.date ? new Date(s.date) : null,
            sourceType: s.sourceType,
            excerpt: s.quote,
            isPrimarySource: s.isPrimary,
            reliabilityScore: s.isPrimary ? 95 : 85,
            accessedAt: new Date(),
          },
          select: { id: true },
        });
        sourceIdByUrl.set(s.url, created.id);
      }

      if (c.powerMethodology) {
        const claim = await tx.projectMetric.findFirst({
          where: { projectId: project.id, metricType: "POWER_MW" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (claim) {
          await tx.projectMetric.update({
            where: { id: claim.id },
            data: {
              methodology: c.powerMethodology,
              ...(c.powerConfidence ? { confidenceLevel: c.powerConfidence } : {}),
            },
          });
        }
      }

      for (const claim of c.addClaims ?? []) {
        await tx.projectMetric.create({
          data: {
            projectId: project.id,
            metricType: claim.metricType,
            numericValue: claim.numericValue,
            unit: claim.unit,
            confidenceLevel: claim.confidenceLevel,
            methodology: claim.methodology,
            sourceId: claim.sourceUrl ? (sourceIdByUrl.get(claim.sourceUrl) ?? null) : null,
          },
        });
      }
    });

    applied += 1;
  }

  // Restriction fix: the DeKalb PDF moved; Legistar is the durable citation.
  const dekalb = await prisma.restriction.findFirst({
    where: { jurisdiction: "DeKalb County" },
    select: { id: true, analystNotes: true },
  });
  if (dekalb) {
    console.log("\n  DeKalb County restriction: replacing dead PDF link with Legistar records");
    if (APPLY) {
      const dead = await prisma.restrictionSource.findFirst({
        where: { restrictionId: dekalb.id, url: { contains: "dekalbcountyga.gov" } },
        select: { id: true },
      });
      if (dead) {
        await prisma.restrictionSource.update({
          where: { id: dead.id },
          data: {
            url: "https://dekalbcountyga.legistar.com/View.ashx?GUID=A97456B9-FD6D-4105-87CC-123B8262FC82&ID=15070878&M=F",
            title: "DeKalb County Board minutes, 2025-12-16 — item 2025-1694 (moratorium extension)",
            publisher: "DeKalb County (Legistar)",
            sourceType: "GOVERNMENT_FILING",
            isPrimarySource: true,
            accessedAt: new Date(),
          },
        });
      }
      await prisma.restrictionSource.create({
        data: {
          restrictionId: dekalb.id,
          url: "https://dekalbcountyga.legistar.com/LegislationDetail.aspx?ID=8123112&GUID=885481A2-03E8-4D33-A099-9C50BC485DCD",
          title: "Resolution 2026-1109 — extending the data-center moratorium (July 2026 agenda)",
          publisher: "DeKalb County (Legistar)",
          publicationDate: new Date("2026-07-07"),
          sourceType: "GOVERNMENT_FILING",
          isPrimarySource: true,
          accessedAt: new Date(),
        },
      });
      await prisma.restriction.update({
        where: { id: dekalb.id },
        data: {
          analystNotes: [
            dekalb.analystNotes,
            "UPDATE 2026-08-01: the county's original PDF link went dead; citations now point at Legistar. The moratorium has been extended repeatedly — the Dec 2025 minutes extended it to 2026-06-23 (after a longer extension failed 3–4), a further extension runs through 2026-09-30, and resolution 2026-1109 (July 2026 agenda) is the latest instrument; its outcome should be verified.",
          ]
            .filter(Boolean)
            .join("\n\n"),
          lastVerifiedAt: new Date(),
        },
      });
    }
    applied += 1;
  }

  console.log(`\n${applied} correction(s) ${APPLY ? "applied" : "would apply"}`);
  await prisma.$disconnect();
}

void main();
