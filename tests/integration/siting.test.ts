import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase, testDb } from "../helpers/db";

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("../helpers/db");
  return { prisma: testDb };
});

const {
  getAdoptionBaseRate,
  getExpiryCalendar,
  getExposureByGridRegion,
  getExposureByProject,
  getSitingSummary,
} = await import("@/lib/services/siting");

let counter = 0;

async function makeProject(opts: {
  name?: string;
  mw?: number;
  status?: "ANNOUNCED" | "UNDER_CONSTRUCTION" | "CANCELLED";
  gridRegion?: "PJM" | "ERCOT";
}) {
  counter += 1;
  return testDb.project.create({
    data: {
      slug: `siting-fixture-${counter}`,
      name: opts.name ?? `Project ${counter}`,
      country: "United States",
      projectType: "DATA_CENTER",
      status: opts.status ?? "ANNOUNCED",
      confirmedPowerMw: opts.mw ?? 100,
      gridRegion: opts.gridRegion ?? "PJM",
    },
  });
}

async function makeRestriction(opts: {
  bindingLevel: "ADVISORY" | "PROPOSED" | "PROCEDURAL" | "CONDITIONAL" | "TEMPORARY_BAN" | "PERMANENT_BAN";
  status?: "ACTIVE" | "EXPIRED" | "PROPOSED" | "REJECTED" | "LIFTED";
  expiryDate?: Date | null;
  jurisdiction?: string;
}) {
  counter += 1;
  return testDb.restriction.create({
    data: {
      slug: `restriction-fixture-${counter}`,
      jurisdiction: opts.jurisdiction ?? `Jurisdiction ${counter}`,
      level: "COUNTY",
      country: "United States",
      scope: "NEW_CONSTRUCTION",
      bindingLevel: opts.bindingLevel,
      status: opts.status ?? "ACTIVE",
      title: `Restriction ${counter}`,
      expiryDate: opts.expiryDate ?? null,
    },
  });
}

async function link(
  projectId: string,
  restrictionId: string,
  impact: "BLOCKED" | "DELAYED" | "EXEMPT" | "UNDER_REVIEW" = "BLOCKED",
  affectedMw?: number,
) {
  return testDb.projectRestriction.create({
    data: { projectId, restrictionId, impact, affectedMw: affectedMw ?? null },
  });
}

