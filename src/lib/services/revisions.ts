import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Revision history.
 *
 * Data-quality rule: every material edit must leave a ProjectRevision. "Material"
 * means a tracked field actually changed value — re-saving a form without edits
 * must not create a revision, or the history becomes noise and stops being
 * useful as an audit trail.
 */

/** Fields whose change is worth recording. Excludes derived/bookkeeping columns. */
const TRACKED_FIELDS = [
  "name",
  "slug",
  "description",
  "ownerCompanyId",
  "projectType",
  "status",
  "city",
  "stateRegion",
  "country",
  "latitude",
  "longitude",
  "announcementDate",
  "expectedOpeningDate",
  "actualOpeningDate",
  "estimatedPowerMw",
  "confirmedPowerMw",
  "estimatedGpuCount",
  "confirmedGpuCount",
  "gpuModel",
  "computePlatform",
  "estimatedCapexUsd",
  "confirmedCapexUsd",
  "squareFeet",
  "coolingTechnology",
  "powerSource",
  "utilityProvider",
  "confidenceScore",
  "analystNotes",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

/** Normalise for comparison: Decimal/Date/null all become comparable scalars. */
function comparable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toString" in value) return String(value);
  return String(value);
}

export type FieldDiff = { field: string; from: string | null; to: string | null };

/** Which tracked fields differ between two versions of a project. */
export function diffProject(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of TRACKED_FIELDS) {
    if (!(field in after)) continue; // partial update: field not submitted
    const from = comparable(before[field]);
    const to = comparable(after[field]);
    if (from !== to) diffs.push({ field, from, to });
  }
  return diffs;
}

/** Human-readable one-liner for the revision list. */
export function summarizeDiffs(diffs: FieldDiff[]): string {
  if (diffs.length === 0) return "No material changes.";
  const names = diffs.map((d) => d.field);
  const shown = names.slice(0, 4).join(", ");
  return names.length > 4
    ? `Updated ${shown} and ${names.length - 4} more field(s).`
    : `Updated ${shown}.`;
}

/**
 * Write a revision if anything material changed. Accepts a transaction client so
 * the revision and the update commit together — a revision that survives a
 * rolled-back edit would misreport history.
 */
export async function recordRevision(
  tx: Prisma.TransactionClient,
  args: {
    projectId: string;
    userId: string | null;
    diffs: FieldDiff[];
    /** Overrides the generated summary (e.g. "Created", "Marked verified"). */
    summary?: string;
  },
): Promise<boolean> {
  if (args.diffs.length === 0 && !args.summary) return false;

  await tx.projectRevision.create({
    data: {
      projectId: args.projectId,
      userId: args.userId,
      changeSummary: args.summary ?? summarizeDiffs(args.diffs),
      previousData: Object.fromEntries(
        args.diffs.map((d) => [d.field, d.from]),
      ) as Prisma.InputJsonValue,
      newData: Object.fromEntries(
        args.diffs.map((d) => [d.field, d.to]),
      ) as Prisma.InputJsonValue,
    },
  });

  return true;
}

export async function getRevisions(projectId: string, limit = 50) {
  return prisma.projectRevision.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}
