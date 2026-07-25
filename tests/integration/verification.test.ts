import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  STALE_AFTER_DAYS,
  getVerificationQueue,
  markVerified,
} from "@/lib/services/verification";
import { disconnectTestDb, resetDatabase, testDb } from "../helpers/db";
import { makeProject } from "../helpers/factories";

beforeEach(resetDatabase);
afterAll(disconnectTestDb);

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Baseline: verified today, two reliable sources, nothing else wrong. */
async function cleanProject(name: string) {
  return makeProject({
    name,
    status: "OPERATIONAL",
    lastVerifiedAt: new Date(),
    sourceCount: 2,
    sourceReliability: 90,
  });
}

describe("verification queue rules", () => {
  it("leaves a clean project out of the queue", async () => {
    await cleanProject("Clean Site");
    expect(await getVerificationQueue()).toHaveLength(0);
  });

  it("flags a project never verified", async () => {
    await makeProject({ name: "Never", lastVerifiedAt: null, status: "OPERATIONAL" });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("never_verified");
  });

  it("flags a project not verified within the staleness window", async () => {
    await makeProject({
      name: "Stale",
      status: "OPERATIONAL",
      lastVerifiedAt: daysAgo(STALE_AFTER_DAYS + 5),
    });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("stale_verification");
  });

  it("does not flag a project verified just inside the window", async () => {
    await makeProject({
      name: "Fresh",
      status: "OPERATIONAL",
      lastVerifiedAt: daysAgo(STALE_AFTER_DAYS - 5),
    });
    expect(await getVerificationQueue()).toHaveLength(0);
  });

  it("flags an expected opening date that has passed while not operational", async () => {
    await makeProject({
      name: "Overdue",
      status: "UNDER_CONSTRUCTION",
      lastVerifiedAt: new Date(),
      expectedOpeningDate: daysAgo(30),
    });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("opening_date_passed");
  });

  it("does not flag a passed opening date once the project is operational", async () => {
    await makeProject({
      name: "Opened",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      expectedOpeningDate: daysAgo(30),
    });
    expect(await getVerificationQueue()).toHaveLength(0);
  });

  it("flags a project with no sources", async () => {
    await makeProject({
      name: "Unsourced",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      sourceCount: 0,
    });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("no_sources");
  });

  /**
   * Regression: this case used to fall out of the queue entirely. The single-
   * source rule is not expressible in Prisma's `where`, so it depends on the raw
   * SQL evidence query being OR-ed into the predicate.
   */
  it("flags a recently verified project that still has only one source", async () => {
    await makeProject({
      name: "Thin Evidence",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      sourceCount: 1,
      sourceReliability: 95,
    });

    const queue = await getVerificationQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.reasons).toEqual(["single_source"]);
  });

  it("flags a project whose best source is below the reliability threshold", async () => {
    await makeProject({
      name: "Weak Evidence",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      sourceCount: 2,
      sourceReliability: 30,
    });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("low_reliability");
  });

  it("flags a confirmed figure that exceeds its own estimate", async () => {
    await makeProject({
      name: "Conflicting",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      confirmedPowerMw: 900,
      estimatedPowerMw: 450,
    });
    const queue = await getVerificationQueue();
    expect(queue[0]!.reasons).toContain("value_conflict");
  });

  it("does not flag a confirmed figure below its estimate", async () => {
    await cleanProject("Consistent");
    await testDb.project.updateMany({
      where: { name: "Consistent" },
      data: { confirmedPowerMw: 450, estimatedPowerMw: 900 },
    });
    expect(await getVerificationQueue()).toHaveLength(0);
  });

  it("flags inherently unstable statuses", async () => {
    for (const status of ["RUMORED", "DELAYED", "PERMITTING"] as const) {
      await resetDatabase();
      await makeProject({
        name: `Status ${status}`,
        status,
        lastVerifiedAt: new Date(),
      });
      const queue = await getVerificationQueue();
      expect(queue[0]!.reasons).toContain("unstable_status");
    }
  });

  it("excludes cancelled projects entirely", async () => {
    await makeProject({
      name: "Cancelled",
      status: "CANCELLED",
      lastVerifiedAt: null,
      sourceCount: 0,
    });
    expect(await getVerificationQueue()).toHaveLength(0);
  });

  it("orders the worst records first", async () => {
    await makeProject({
      name: "One Reason",
      status: "OPERATIONAL",
      lastVerifiedAt: new Date(),
      sourceCount: 1,
    });
    await makeProject({
      name: "Many Reasons",
      status: "RUMORED",
      lastVerifiedAt: null,
      sourceCount: 0,
      expectedOpeningDate: daysAgo(10),
    });

    const queue = await getVerificationQueue();
    expect(queue[0]!.name).toBe("Many Reasons");
    expect(queue[0]!.reasons.length).toBeGreaterThan(queue[1]!.reasons.length);
  });
});

describe("markVerified", () => {
  it("clears the staleness reason but leaves other reasons standing", async () => {
    const project = await makeProject({
      name: "Partly Fixed",
      status: "OPERATIONAL",
      lastVerifiedAt: daysAgo(200),
      sourceCount: 1,
    });

    const before = await getVerificationQueue();
    expect(before[0]!.reasons).toContain("stale_verification");
    expect(before[0]!.reasons).toContain("single_source");

    await markVerified(project.id);

    const after = await getVerificationQueue();
    // Still queued — verifying does not add a source.
    expect(after).toHaveLength(1);
    expect(after[0]!.reasons).toEqual(["single_source"]);
  });
});
