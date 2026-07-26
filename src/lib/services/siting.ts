import type { BindingLevel, GridRegion } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  BINDING_LEVEL_META,
  RESTRICTION_IMPACT_META,
  RESTRICTION_STATUS_META,
} from "@/lib/domain";
import { toNumber } from "@/lib/format";

/**
 * Siting risk.
 *
 * The number this file exists to produce is **MW actually at risk**, not a count
 * of ordinances. Three rules make it defensible, and all three are the reason a
 * naive version of this metric is wrong:
 *
 *  1. Only *blocking* bindingness counts. An advisory study and a permanent ban
 *     are both "moratoriums" in the press; counting them alike inflates the
 *     headline by whatever share of the list is procedural noise.
 *  2. Only *live* restrictions count. An expired or lifted restriction blocks
 *     nothing, and a proposed one has not blocked anything yet.
 *  3. Each project is counted **once**, at its largest affected capacity. A
 *     campus sitting under both a county moratorium and a state bill is one
 *     block of megawatts, not two, and summing the join rows would double-count
 *     precisely the biggest and most contested projects.
 */

/** Bindingness levels that actually stop a project. */
const BLOCKING_LEVELS = (Object.keys(BINDING_LEVEL_META) as BindingLevel[]).filter(
  (level) => BINDING_LEVEL_META[level].blocking,
);

/** Impacts that mean capacity is genuinely exposed. */
const AT_RISK_IMPACTS = (
  Object.keys(RESTRICTION_IMPACT_META) as (keyof typeof RESTRICTION_IMPACT_META)[]
).filter((impact) => RESTRICTION_IMPACT_META[impact].countsAtRisk);

/** Restriction statuses that are in force right now. */
const LIVE_STATUSES = (
  Object.keys(RESTRICTION_STATUS_META) as (keyof typeof RESTRICTION_STATUS_META)[]
).filter((status) => RESTRICTION_STATUS_META[status].live);

const LINK_INCLUDE = {
  project: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      country: true,
      stateRegion: true,
      city: true,
      gridRegion: true,
      estimatedPowerMw: true,
      confirmedPowerMw: true,
      isDemoData: true,
      ownerCompany: { select: { id: true, name: true, slug: true, ticker: true } },
    },
  },
  restriction: {
    select: {
      id: true,
      slug: true,
      jurisdiction: true,
      level: true,
      stateRegion: true,
      country: true,
      gridRegion: true,
      scope: true,
      bindingLevel: true,
      status: true,
      title: true,
      expiryDate: true,
      enactedDate: true,
      isDemoData: true,
    },
  },
} as const;

export type ExposureRow = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  ownerName: string | null;
  ownerTicker: string | null;
  gridRegion: GridRegion | null;
  country: string;
  /** MW counted for this project, after the once-only rule. */
  atRiskMw: number;
  /** Worst bindingness across every live restriction touching it. */
  worstBinding: BindingLevel;
  restrictionCount: number;
  isDemoData: boolean;
};

/**
 * Per-project exposure, deduplicated.
 *
 * `affectedMw` on the join wins where set (only a later phase blocked);
 * otherwise the project's best-available capacity is used. Where a project has
 * several live blocking restrictions, the largest affected figure is taken —
 * not the sum.
 */
