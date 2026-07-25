import type { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { LIVE_STATUSES } from "@/lib/domain";
import { toNumber } from "@/lib/format";

/**
 * Read-only aggregations for the dashboard and analytics pages.
 *
 * Two conventions hold throughout:
 *
 * 1. "Announced" capacity uses COALESCE(confirmed, estimated) — the best
 *    available figure per project. "Confirmed" capacity counts only rows with a
 *    confirmed value. The two are always reported separately so the UI never
 *    implies an estimate is a fact.
 * 2. Cancelled projects are excluded from forward-looking capacity totals but
 *    remain queryable, because a cancelled 250 MW campus is not pipeline.
 */

export type DashboardSummary = {
  totalProjects: number;
  liveProjects: number;
  announcedPowerMw: number;
  confirmedPowerMw: number;
  estimatedGpuCount: number;
  confirmedGpuCount: number;
  announcedCapexUsd: number;
  countriesCovered: number;
  demoDataCount: number;
  needsVerificationCount: number;
};

/** COALESCE-based totals; done in SQL so 10k projects stay a single round trip. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [totals, counts] = await Promise.all([
    prisma.$queryRaw<
      {
        announced_mw: number | null;
        confirmed_mw: number | null;
        est_gpu: bigint | null;
        conf_gpu: bigint | null;
        announced_capex: number | null;
        countries: bigint;
      }[]
    >`
      SELECT
        SUM(COALESCE("confirmedPowerMw", "estimatedPowerMw"))::float8   AS announced_mw,
        SUM("confirmedPowerMw")::float8                                 AS confirmed_mw,
        SUM(COALESCE("confirmedGpuCount", "estimatedGpuCount"))         AS est_gpu,
        SUM("confirmedGpuCount")                                        AS conf_gpu,
        SUM(COALESCE("confirmedCapexUsd", "estimatedCapexUsd"))::float8 AS announced_capex,
        COUNT(DISTINCT country)                                         AS countries
      FROM "Project"
      WHERE status <> 'CANCELLED'
    `,
    prisma.$transaction([
      prisma.project.count(),
      prisma.project.count({ where: { status: { in: LIVE_STATUSES } } }),
      prisma.project.count({ where: { isDemoData: true } }),
    ]),
  ]);

  const row = totals[0];
  const [totalProjects, liveProjects, demoDataCount] = counts;

  return {
    totalProjects,
    liveProjects,
    demoDataCount,
    announcedPowerMw: row?.announced_mw ?? 0,
    confirmedPowerMw: row?.confirmed_mw ?? 0,
    estimatedGpuCount: Number(row?.est_gpu ?? 0),
    confirmedGpuCount: Number(row?.conf_gpu ?? 0),
    announcedCapexUsd: row?.announced_capex ?? 0,
    countriesCovered: Number(row?.countries ?? 0),
    needsVerificationCount: await countVerificationQueue(),
  };
}

/** Kept in sync with lib/services/verification.ts — see that file for the rules. */
async function countVerificationQueue(): Promise<number> {
  const { fullVerificationQueueWhere } = await import("@/lib/services/verification");
  return prisma.project.count({ where: await fullVerificationQueueWhere() });
}

export type StatusBreakdown = { status: ProjectStatus; count: number; powerMw: number };

export async function getStatusBreakdown(): Promise<StatusBreakdown[]> {
  const rows = await prisma.project.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { estimatedPowerMw: true, confirmedPowerMw: true },
  });

  return rows.map((r) => ({
    status: r.status,
    count: r._count._all,
    // Approximates COALESCE at the group level: confirmed where present, plus
    // estimates. Exact per-row COALESCE lives in the SQL totals above; this is
    // for relative bar lengths, where the difference is immaterial.
    powerMw: Math.max(
      toNumber(r._sum.confirmedPowerMw) ?? 0,
      toNumber(r._sum.estimatedPowerMw) ?? 0,
    ),
  }));
}

export type GroupedTotal = {
  key: string;
  label: string;
  count: number;
  powerMw: number;
  gpuCount: number;
};

