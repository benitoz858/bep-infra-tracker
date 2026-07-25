import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/services/errors";
import type { SourceCreateInput, SourceInboxInput } from "@/lib/validations/source";

/**
 * Sources and the source-inbox workflow.
 *
 * Deliberately no scraping or AI extraction: the spec asks for a clean seam
 * where that can be added later, and an unreliable auto-extractor that
 * occasionally invents a number is worse than no extractor at all in a product
 * whose value is provenance. `fetchSourceMetadata` below is that seam.
 */

/** Trailing slashes and case differences should not defeat the uniqueness check. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    // Strip common tracking parameters so the same article pasted from two
    // places is recognised as one source.
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid|ref)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    const normalized = parsed.toString().replace(/\/+$/, "").toLowerCase();
    return normalized;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * Data-quality rule: source URLs are unique per project unless explicitly
 * overridden. Enforced here rather than with a DB constraint precisely because
 * the override must remain possible.
 */
async function assertUrlUnique(
  projectId: string,
  url: string,
  options: { allow: boolean; excludeSourceId?: string },
): Promise<void> {
  if (options.allow) return;

  const existing = await prisma.source.findMany({
    where: {
      projectId,
      ...(options.excludeSourceId ? { id: { not: options.excludeSourceId } } : {}),
    },
    select: { id: true, url: true, title: true },
  });

  const target = normalizeUrl(url);
  const clash = existing.find((s) => normalizeUrl(s.url) === target);
  if (clash) {
    throw new ConflictError(
      "This URL is already cited on this project. Resubmit with allowDuplicateUrl to add it anyway.",
      { existing: clash },
    );
  }
}

export async function createSource(input: SourceCreateInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError("Project");

  await assertUrlUnique(input.projectId, input.url, { allow: input.allowDuplicateUrl });

  return prisma.source.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      publisher: input.publisher,
      url: input.url.trim(),
      publicationDate: input.publicationDate,
      sourceType: input.sourceType,
      excerpt: input.excerpt,
      archivedUrl: input.archivedUrl,
      reliabilityScore: input.reliabilityScore,
      isPrimarySource: input.isPrimarySource,
      accessedAt: input.accessedAt ?? new Date(),
    },
  });
}

/**
 * The source-inbox submission: create the source, then convert its candidate
 * claims into ProjectMetric rows in the same transaction so a partial failure
 * cannot leave claims pointing at a source that was rolled back.
 */
export async function createSourceWithClaims(input: SourceInboxInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, slug: true, name: true },
  });
  if (!project) throw new NotFoundError("Project");

  await assertUrlUnique(input.projectId, input.url, { allow: input.allowDuplicateUrl });

  return prisma.$transaction(async (tx) => {
    const source = await tx.source.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        publisher: input.publisher,
        url: input.url.trim(),
        publicationDate: input.publicationDate,
        sourceType: input.sourceType,
        excerpt: input.excerpt,
        archivedUrl: input.archivedUrl,
        reliabilityScore: input.reliabilityScore,
        isPrimarySource: input.isPrimarySource,
        accessedAt: input.accessedAt ?? new Date(),
      },
    });

    for (const claim of input.claims) {
      await tx.projectMetric.create({
        data: {
          projectId: input.projectId,
          metricType: claim.metricType,
          numericValue: claim.numericValue,
          textValue: claim.textValue,
          unit: claim.unit,
          confidenceLevel: claim.confidenceLevel,
          methodology: claim.methodology,
          effectiveDate: claim.effectiveDate,
          // Every claim from the inbox is backed by the source just created,
          // which is what makes a CONFIRMED level legitimate here.
          sourceId: source.id,
        },
      });
    }

    await tx.projectRevision.create({
      data: {
        projectId: input.projectId,
        changeSummary: `Source added ("${input.title}") with ${input.claims.length} claim(s).`,
        newData: { sourceId: source.id, claims: input.claims.length },
      },
    });

    return { source, project, claimCount: input.claims.length };
  });
}

export async function deleteSource(id: string) {
  const existing = await prisma.source.findUnique({
    where: { id },
    select: { id: true, _count: { select: { metrics: true } } },
  });
  if (!existing) throw new NotFoundError("Source");

  // Metrics keep their values but lose the citation (schema: onDelete SetNull).
  // Warn the caller rather than cascade-deleting evidence.
  if (existing._count.metrics > 0) {
    throw new ConflictError(
      `${existing._count.metrics} metric(s) cite this source. Repoint or delete them first.`,
    );
  }

  await prisma.source.delete({ where: { id } });
}

export async function listRecentSources(limit = 40) {
  return prisma.source.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      project: { select: { slug: true, name: true, isDemoData: true } },
      _count: { select: { metrics: true } },
    },
  });
}

/** Projects with no evidence at all — the inbox's main work queue. */
export async function listProjectsMissingSources(limit = 20) {
  return prisma.project.findMany({
    where: { sources: { none: {} }, status: { not: "CANCELLED" } },
    select: { id: true, slug: true, name: true, country: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Seam for future automation.
 *
 * A later version can fetch the URL, parse metadata and propose claims. It is
 * intentionally not implemented: the MVP requires the analyst to type what the
 * source says, so no number enters the database without a human having read it.
 */
export type SourceMetadataProposal = {
  title?: string;
  publisher?: string;
  publicationDate?: string;
  excerpt?: string;
};

export interface SourceMetadataFetcher {
  fetch(url: string): Promise<SourceMetadataProposal>;
}

export const manualSourceMetadataFetcher: SourceMetadataFetcher = {
  async fetch() {
    // No network access by design. Returning an empty proposal keeps the
    // interface honest: callers must handle "nothing was extracted".
    return {};
  },
};
