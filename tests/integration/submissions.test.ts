import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase, testDb } from "../helpers/db";

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("../helpers/db");
  return { prisma: testDb };
});

const { createPublicSubmission, RateLimitError, listMySubmissions } = await import(
  "@/lib/services/submissions"
);
const { acceptCandidate } = await import("@/lib/services/ingestion");

let counter = 0;

function submission(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    url: `https://example.com/story-${counter}`,
    title: `Filing ${counter}`,
    publisher: "ERCOT",
    publicationDate: null,
    sourceType: "UTILITY_FILING" as const,
    excerpt: null,
    // null, not undefined: optionalString normalises "" to null, so this is the
    // shape the schema actually hands the service.
    projectId: null,
    suggestedProjectName: null,
    note: null,
    submitterName: null,
    submitterEmail: undefined,
    claims: [],
    website: undefined,
    ...overrides,
  };
}

async function makeProject() {
  counter += 1;
  return testDb.project.create({
    data: {
      slug: `submission-fixture-${counter}`,
      name: "Test Campus",
      country: "United States",
      projectType: "DATA_CENTER",
      status: "ANNOUNCED",
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("createPublicSubmission", () => {
  it("stages a candidate rather than writing to the live data", async () => {
    const result = await createPublicSubmission(submission(), { ip: "1.2.3.4" });

    const candidate = await testDb.ingestionCandidate.findUnique({
      where: { id: result.id },
    });

    expect(candidate?.status).toBe("PENDING");
    expect(candidate?.origin).toBe("PUBLIC_SUBMISSION");
    expect(candidate?.extractor).toBe("human");

    // The point of the whole design: nothing published moved.
    expect(await testDb.source.count()).toBe(0);
    expect(await testDb.projectMetric.count()).toBe(0);
    expect(await testDb.project.count()).toBe(0);
  });

  it("never stores the submitter's IP address", async () => {
    const result = await createPublicSubmission(submission(), { ip: "203.0.113.7" });
    const candidate = await testDb.ingestionCandidate.findUnique({
      where: { id: result.id },
    });

    expect(candidate?.submitterIpHash).toBeTruthy();
    expect(candidate?.submitterIpHash).not.toContain("203.0.113.7");
    // A hash, not a reversible encoding of the address.
    expect(candidate?.submitterIpHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a URL already waiting in the queue", async () => {
    const input = submission();
    await createPublicSubmission(input, { ip: "1.2.3.4" });

    await expect(createPublicSubmission(input, { ip: "5.6.7.8" })).rejects.toThrow(
      /already waiting/i,
    );
  });

  it("rejects a URL already cited on a project", async () => {
    const project = await makeProject();
    const input = submission();
    await testDb.source.create({
      data: {
        projectId: project.id,
        title: "Already cited",
        url: input.url,
        sourceType: "NEWS_ARTICLE",
      },
    });

    await expect(createPublicSubmission(input, { ip: "1.2.3.4" })).rejects.toThrow(
      /already cited/i,
    );
  });

  it("rate-limits one address without blocking everyone else", async () => {
    for (let i = 0; i < 10; i += 1) {
      await createPublicSubmission(submission(), { ip: "9.9.9.9" });
    }

    await expect(
      createPublicSubmission(submission(), { ip: "9.9.9.9" }),
    ).rejects.toBeInstanceOf(RateLimitError);

    // A different submitter is unaffected.
    await expect(
      createPublicSubmission(submission(), { ip: "8.8.8.8" }),
    ).resolves.toBeTruthy();
  });

  it("silently discards a honeypot hit instead of explaining the check", async () => {
    const result = await createPublicSubmission(
      submission({ website: "http://spam.example" }),
      { ip: "1.2.3.4" },
    );

    expect(result.id).toBe("discarded");
    expect(await testDb.ingestionCandidate.count()).toBe(0);
  });

  it("keeps an unknown project id as unmatched rather than failing", async () => {
    const result = await createPublicSubmission(
      submission({ projectId: "does-not-exist" }),
      { ip: "1.2.3.4" },
    );

    const candidate = await testDb.ingestionCandidate.findUnique({
      where: { id: result.id },
    });
    expect(candidate?.suggestedProjectId).toBeNull();
  });

  it("records a named project as a full-confidence match suggestion", async () => {
    const project = await makeProject();
    const result = await createPublicSubmission(submission({ projectId: project.id }), {
      ip: "1.2.3.4",
    });

    const candidate = await testDb.ingestionCandidate.findUnique({
      where: { id: result.id },
    });
    expect(candidate?.suggestedProjectId).toBe(project.id);
    expect(candidate?.matchScore).toBe(100);
  });

  it("carries a suggested project name into the note when it is not tracked yet", async () => {
    const result = await createPublicSubmission(
      submission({ suggestedProjectName: "Fairwater Phase 3", note: "New build." }),
      { ip: "1.2.3.4" },
    );

    const candidate = await testDb.ingestionCandidate.findUnique({
      where: { id: result.id },
    });
    expect(candidate?.submitterNote).toContain("New build.");
    expect(candidate?.submitterNote).toContain("Fairwater Phase 3");
  });

  it("groups a day's submissions under one run", async () => {
    await createPublicSubmission(submission(), { ip: "1.2.3.4" });
    await createPublicSubmission(submission(), { ip: "1.2.3.4" });

    const runs = await testDb.ingestionRun.findMany({
      where: { watcher: "public:submissions" },
    });
    expect(runs).toHaveLength(1);
  });
});

describe("a submitted claim reaching the live data", () => {
  it("only does so once a reviewer accepts it, and never above LOW", async () => {
    const project = await makeProject();
    const reviewer = await testDb.user.create({
      data: { email: `reviewer-${counter}@example.com`, role: "ANALYST" },
    });

    const result = await createPublicSubmission(
      submission({
        projectId: project.id,
        claims: [
          {
            metricType: "POWER_MW",
            numericValue: 450,
            textValue: null,
            unit: "MW",
            // A submitter asserting the strongest level they are offered.
            confidenceLevel: "HIGH",
            methodology: "Stated in the filing.",
            effectiveDate: null,
          },
        ],
      }),
      { ip: "1.2.3.4" },
    );

    expect(await testDb.projectMetric.count()).toBe(0);

    // keepClaimIndices is required: a reviewer opts into each claim one at a
    // time, so accepting a source never silently accepts everything asserted
    // alongside it.
    await acceptCandidate({
      candidateId: result.id,
      projectId: project.id,
      reviewerId: reviewer.id,
      keepClaimIndices: [0],
    });

    const metrics = await testDb.projectMetric.findMany();
    expect(metrics).toHaveLength(1);
    // The submitter said HIGH; the acceptance path caps unreviewed claims at
    // LOW, so a form cannot mint a strong assertion.
    expect(metrics[0].confidenceLevel).toBe("LOW");
  });
});

describe("listMySubmissions", () => {
  it("returns only the signed-in submitter's own proposals", async () => {
    const mine = await testDb.user.create({
      data: { email: `mine-${counter}@example.com`, role: "VIEWER" },
    });
    const theirs = await testDb.user.create({
      data: { email: `theirs-${counter}@example.com`, role: "VIEWER" },
    });

    await createPublicSubmission(submission(), { ip: "1.1.1.1", userId: mine.id });
    await createPublicSubmission(submission(), { ip: "2.2.2.2", userId: theirs.id });
    await createPublicSubmission(submission(), { ip: "3.3.3.3" });

    const rows = await listMySubmissions(mine.id);
    expect(rows).toHaveLength(1);
  });
});