export async function getPowerByCountry(limit = 12): Promise<GroupedTotal[]> {
  const rows = await prisma.$queryRaw<
    { country: string; n: bigint; mw: number | null; gpus: bigint | null }[]
  >`
    SELECT country,
           COUNT(*) AS n,
           SUM(COALESCE("confirmedPowerMw", "estimatedPowerMw"))::float8 AS mw,
           SUM(COALESCE("confirmedGpuCount", "estimatedGpuCount")) AS gpus
    FROM "Project"
    WHERE status <> 'CANCELLED'
    GROUP BY country
    ORDER BY mw DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    key: r.country,
    label: r.country,
    count: Number(r.n),
    powerMw: r.mw ?? 0,
    gpuCount: Number(r.gpus ?? 0),
  }));
}

export async function getPowerByOwner(limit = 12): Promise<GroupedTotal[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string | null;
      name: string | null;
      n: bigint;
      mw: number | null;
      gpus: bigint | null;
    }[]
  >`
    SELECT c.id, c.name,
           COUNT(p.id) AS n,
           SUM(COALESCE(p."confirmedPowerMw", p."estimatedPowerMw"))::float8 AS mw,
           SUM(COALESCE(p."confirmedGpuCount", p."estimatedGpuCount")) AS gpus
    FROM "Project" p
    LEFT JOIN "Company" c ON c.id = p."ownerCompanyId"
    WHERE p.status <> 'CANCELLED'
    GROUP BY c.id, c.name
    ORDER BY mw DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    key: r.id ?? "unattributed",
    label: r.name ?? "Unattributed",
    count: Number(r.n),
    powerMw: r.mw ?? 0,
    gpuCount: Number(r.gpus ?? 0),
  }));
}

export type YearBucket = {
  year: number;
  announcedMw: number;
  operationalMw: number;
  count: number;
};

/**
 * Capacity by opening year. `operationalMw` counts only projects already
 * operational or partially operational, so the gap between the two series is
 * the part of the pipeline still at risk of slipping.
 */
export async function getCapacityByYear(): Promise<YearBucket[]> {
  const rows = await prisma.$queryRaw<
    {
      year: number | null;
      announced: number | null;
      operational: number | null;
      n: bigint;
    }[]
  >`
    SELECT EXTRACT(YEAR FROM COALESCE("actualOpeningDate", "expectedOpeningDate"))::int AS year,
           SUM(COALESCE("confirmedPowerMw", "estimatedPowerMw"))::float8 AS announced,
           SUM(CASE WHEN status IN ('OPERATIONAL','PARTIALLY_OPERATIONAL')
                    THEN COALESCE("confirmedPowerMw", "estimatedPowerMw") ELSE 0 END)::float8 AS operational,
           COUNT(*) AS n
    FROM "Project"
    WHERE status <> 'CANCELLED'
      AND COALESCE("actualOpeningDate", "expectedOpeningDate") IS NOT NULL
    GROUP BY year
    ORDER BY year
  `;

  return rows
    .filter((r): r is typeof r & { year: number } => r.year !== null)
    .map((r) => ({
      year: r.year,
      announcedMw: r.announced ?? 0,
      operationalMw: r.operational ?? 0,
      count: Number(r.n),
    }));
}

/** Generic "count and MW by a free-text column" rollup for the mix charts. */
async function mixBy(
  column: "powerSource" | "coolingTechnology" | "computePlatform" | "gpuModel",
  limit: number,
): Promise<GroupedTotal[]> {
  const rows = await prisma.project.groupBy({
    by: [column],
    where: { status: { not: "CANCELLED" }, NOT: { [column]: null } },
    _count: { _all: true },
    _sum: {
      estimatedPowerMw: true,
      confirmedPowerMw: true,
      estimatedGpuCount: true,
      confirmedGpuCount: true,
    },
    orderBy: { _count: { [column]: "desc" } },
    take: limit,
  });

  return rows.map((r) => {
    const label = (r as Record<string, unknown>)[column] as string;
    return {
      key: label,
      label,
      count: r._count._all,
      powerMw: Math.max(
        toNumber(r._sum.confirmedPowerMw) ?? 0,
        toNumber(r._sum.estimatedPowerMw) ?? 0,
      ),
      gpuCount: Math.max(r._sum.confirmedGpuCount ?? 0, r._sum.estimatedGpuCount ?? 0),
    };
  });
}

export const getPowerSourceMix = (limit = 10) => mixBy("powerSource", limit);
export const getCoolingMix = (limit = 10) => mixBy("coolingTechnology", limit);
export const getPlatformMix = (limit = 10) => mixBy("computePlatform", limit);

const RECENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  country: true,
  city: true,
  stateRegion: true,
  estimatedPowerMw: true,
  confirmedPowerMw: true,
  isDemoData: true,
  createdAt: true,
  updatedAt: true,
  lastVerifiedAt: true,
  ownerCompany: { select: { name: true, slug: true } },
} as const;

export async function getRecentProjects(limit = 8) {
  return prisma.project.findMany({
    select: RECENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getRecentlyUpdatedProjects(limit = 8) {
  return prisma.project.findMany({
    select: RECENT_SELECT,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