export async function getExposureByProject(): Promise<ExposureRow[]> {
  const links = await prisma.projectRestriction.findMany({
    where: {
      impact: { in: AT_RISK_IMPACTS },
      restriction: {
        status: { in: LIVE_STATUSES },
        bindingLevel: { in: BLOCKING_LEVELS },
      },
      // A cancelled project's capacity is not pipeline, so it cannot be at risk.
      project: { status: { not: "CANCELLED" } },
    },
    include: LINK_INCLUDE,
  });

  const byProject = new Map<string, ExposureRow>();

  for (const link of links) {
    const projectMw =
      toNumber(link.project.confirmedPowerMw) ??
      toNumber(link.project.estimatedPowerMw) ??
      0;
    const affected = toNumber(link.affectedMw) ?? projectMw;

    const existing = byProject.get(link.projectId);
    if (!existing) {
      byProject.set(link.projectId, {
        projectId: link.projectId,
        projectName: link.project.name,
        projectSlug: link.project.slug,
        ownerName: link.project.ownerCompany?.name ?? null,
        ownerTicker: link.project.ownerCompany?.ticker ?? null,
        gridRegion: link.project.gridRegion,
        country: link.project.country,
        atRiskMw: affected,
        worstBinding: link.restriction.bindingLevel,
        restrictionCount: 1,
        isDemoData: link.project.isDemoData,
      });
      continue;
    }

    // Max, never sum — see rule 3 above.
    existing.atRiskMw = Math.max(existing.atRiskMw, affected);
    existing.restrictionCount += 1;
    if (
      BINDING_LEVEL_META[link.restriction.bindingLevel].score >
      BINDING_LEVEL_META[existing.worstBinding].score
    ) {
      existing.worstBinding = link.restriction.bindingLevel;
    }
  }

  return [...byProject.values()].sort((a, b) => b.atRiskMw - a.atRiskMw);
}

export type SitingSummary = {
  atRiskMw: number;
  projectsAtRisk: number;
  liveRestrictions: number;
  totalRestrictions: number;
  /** Live restrictions whose bindingness does not actually block anything. */
  nonBlockingLive: number;
  jurisdictions: number;
  expiringWithin12Months: number;
  /** Share of tracked live pipeline MW that is under a blocking restriction. */
  shareOfPipelinePct: number;
};

export async function getSitingSummary(now = new Date()): Promise<SitingSummary> {
  const [exposure, restrictionCounts, pipeline] = await Promise.all([
    getExposureByProject(),
    prisma.restriction.findMany({
      select: { id: true, status: true, bindingLevel: true, jurisdiction: true, expiryDate: true },
    }),
    prisma.$queryRaw<{ mw: number | null }[]>`
      SELECT SUM(COALESCE("confirmedPowerMw", "estimatedPowerMw"))::float8 AS mw
      FROM "Project"
      WHERE status <> 'CANCELLED'
    `,
  ]);

  const live = restrictionCounts.filter((r) =>
    LIVE_STATUSES.includes(r.status as (typeof LIVE_STATUSES)[number]),
  );
  const atRiskMw = exposure.reduce((sum, row) => sum + row.atRiskMw, 0);
  const pipelineMw = pipeline[0]?.mw ?? 0;

  const horizon = new Date(now);
  horizon.setUTCMonth(horizon.getUTCMonth() + 12);

  return {
    atRiskMw,
    projectsAtRisk: exposure.length,
    liveRestrictions: live.length,
    totalRestrictions: restrictionCounts.length,
    // Surfaced deliberately: it is the size of the gap between "ordinances
    // tracked" and "capacity blocked", which is the point of the whole page.
    nonBlockingLive: live.filter((r) => !BINDING_LEVEL_META[r.bindingLevel].blocking).length,
    jurisdictions: new Set(restrictionCounts.map((r) => r.jurisdiction)).size,
    expiringWithin12Months: live.filter(
      (r) => r.expiryDate && r.expiryDate > now && r.expiryDate <= horizon,
    ).length,
    shareOfPipelinePct: pipelineMw > 0 ? Math.round((atRiskMw / pipelineMw) * 1000) / 10 : 0,
  };
}

export type GroupedExposure = { key: string; label: string; mw: number; projects: number };

/** MW at risk by grid region — the transmission-level view. */
export async function getExposureByGridRegion(): Promise<GroupedExposure[]> {
  const rows = await getExposureByProject();
  const byRegion = new Map<string, GroupedExposure>();

  for (const row of rows) {
    const key = row.gridRegion ?? "UNASSIGNED";
    const entry = byRegion.get(key) ?? {
      key,
      label: key === "UNASSIGNED" ? "Not assigned" : key,
      mw: 0,
      projects: 0,
    };
    entry.mw += row.atRiskMw;
    entry.projects += 1;
    byRegion.set(key, entry);
  }

  return [...byRegion.values()].sort((a, b) => b.mw - a.mw);
}

