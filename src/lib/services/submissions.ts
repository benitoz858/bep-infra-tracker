import { prisma } from "@/lib/db";
import { ConflictError, ServiceError } from "@/lib/services/errors";
import { normalizeUrl } from "@/lib/services/sources";
import type { PublicSubmissionInput } from "@/lib/validations/submission";

/**
 * Public submissions.
 *
 * The same contract the watchers work under: a proposer suggests, a human
 * commits. A submission becomes a PENDING IngestionCandidate and nothing else —
 * it cannot touch Project, Source or ProjectMetric until a reviewer accepts it
 * at /ingest, which routes through the same acceptance path a watcher candidate
 * does. That is what makes it safe to let anyone submit without an account:
 * the form grants no write access, only the right to be read.
 */

/** One run row per day, so a day of submissions groups sensibly in the UI. */
const RUN_KEY = "public:submissions";

/** Per-IP ceiling. Generous for a person, tight enough to blunt a script. */
const MAX_PER_IP_PER_HOUR = 10;
/** Global ceiling — a backstop against a distributed flood filling the queue. */
const MAX_TOTAL_PER_HOUR = 120;

/**
 * Salted SHA-256 of the address. We rate-limit by IP but never store one:
 * a hash is enough to count repeats and useless for identifying anyone, and an
 * unsalted hash of a v4 address is trivially reversible by brute force.
 *
 * Falls back to a constant when AUTH_SECRET is missing, which only happens in
 * tests — the effect is that everything shares a bucket, which is the safe
 * direction to fail.
 */
async function hashIp(ip: string): Promise<string> {
  const salt = process.env.AUTH_SECRET ?? "unsalted-test-only";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function currentRunId(): Promise<string> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.ingestionRun.findFirst({
    where: { watcher: RUN_KEY, startedAt: { gte: startOfDay } },
    select: { id: true },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing.id;

  const created = await prisma.ingestionRun.create({
    // RUNNING, not SUCCEEDED: the day's submissions are still coming in, and a
    // run that closes at creation would misreport itsCount forever.
    data: { watcher: RUN_KEY, status: "RUNNING" },
    select: { id: true },
  });
  return created.id;
}

export class RateLimitError extends ServiceError {
  constructor(message: string) {
    super("rate_limited", message, 429);
    this.name = "RateLimitError";
  }
}

async function assertWithinLimits(ipHash: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const [fromThisAddress, total] = await Promise.all([
    prisma.ingestionCandidate.count({
      where: { origin: "PUBLIC_SUBMISSION", submitterIpHash: ipHash, createdAt: { gte: since } },
    }),
    prisma.ingestionCandidate.count({
      where: { origin: "PUBLIC_SUBMISSION", createdAt: { gte: since } },
    }),
  ]);

  if (fromThisAddress >= MAX_PER_IP_PER_HOUR) {
    throw new RateLimitError(
      "That is a lot of submissions in one hour. Try again later, or open a GitHub issue if you have a batch to contribute.",
    );
  }
  if (total >= MAX_TOTAL_PER_HOUR) {
    throw new RateLimitError(
      "The submission queue is unusually busy. Please try again in an hour.",
    );
  }
}

export type SubmissionResult = { id: string; url: string };

export async function createPublicSubmission(
  input: PublicSubmissionInput,
  context: { ip: string; userId?: string | null },
): Promise<SubmissionResult> {
  // Honeypot. Report success rather than an error: telling a bot which check it
  // failed is how it learns to pass next time.
  if (input.website) {
    return { id: "discarded", url: input.url };
  }

  const ipHash = await hashIp(context.ip);
  await assertWithinLimits(ipHash);

  const url = normalizeUrl(input.url);

  const staged = await prisma.ingestionCandidate.findUnique({
    where: { url },
    select: { id: true, status: true },
  });
  if (staged) {
    throw new ConflictError(
      staged.status === "PENDING"
        ? "That URL is already waiting in the review queue."
        : "That URL has already been reviewed.",
    );
  }

  const cited = await prisma.source.findFirst({
    where: { url: { equals: input.url, mode: "insensitive" } },
    select: { id: true, projectId: true },
  });
  if (cited) {
    throw new ConflictError("That source is already cited on a project in the tracker.");
  }

  // Only accept a project id that exists. A bad one silently becomes "unmatched"
  // rather than an error, because the submitter's claim is still worth reading.
  let suggestedProjectId: string | null = null;
  if (input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    });
    suggestedProjectId = project?.id ?? null;
  }

  const note = [
    input.note,
    input.suggestedProjectName && !suggestedProjectId
      ? `Suggested project (not in the tracker): ${input.suggestedProjectName}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const candidate = await prisma.ingestionCandidate.create({
    data: {
      runId: await currentRunId(),
      origin: "PUBLIC_SUBMISSION",
      url,
      title: input.title,
      publisher: input.publisher ?? null,
      publicationDate: input.publicationDate ?? null,
      sourceType: input.sourceType,
      excerpt: input.excerpt ?? null,
      suggestedProjectId,
      // A person naming the project is worth more than the token matcher's
      // guess, but it is still a claim awaiting review, not a verified link.
      matchScore: suggestedProjectId ? 100 : null,
      matchReason: suggestedProjectId ? "Named by the submitter" : null,
      proposedClaims: input.claims.length ? input.claims : undefined,
      extractor: "human",
      submitterName: input.submitterName ?? null,
      submitterEmail: input.submitterEmail ?? null,
      submitterNote: note || null,
      submitterUserId: context.userId ?? null,
      submitterIpHash: ipHash,
    },
    select: { id: true, url: true },
  });

  return candidate;
}

/** A signed-in submitter's own history, newest first. */
export async function listMySubmissions(userId: string) {
  return prisma.ingestionCandidate.findMany({
    where: { submitterUserId: userId },
    select: {
      id: true,
      url: true,
      title: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
      suggestedProject: { select: { slug: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
