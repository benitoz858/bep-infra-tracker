import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/services/duplicates";
import { ConflictError, NotFoundError, ServiceError } from "@/lib/services/errors";
import { createSourceWithClaims, normalizeUrl } from "@/lib/services/sources";
import type { ProposedClaim, WatchedItem, Watcher } from "@/lib/ingest/types";
import { getExtractor } from "@/lib/ingest/extract";

/**
 * Agent ingestion.
 *
 * Watchers stage candidates here; humans promote them. The promotion path goes
 * through createSourceWithClaims — the same function the manual inbox uses — so
 * URL uniqueness, the confirmed-needs-a-source rule and revision writing all
 * still apply. Nothing in this file writes to Project, Source or ProjectMetric
 * except by calling that service.
 */

/** Machine-proposed claims can never be promoted above LOW by the machine. */
const MAX_MACHINE_CONFIDENCE = "LOW" as const;

// ---------------------------------------------------------------------------
// Matching a watched item to a project
// ---------------------------------------------------------------------------

export type MatchResult = {
  projectId: string | null;
  score: number;
  reason: string;
};

/**
 * Guess which project an item is about.
 *
 * Scored on distinctive tokens only. A generic word like "data" or "campus"
 * appears in every project name and would match everything, so the shared
 * normaliser (which already strips domain noise words) does the filtering.
 *
 * The result is a suggestion shown to the reviewer with its reason, never an
 * automatic association — a wrong match that silently attaches evidence to the
 * wrong project is worse than no match at all.
 */
/**
 * Whole-word containment.
 *
 * Plain `includes` matches inside other words, which is not a subtle problem:
 * the project "Sines" (Portugal) matched an article about South Korea because
 * "sines" is a substring of "bu-sines-s". Comparing against a tokenised
 * haystack makes a match mean what a reader would assume it means.
 */
function containsWord(haystackTokens: Set<string>, needle: string): boolean {
  const parts = needle.split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => haystackTokens.has(p));
}

/** Split text into lowercase word tokens. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean),
  );
}

export async function matchProject(item: WatchedItem): Promise<MatchResult> {
  const haystackTokens = tokenize(`${item.title} ${item.text ?? ""}`);

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      ownerCompany: { select: { name: true } },
    },
    take: 2000,
  });

  let best: MatchResult = { projectId: null, score: 0, reason: "No match" };

  for (const project of projects) {
    const tokens = normalizeName(project.name).split(" ").filter((t) => t.length > 3);
    if (tokens.length === 0) continue;

    const hits = tokens.filter((t) => haystackTokens.has(t));
    if (hits.length === 0) continue;

    let score = Math.round((hits.length / tokens.length) * 70);
    const reasons = [`name tokens: ${hits.join(", ")}`];

    const city = project.city?.toLowerCase();
    if (city && city.length > 3 && containsWord(haystackTokens, city)) {
      score += 20;
      reasons.push(`city: ${project.city}`);
    }

    const owner = project.ownerCompany?.name.toLowerCase();
    if (owner && owner.length > 3 && containsWord(haystackTokens, owner)) {
      score += 10;
      reasons.push(`owner: ${project.ownerCompany?.name}`);
    }

    if (score > best.score) {
      best = { projectId: project.id, score: Math.min(100, score), reason: reasons.join("; ") };
    }
  }

  // Below this the suggestion is noise; leave it for the reviewer to assign.
  return best.score >= 40 ? best : { projectId: null, score: best.score, reason: "No confident match" };
}

// ---------------------------------------------------------------------------
// Running a watcher
// ---------------------------------------------------------------------------

export type RunSummary = {
  runId: string;
  watcher: string;
  itemsSeen: number;
  itemsNew: number;
  failed: boolean;
  error?: string;
};

export async function runWatcher(
  watcher: Watcher,
  options: { since?: Date; limit?: number; extractorKey?: string } = {},
): Promise<RunSummary> {
  const extractor = getExtractor(options.extractorKey);

  const run = await prisma.ingestionRun.create({
    data: { watcher: watcher.key, status: "RUNNING" },
    select: { id: true },
  });

  try {
    const items = await watcher.run({ since: options.since, limit: options.limit });
    let itemsNew = 0;

    for (const item of items) {
      const url = normalizeUrl(item.url);

      // Already staged? Skip. The unique index on url is the backstop; this
      // check keeps the common path from throwing.
      const staged = await prisma.ingestionCandidate.findUnique({
        where: { url },
        select: { id: true },
      });
      if (staged) continue;

      // Already cited somewhere? Then it is not news to us.
      const cited = await prisma.source.findFirst({
        where: { url: { equals: item.url, mode: "insensitive" } },
        select: { id: true },
      });
      if (cited) continue;

      const match = await matchProject(item);
      const claims = await extractor.extract(item);

      await prisma.ingestionCandidate.create({
        data: {
          runId: run.id,
          url,
          title: item.title,
          publisher: item.publisher ?? watcher.publisher ?? null,
          publicationDate: item.publicationDate ?? null,
          sourceType: item.sourceType ?? watcher.defaultSourceType ?? "NEWS_ARTICLE",
          excerpt: item.text?.slice(0, 2000) ?? null,
          suggestedProjectId: match.projectId,
          matchScore: match.score,
          matchReason: match.reason,
          proposedClaims: claims.length ? (claims as unknown as Prisma.InputJsonValue) : undefined,
          extractor: extractor.key,
        },
      });
      itemsNew += 1;
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        itemsSeen: items.length,
        itemsNew,
      },
    });

    return { runId: run.id, watcher: watcher.key, itemsSeen: items.length, itemsNew, failed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // A failed watcher is recorded, not swallowed. A feed that quietly stops
    // returning results is indistinguishable from a quiet week unless the
    // failure is visible.
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 1000) },
    });

    return {
      runId: run.id,
      watcher: watcher.key,
      itemsSeen: 0,
      itemsNew: 0,
      failed: true,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function listCandidates(status: "PENDING" | "ACCEPTED" | "REJECTED" | "DUPLICATE" = "PENDING") {
  return prisma.ingestionCandidate.findMany({
    where: { status },
    orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      run: { select: { watcher: true } },
      suggestedProject: { select: { id: true, name: true, slug: true, country: true } },
    },
  });
}

export async function getIngestionStats() {
  const [pending, accepted, rejected, runs] = await Promise.all([
    prisma.ingestionCandidate.count({ where: { status: "PENDING" } }),
    prisma.ingestionCandidate.count({ where: { status: "ACCEPTED" } }),
    prisma.ingestionCandidate.count({ where: { status: "REJECTED" } }),
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        watcher: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        itemsSeen: true,
        itemsNew: true,
        error: true,
      },
    }),
  ]);
  return { pending, accepted, rejected, runs };
}

/**
 * Promote a candidate into real evidence.
 *
 * The reviewer supplies the target project (the suggestion is only a default)
 * and may edit the claims. Claims are forced to LOW regardless of what arrives:
 * accepting a machine proposal means "this is worth keeping", not "this is
 * confirmed". Raising confidence is a separate, deliberate edit on the project.
 */