/** MW at risk by owner, with ticker — the tradeable view. */
export async function getExposureByOwner(): Promise<
  (GroupedExposure & { ticker: string | null })[]
> {
  const rows = await getExposureByProject();
  const byOwner = new Map<string, GroupedExposure & { ticker: string | null }>();

  for (const row of rows) {
    const key = row.ownerName ?? "Unattributed";
    const entry = byOwner.get(key) ?? {
      key,
      label: key,
      ticker: row.ownerTicker,
      mw: 0,
      projects: 0,
    };
    entry.mw += row.atRiskMw;
    entry.projects += 1;
    byOwner.set(key, entry);
  }

  return [...byOwner.values()].sort((a, b) => b.mw - a.mw);
}

/**
 * Restrictions due to expire, soonest first.
 *
 * Tracked as deliberately as new restrictions because an expiry is the release
 * of blocked capacity — a positive catalyst that nobody publishes a list of.
 * A TEMPORARY_BAN with no published end date is included with a null date, so
 * the missing information is visible rather than read as "indefinite".
 */
export async function getExpiryCalendar(now = new Date(), monthsAhead = 24) {
  const horizon = new Date(now);
  horizon.setUTCMonth(horizon.getUTCMonth() + monthsAhead);

  const restrictions = await prisma.restriction.findMany({
    where: {
      status: { in: LIVE_STATUSES },
      OR: [
        { expiryDate: { gte: now, lte: horizon } },
        { AND: [{ bindingLevel: "TEMPORARY_BAN" }, { expiryDate: null }] },
      ],
    },
    include: {
      projects: {
        where: { impact: { in: AT_RISK_IMPACTS } },
        include: LINK_INCLUDE,
      },
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }],
  });

  return restrictions.map((r) => {
    const mw = r.projects.reduce((sum, link) => {
      const projectMw =
        toNumber(link.project.confirmedPowerMw) ??
        toNumber(link.project.estimatedPowerMw) ??
        0;
      return sum + (toNumber(link.affectedMw) ?? projectMw);
    }, 0);

    return {
      id: r.id,
      slug: r.slug,
      jurisdiction: r.jurisdiction,
      title: r.title,
      bindingLevel: r.bindingLevel,
      expiryDate: r.expiryDate,
      /** True when a time-limited ban never published an end date. */
      endDateUnpublished: r.bindingLevel === "TEMPORARY_BAN" && r.expiryDate === null,
      releasedMw: mw,
      projectCount: r.projects.length,
      isDemoData: r.isDemoData,
    };
  });
}

/**
 * Adoption base rate.
 *
 * What share of restrictions that reached a decision were actually adopted.
 * Proposed items are excluded — they have not been decided, and counting them
 * as failures would flatter the "most of these never pass" narrative.
 */
export async function getAdoptionBaseRate() {
  const rows = await prisma.restriction.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const count = (status: string) =>
    rows.find((r) => r.status === status)?._count._all ?? 0;

  const adopted = count("ACTIVE") + count("EXPIRED") + count("LIFTED") + count("SUPERSEDED");
  const rejected = count("REJECTED");
  const decided = adopted + rejected;

  return {
    adopted,
    rejected,
    pending: count("PROPOSED"),
    decided,
    adoptionRatePct: decided > 0 ? Math.round((adopted / decided) * 1000) / 10 : null,
  };
}

export async function listRestrictions() {
  return prisma.restriction.findMany({
    orderBy: [{ status: "asc" }, { bindingLevel: "desc" }, { jurisdiction: "asc" }],
    include: {
      _count: { select: { projects: true, sources: true } },
    },
  });
}

export async function getRestrictionBySlug(slug: string) {
  return prisma.restriction.findUnique({
    where: { slug },
    include: {
      sources: { orderBy: [{ isPrimarySource: "desc" }, { publicationDate: "desc" }] },
      projects: { include: LINK_INCLUDE },
    },
  });
}