describe("siting risk", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("what counts toward MW at risk", () => {
    it("ignores restrictions that do not actually bind", async () => {
      const project = await makeProject({ mw: 500 });
      for (const level of ["ADVISORY", "PROPOSED", "PROCEDURAL"] as const) {
        const r = await makeRestriction({ bindingLevel: level });
        await link(project.id, r.id);
      }

      // The whole point of the graded scale: a study, a bill and an extra
      // hearing are not a block, however many of them there are.
      await expect(getExposureByProject()).resolves.toHaveLength(0);
    });

    it("counts conditional and above", async () => {
      const project = await makeProject({ mw: 500 });
      const r = await makeRestriction({ bindingLevel: "CONDITIONAL" });
      await link(project.id, r.id);

      const exposure = await getExposureByProject();
      expect(exposure).toHaveLength(1);
      expect(exposure[0]?.atRiskMw).toBe(500);
    });

    it("ignores restrictions that are no longer in force", async () => {
      const project = await makeProject({ mw: 500 });
      for (const status of ["EXPIRED", "LIFTED", "REJECTED", "PROPOSED"] as const) {
        const r = await makeRestriction({ bindingLevel: "PERMANENT_BAN", status });
        await link(project.id, r.id);
      }
      await expect(getExposureByProject()).resolves.toHaveLength(0);
    });

    it("ignores exempt and under-review links", async () => {
      const project = await makeProject({ mw: 500 });
      const r1 = await makeRestriction({ bindingLevel: "PERMANENT_BAN" });
      const r2 = await makeRestriction({ bindingLevel: "PERMANENT_BAN" });
      await link(project.id, r1.id, "EXEMPT");
      await link(project.id, r2.id, "UNDER_REVIEW");

      await expect(getExposureByProject()).resolves.toHaveLength(0);
    });

    it("excludes cancelled projects — their capacity is not pipeline", async () => {
      const project = await makeProject({ mw: 500, status: "CANCELLED" });
      const r = await makeRestriction({ bindingLevel: "PERMANENT_BAN" });
      await link(project.id, r.id);

      await expect(getExposureByProject()).resolves.toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("counts a project once across several restrictions, not once per restriction", async () => {
      const project = await makeProject({ mw: 900 });
      const county = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
      const state = await makeRestriction({ bindingLevel: "CONDITIONAL" });
      await link(project.id, county.id);
      await link(project.id, state.id);

      const exposure = await getExposureByProject();
      expect(exposure).toHaveLength(1);
      // Summing the join rows would report 1,800 MW for one 900 MW campus —
      // and would inflate exactly the biggest, most contested projects.
      expect(exposure[0]?.atRiskMw).toBe(900);
      expect(exposure[0]?.restrictionCount).toBe(2);
    });

    it("reports the worst bindingness across overlapping restrictions", async () => {
      const project = await makeProject({ mw: 100 });
      const mild = await makeRestriction({ bindingLevel: "CONDITIONAL" });
      const severe = await makeRestriction({ bindingLevel: "PERMANENT_BAN" });
      await link(project.id, mild.id);
      await link(project.id, severe.id);

      const exposure = await getExposureByProject();
      expect(exposure[0]?.worstBinding).toBe("PERMANENT_BAN");
    });

    it("takes the largest affected capacity, not the sum", async () => {
      const project = await makeProject({ mw: 900 });
      const a = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
      const b = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
      await link(project.id, a.id, "BLOCKED", 200);
      await link(project.id, b.id, "BLOCKED", 450);

      const exposure = await getExposureByProject();
      expect(exposure[0]?.atRiskMw).toBe(450);
    });

    it("uses affectedMw when only part of a project is blocked", async () => {
      const project = await makeProject({ mw: 900 });
      const r = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
      await link(project.id, r.id, "BLOCKED", 300);

      const exposure = await getExposureByProject();
      expect(exposure[0]?.atRiskMw).toBe(300);
    });
  });

  describe("summary", () => {
    it("separates live-but-non-binding from genuinely blocking", async () => {
      const project = await makeProject({ mw: 400 });
      const binding = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
      await link(project.id, binding.id);
      await makeRestriction({ bindingLevel: "ADVISORY" });
      await makeRestriction({ bindingLevel: "PROCEDURAL" });

      const summary = await getSitingSummary();
      expect(summary.atRiskMw).toBe(400);
      expect(summary.liveRestrictions).toBe(3);
      // The gap between "ordinances tracked" and "capacity blocked".
      expect(summary.nonBlockingLive).toBe(2);
    });

    it("expresses risk as a share of tracked pipeline", async () => {
      const blocked = await makeProject({ mw: 250 });
      await makeProject({ mw: 750 });
      const r = await makeRestriction({ bindingLevel: "PERMANENT_BAN" });
      await link(blocked.id, r.id);

      const summary = await getSitingSummary();
      expect(summary.shareOfPipelinePct).toBe(25);
    });

    it("groups exposure by grid region", async () => {
      const pjm = await makeProject({ mw: 300, gridRegion: "PJM" });
      const ercot = await makeProject({ mw: 200, gridRegion: "ERCOT" });
      for (const p of [pjm, ercot]) {
        const r = await makeRestriction({ bindingLevel: "TEMPORARY_BAN" });
        await link(p.id, r.id);
      }

      const byRegion = await getExposureByGridRegion();
      expect(byRegion.map((r) => [r.key, r.mw])).toEqual([
        ["PJM", 300],
        ["ERCOT", 200],
      ]);
    });
  });

  describe("expiry calendar", () => {
    it("lists upcoming expiries with the capacity they release", async () => {
      const now = new Date("2026-07-01T00:00:00Z");
      const project = await makeProject({ mw: 600 });
      const r = await makeRestriction({
        bindingLevel: "TEMPORARY_BAN",
        expiryDate: new Date("2026-12-01T00:00:00Z"),
      });
      await link(project.id, r.id);

      const calendar = await getExpiryCalendar(now);
      expect(calendar).toHaveLength(1);
      expect(calendar[0]?.releasedMw).toBe(600);
      expect(calendar[0]?.endDateUnpublished).toBe(false);
    });

    it("flags a time-limited ban with no published end date", async () => {
      const now = new Date("2026-07-01T00:00:00Z");
      const r = await makeRestriction({ bindingLevel: "TEMPORARY_BAN", expiryDate: null });
      const project = await makeProject({ mw: 100 });
      await link(project.id, r.id);

      const calendar = await getExpiryCalendar(now);
      // Missing information must be visible, not silently read as "indefinite".
      expect(calendar[0]?.endDateUnpublished).toBe(true);
      expect(calendar[0]?.expiryDate).toBeNull();
    });

    it("excludes expiries beyond the horizon", async () => {
      const now = new Date("2026-07-01T00:00:00Z");
      const r = await makeRestriction({
        bindingLevel: "TEMPORARY_BAN",
        expiryDate: new Date("2030-01-01T00:00:00Z"),
      });
      await link((await makeProject({ mw: 100 })).id, r.id);

      await expect(getExpiryCalendar(now, 24)).resolves.toHaveLength(0);
    });
  });

  describe("adoption base rate", () => {
    it("excludes undecided proposals from the rate", async () => {
      await makeRestriction({ bindingLevel: "TEMPORARY_BAN", status: "ACTIVE" });
      await makeRestriction({ bindingLevel: "TEMPORARY_BAN", status: "EXPIRED" });
      await makeRestriction({ bindingLevel: "PROPOSED", status: "REJECTED" });
      await makeRestriction({ bindingLevel: "PROPOSED", status: "PROPOSED" });

      const rate = await getAdoptionBaseRate();
      // 2 adopted of 3 decided. The pending one is not a failure.
      expect(rate.decided).toBe(3);
      expect(rate.pending).toBe(1);
      expect(rate.adoptionRatePct).toBeCloseTo(66.7, 1);
    });

    it("returns null rather than 0% when nothing has been decided", async () => {
      await makeRestriction({ bindingLevel: "PROPOSED", status: "PROPOSED" });
      const rate = await getAdoptionBaseRate();
      // 0% would assert that everything failed, which is a different claim.
      expect(rate.adoptionRatePct).toBeNull();
    });
  });
});