export async function acceptCandidate(input: {
  candidateId: string;
  projectId: string;
  reviewerId: string | null;
  reviewNote?: string | null;
  /** Indices of proposedClaims to keep; omit to keep none. */
  keepClaimIndices?: number[];
  reliabilityScore?: number | null;
}) {
  const candidate = await prisma.ingestionCandidate.findUnique({
    where: { id: input.candidateId },
  });
  if (!candidate) throw new NotFoundError("Candidate");
  if (candidate.status !== "PENDING") {
    throw new ConflictError(`This candidate was already ${candidate.status.toLowerCase()}.`);
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError("Project");

  const proposed = (candidate.proposedClaims as ProposedClaim[] | null) ?? [];
  const keep = new Set(input.keepClaimIndices ?? []);
  const claims = proposed
    .filter((_, i) => keep.has(i))
    .map((c) => ({
      metricType: c.metricType,
      numericValue: c.numericValue,
      textValue: c.textValue,
      unit: c.unit,
      // The cap. An extractor cannot launder its own guess into a fact.
      confidenceLevel: MAX_MACHINE_CONFIDENCE,
      methodology: c.methodology,
      effectiveDate: null,
    }));

  try {
    const result = await createSourceWithClaims({
      projectId: input.projectId,
      title: candidate.title,
      publisher: candidate.publisher,
      url: candidate.url,
      publicationDate: candidate.publicationDate,
      sourceType: candidate.sourceType,
      excerpt: candidate.excerpt,
      archivedUrl: null,
      reliabilityScore: input.reliabilityScore ?? null,
      isPrimarySource: false,
      accessedAt: new Date(),
      allowDuplicateUrl: false,
      claims,
    });

    await prisma.ingestionCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "ACCEPTED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
        reviewNote: input.reviewNote ?? null,
        createdSourceId: result.source.id,
        suggestedProjectId: input.projectId,
      },
    });

    return result;
  } catch (error) {
    // The URL is already cited on that project — mark the candidate DUPLICATE
    // rather than leaving it PENDING for someone to trip over again.
    if (error instanceof ServiceError && error.code === "conflict") {
      await prisma.ingestionCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "DUPLICATE",
          reviewedAt: new Date(),
          reviewedById: input.reviewerId,
          reviewNote: "Already cited on the target project.",
        },
      });
    }
    throw error;
  }
}

export async function rejectCandidate(input: {
  candidateId: string;
  reviewerId: string | null;
  reviewNote?: string | null;
}) {
  const candidate = await prisma.ingestionCandidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true, status: true },
  });
  if (!candidate) throw new NotFoundError("Candidate");
  if (candidate.status !== "PENDING") {
    throw new ConflictError(`This candidate was already ${candidate.status.toLowerCase()}.`);
  }

  // Rejection is a record, not a delete: the same URL must not be re-proposed
  // on the next run, and "we looked at this and said no" is worth keeping.
  return prisma.ingestionCandidate.update({
    where: { id: input.candidateId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: input.reviewerId,
      reviewNote: input.reviewNote ?? null,
    },
  });
}
