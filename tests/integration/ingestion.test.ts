import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase, testDb } from "../helpers/db";

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("../helpers/db");
  return { prisma: testDb };
});

const { acceptCandidate, matchProject, rejectCandidate, runWatcher } = await import(
  "@/lib/services/ingestion"
);

let slugCounter = 0;

async function makeProject(overrides: Record<string, unknown> = {}) {
  slugCounter += 1;
  return testDb.project.create({
    data: {
      slug: `ingest-fixture-${slugCounter}`,
      name: "Sines Atlantic Campus",
      country: "Portugal",
      city: "Sines",
      projectType: "DATA_CENTER",
      status: "ANNOUNCED",
      ...overrides,
    },
  });
}

/** A watcher returning fixed items, so tests never touch the network. */
function stubWatcher(items: { url: string; title: string; text?: string }[]) {
  return {
    key: "test:stub",
    label: "Stub",
    publisher: "Test",
    defaultSourceType: "NEWS_ARTICLE" as const,
    async run() {
      return items;
    },
  };
}

describe("ingestion", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("project matching", () => {
    it("does not match a project name inside a longer word", async () => {
      await makeProject();

      // Regression: "sines" is a substring of "business", which made an article
      // about South Korea match a project in Portugal at 55%.
      const match = await matchProject({
        url: "https://example.com/korea",
        title: "South Korea outlines its AI future",
        text: "A business partnership will expand the GAK Sejong data center.",
      });

      expect(match.projectId).toBeNull();
    });

    it("matches on whole words and explains why", async () => {
      const project = await makeProject();

      const match = await matchProject({
        url: "https://example.com/sines",
        title: "Sines Atlantic Campus expands",
        text: "The operator confirmed the Sines site will grow.",
      });

      expect(match.projectId).toBe(project.id);
      expect(match.score).toBeGreaterThanOrEqual(40);
      // The reason is shown to the reviewer, so a suggestion is auditable.
      expect(match.reason).toMatch(/sines/i);
    });
  });

  describe("running a watcher", () => {
    it("stages candidates without touching live tables", async () => {
      await makeProject();

      const summary = await runWatcher(
        stubWatcher([
          {
            url: "https://example.com/one",
            title: "Sines Atlantic Campus reaches 300 megawatts",
            text: "The Sines campus will draw 300 megawatts.",
          },
        ]),
        { extractorKey: "heuristic" },
      );

      expect(summary.failed).toBe(false);
      expect(summary.itemsNew).toBe(1);

      // Staged only — no Source or ProjectMetric exists yet.
      await expect(testDb.source.count()).resolves.toBe(0);
      await expect(testDb.projectMetric.count()).resolves.toBe(0);

      const candidate = await testDb.ingestionCandidate.findFirstOrThrow();
      expect(candidate.status).toBe("PENDING");
      expect(candidate.proposedClaims).not.toBeNull();
    });

    it("does not re-propose a URL it already staged", async () => {
      const watcher = stubWatcher([
        { url: "https://example.com/dup", title: "Something", text: "300 megawatts." },
      ]);

      await runWatcher(watcher, { extractorKey: "heuristic" });
      const second = await runWatcher(watcher, { extractorKey: "heuristic" });

      expect(second.itemsNew).toBe(0);
      await expect(testDb.ingestionCandidate.count()).resolves.toBe(1);
    });

    it("skips a URL already cited on a project", async () => {
      const project = await makeProject();
      await testDb.source.create({
        data: {
          projectId: project.id,
          title: "Already cited",
          url: "https://example.com/known",
          sourceType: "NEWS_ARTICLE",
        },
      });

      const summary = await runWatcher(
        stubWatcher([{ url: "https://example.com/known", title: "Same story" }]),
      );

      expect(summary.itemsNew).toBe(0);
    });

    it("records a failed run instead of swallowing the error", async () => {
      const summary = await runWatcher({
        key: "test:broken",
        label: "Broken",
        async run() {
          throw new Error("feed unreachable");
        },
      });

      expect(summary.failed).toBe(true);
      const run = await testDb.ingestionRun.findFirstOrThrow({ where: { id: summary.runId } });
      // A watcher that silently stops looks identical to a quiet week.
      expect(run.status).toBe("FAILED");
      expect(run.error).toMatch(/unreachable/);
    });
  });

  describe("review", () => {
    it("promotes an accepted candidate into a real source and metric", async () => {
      const project = await makeProject();
      await runWatcher(
        stubWatcher([
          {
            url: "https://example.com/accept",
            title: "Sines campus reaches 300 megawatts",
            text: "The Sines campus will draw 300 megawatts.",
          },
        ]),
        { extractorKey: "heuristic" },
      );

      const candidate = await testDb.ingestionCandidate.findFirstOrThrow();
      const result = await acceptCandidate({
        candidateId: candidate.id,
        projectId: project.id,
        reviewerId: null,
        keepClaimIndices: [0],
      });

      expect(result.claimCount).toBe(1);

      const source = await testDb.source.findFirstOrThrow();
      expect(source.projectId).toBe(project.id);

      const metric = await testDb.projectMetric.findFirstOrThrow();
      // Accepting means "worth keeping", not "confirmed". The cap is enforced
      // in the service, not merely in the UI.
      expect(metric.confidenceLevel).toBe("LOW");
      expect(metric.sourceId).toBe(source.id);

      const after = await testDb.ingestionCandidate.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      expect(after.status).toBe("ACCEPTED");
      expect(after.createdSourceId).toBe(source.id);
    });

    it("keeps only the claims the reviewer ticked", async () => {
      const project = await makeProject();
      await runWatcher(
        stubWatcher([
          {
            url: "https://example.com/multi",
            title: "Sines campus",
            text: "The Sines site will draw 300 megawatts and cost $2 billion.",
          },
        ]),
        { extractorKey: "heuristic" },
      );

      const candidate = await testDb.ingestionCandidate.findFirstOrThrow();
      expect((candidate.proposedClaims as unknown[]).length).toBe(2);

      await acceptCandidate({
        candidateId: candidate.id,
        projectId: project.id,
        reviewerId: null,
        keepClaimIndices: [0],
      });

      // Discarded proposals must not appear anywhere.
      await expect(testDb.projectMetric.count()).resolves.toBe(1);
    });

    it("leaves live data untouched when rejected", async () => {
      await makeProject();
      await runWatcher(
        stubWatcher([{ url: "https://example.com/reject", title: "300 megawatts somewhere" }]),
        { extractorKey: "heuristic" },
      );

      const candidate = await testDb.ingestionCandidate.findFirstOrThrow();
      await rejectCandidate({ candidateId: candidate.id, reviewerId: null, reviewNote: "Not relevant" });

      await expect(testDb.source.count()).resolves.toBe(0);
      await expect(testDb.projectMetric.count()).resolves.toBe(0);

      const after = await testDb.ingestionCandidate.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      // Rejection is a record, not a delete: the URL must not come back.
      expect(after.status).toBe("REJECTED");
      expect(after.reviewNote).toBe("Not relevant");
    });

    it("refuses to review the same candidate twice", async () => {
      await makeProject();
      await runWatcher(stubWatcher([{ url: "https://example.com/twice", title: "Item" }]));
      const candidate = await testDb.ingestionCandidate.findFirstOrThrow();

      await rejectCandidate({ candidateId: candidate.id, reviewerId: null });
      await expect(
        rejectCandidate({ candidateId: candidate.id, reviewerId: null }),
      ).rejects.toThrow(/already rejected/i);
    });
  });
});
