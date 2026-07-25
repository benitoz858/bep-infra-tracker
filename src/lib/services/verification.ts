import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/format";

/**
 * Verification queue.
 *
 * A project needs review when any of these hold:
 *   1. not verified in 90 days (or never verified)
 *   2. expected opening date has passed but status is not operational
 *   3. it has only one source (or none)
 *   4. its best source reliability is low (< 60)
 *   5. estimated and confirmed values conflict
 *   6. status is RUMORED, DELAYED or PERMITTING
 *
 * Rules 1, 2 and 6 are plain column predicates. Rules 3–5 are not expressible in
 * Prisma's `where`: it has no relation-count filter ("fewer than 2 sources") and
 * cannot compare two columns to each other ("confirmed > estimated"). Those are
 * resolved by `evidenceFlaggedProjectIds`, one raw SQL query returning the ids
 * that fail them, which is then OR-ed into the predicate.
 *
 * Getting this wrong is subtle and was a real bug: with only the column
 * predicates, a single-source project that had just been marked verified fell out
 * of the queue entirely, because nothing else matched it and the per-row
 * annotator only ever sees rows SQL already selected.
 */

export const STALE_AFTER_DAYS = 90;
export const LOW_RELIABILITY_THRESHOLD = 60;

export type ReviewReason =
  | "never_verified"
  | "stale_verification"
  | "opening_date_passed"
  | "single_source"
  | "no_sources"
  | "low_reliability"
  | "value_conflict"
  | "unstable_status";

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  never_verified: "Never verified",
  stale_verification: `Not verified in ${STALE_AFTER_DAYS} days`,
  opening_date_passed: "Expected opening date has passed",
  single_source: "Only one source",
  no_sources: "No sources",
  low_reliability: "Low source reliability",
  value_conflict: "Estimated and confirmed values conflict",
  unstable_status: "Status needs periodic re-check",
};

function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000);
}

/**
 * Ids of projects failing an evidence rule (3–5): fewer than two sources, no
 * source scoring at or above the reliability threshold, or a confirmed figure
 * that exceeds its own estimate. One query, done in SQL because none of these
 * are expressible through Prisma's `where`.
 */
export async function evidenceFlaggedProjectIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Project" p
    WHERE p.status <> 'CANCELLED'
      AND (
        -- fewer than two sources (covers both none and exactly one)
        (SELECT COUNT(*) FROM "Source" s WHERE s."projectId" = p.id) < 2
        -- every scored source is below the threshold
        OR COALESCE(
             (SELECT MAX(s."reliabilityScore") FROM "Source" s
               WHERE s."projectId" = p.id AND s."reliabilityScore" IS NOT NULL),
             ${LOW_RELIABILITY_THRESHOLD}
           ) < ${LOW_RELIABILITY_THRESHOLD}
        -- a confirmed figure above its own estimate means the estimate is stale
        OR (p."confirmedPowerMw" IS NOT NULL AND p."estimatedPowerMw" IS NOT NULL
            AND p."confirmedPowerMw" > p."estimatedPowerMw")
        OR (p."confirmedGpuCount" IS NOT NULL AND p."estimatedGpuCount" IS NOT NULL
            AND p."confirmedGpuCount" > p."estimatedGpuCount")
      )
  `;
  return rows.map((r) => r.id);
}

/**
 * SQL predicate for the queue. Deliberately broad: it includes every project
 * that might need review, and the annotator drops those that turn out clean.
 *
 * `evidenceFlaggedIds` comes from `evidenceFlaggedProjectIds`. Callers that
 * cannot await (or genuinely only want the column-predicate rules) may omit it,
 * but then rules 3–5 are not applied.
 */
export function verificationQueueWhere(
  now = new Date(),
  evidenceFlaggedIds?: string[],
): Prisma.ProjectWhereInput {
  return {
    status: { notIn: ["CANCELLED"] },
    OR: [
      { lastVerifiedAt: null },
      { lastVerifiedAt: { lt: staleCutoff(now) } },
      {
        expectedOpeningDate: { lt: now },
        status: { notIn: ["OPERATIONAL", "PARTIALLY_OPERATIONAL", "CANCELLED"] },
      },
      { status: { in: ["RUMORED", "DELAYED", "PERMITTING"] } },
      ...(evidenceFlaggedIds ? [{ id: { in: evidenceFlaggedIds } }] : []),
    ],
  };
}

/** The complete predicate, including the evidence rules. */
export async function fullVerificationQueueWhere(
  now = new Date(),
): Promise<Prisma.ProjectWhereInput> {
  return verificationQueueWhere(now, await evidenceFlaggedProjectIds());
}

export type QueueItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  country: string;
  ownerName: string | null;
  lastVerifiedAt: Date | null;
  expectedOpeningDate: Date | null;
  sourceCount: number;
  isDemoData: boolean;
  reasons: ReviewReason[];
};

/** Does the project's estimated figure contradict its confirmed figure? */
function hasValueConflict(p: {
  estimatedPowerMw: unknown;
  confirmedPowerMw: unknown;
  estimatedGpuCount: number | null;
  confirmedGpuCount: number | null;
}): boolean {
  const pairs: [number | null, number | null][] = [
    [toNumber(p.estimatedPowerMw as never), toNumber(p.confirmedPowerMw as never)],
    [p.estimatedGpuCount, p.confirmedGpuCount],
  ];
  // A confirmed figure above its own estimate means the estimate was never
  // revised after the confirmation landed — the two now disagree.
  return pairs.some(([est, conf]) => est !== null && conf !== null && conf > est);
}

export async function getVerificationQueue(now = new Date()): Promise<QueueItem[]> {
  const projects = await prisma.project.findMany({
    where: await fullVerificationQueueWhere(now),
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      country: true,
      lastVerifiedAt: true,
      expectedOpeningDate: true,
      estimatedPowerMw: true,
      confirmedPowerMw: true,
      estimatedGpuCount: true,
      confirmedGpuCount: true,
      isDemoData: true,
      ownerCompany: { select: { name: true } },
      sources: { select: { reliabilityScore: true } },
    },
    orderBy: [{ lastVerifiedAt: { sort: "asc", nulls: "first" } }],
  });

  const cutoff = staleCutoff(now);

  return (
    projects
      .map((p) => {
        const reasons: ReviewReason[] = [];

        if (p.lastVerifiedAt === null) reasons.push("never_verified");
        else if (p.lastVerifiedAt < cutoff) reasons.push("stale_verification");

        if (
          p.expectedOpeningDate &&
          p.expectedOpeningDate < now &&
          p.status !== "OPERATIONAL" &&
          p.status !== "PARTIALLY_OPERATIONAL"
        ) {
          reasons.push("opening_date_passed");
        }

        if (p.sources.length === 0) reasons.push("no_sources");
        else if (p.sources.length === 1) reasons.push("single_source");

        const best = p.sources.reduce<number | null>(
          (acc, s) =>
            s.reliabilityScore === null ? acc : Math.max(acc ?? 0, s.reliabilityScore),
          null,
        );
        if (best !== null && best < LOW_RELIABILITY_THRESHOLD)
          reasons.push("low_reliability");

        if (hasValueConflict(p)) reasons.push("value_conflict");

        if (
          p.status === "RUMORED" ||
          p.status === "DELAYED" ||
          p.status === "PERMITTING"
        ) {
          reasons.push("unstable_status");
        }

        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          status: p.status,
          country: p.country,
          ownerName: p.ownerCompany?.name ?? null,
          lastVerifiedAt: p.lastVerifiedAt,
          expectedOpeningDate: p.expectedOpeningDate,
          sourceCount: p.sources.length,
          isDemoData: p.isDemoData,
          reasons,
        };
      })
      // The SQL predicate over-selects; drop anything that turned out clean.
      .filter((item) => item.reasons.length > 0)
      // Most reasons first: the worst records should be at the top of the queue.
      .sort((a, b) => b.reasons.length - a.reasons.length)
  );
}

/** Stamp a project as verified now. Used by the queue's quick actions. */
export async function markVerified(projectId: string): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { lastVerifiedAt: new Date() },
  });
}
