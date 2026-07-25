import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getCapacityByYear,
  getDashboardSummary,
  getPowerByCountry,
  getPowerByOwner,
  getStatusBreakdown,
} from "@/lib/services/analytics";
import {
  getPublicCompanyExposure,
  getSupplierExposure,
} from "@/lib/services/companies";
import { disconnectTestDb, resetDatabase, testDb } from "../helpers/db";
import { makeCompany, makeProject } from "../helpers/factories";

beforeEach(resetDatabase);
afterAll(disconnectTestDb);

describe("getDashboardSummary", () => {
  it("uses the confirmed figure when present and the estimate otherwise", async () => {
    // Best-available: 450 (confirmed wins over its own 900 estimate) + 300 (estimate only).
    await makeProject({
      name: "Confirmed",
      confirmedPowerMw: 450,
      estimatedPowerMw: 900,
    });
    await makeProject({ name: "Estimated", estimatedPowerMw: 300 });

    const summary = await getDashboardSummary();
    expect(summary.announcedPowerMw).toBe(750);
    // Confirmed subtotal counts only the confirmed row.
    expect(summary.confirmedPowerMw).toBe(450);
  });

  it("excludes cancelled projects from capacity totals but not from the count", async () => {
    await makeProject({ name: "Live", confirmedPowerMw: 100 });
    await makeProject({ name: "Dead", confirmedPowerMw: 900, status: "CANCELLED" });

    const summary = await getDashboardSummary();
    expect(summary.announcedPowerMw).toBe(100);
    expect(summary.totalProjects).toBe(2);
  });

  it("counts distinct countries", async () => {
    await makeProject({ name: "A", country: "United States" });
    await makeProject({ name: "B", country: "United States" });
    await makeProject({ name: "C", country: "Japan" });

    expect((await getDashboardSummary()).countriesCovered).toBe(2);
  });

  it("reports zero rather than NaN on an empty database", async () => {
    const summary = await getDashboardSummary();
    expect(summary.announcedPowerMw).toBe(0);
    expect(summary.confirmedPowerMw).toBe(0);
    expect(summary.estimatedGpuCount).toBe(0);
    expect(summary.totalProjects).toBe(0);
  });

  it("counts demo rows separately so the UI can warn about them", async () => {
    await makeProject({ name: "Real", isDemoData: false });
    await makeProject({ name: "Demo", isDemoData: true });

    expect((await getDashboardSummary()).demoDataCount).toBe(1);
  });

  it("sums GPU counts using the best available figure", async () => {
    await makeProject({
      name: "Conf",
      confirmedGpuCount: 1000,
      estimatedGpuCount: 4000,
    });
    await makeProject({ name: "Est", estimatedGpuCount: 500 });

    const summary = await getDashboardSummary();
    expect(summary.estimatedGpuCount).toBe(1500);
    expect(summary.confirmedGpuCount).toBe(1000);
  });
});

describe("getStatusBreakdown", () => {
  it("counts projects per status", async () => {
    await makeProject({ name: "A", status: "OPERATIONAL" });
    await makeProject({ name: "B", status: "OPERATIONAL" });
    await makeProject({ name: "C", status: "DELAYED" });

    const rows = await getStatusBreakdown();
    expect(rows.find((r) => r.status === "OPERATIONAL")?.count).toBe(2);
    expect(rows.find((r) => r.status === "DELAYED")?.count).toBe(1);
  });
});

describe("getPowerByCountry / getPowerByOwner", () => {
  it("groups and orders by capacity descending", async () => {
    await makeProject({ name: "Big", country: "United States", confirmedPowerMw: 900 });
    await makeProject({ name: "Small", country: "Japan", confirmedPowerMw: 100 });

    const rows = await getPowerByCountry();
    expect(rows[0]!.label).toBe("United States");
    expect(rows[0]!.powerMw).toBe(900);
  });

  it("labels projects with no owner as Unattributed", async () => {
    await makeProject({ name: "Orphan", confirmedPowerMw: 50 });

    const rows = await getPowerByOwner();
    expect(rows[0]!.label).toBe("Unattributed");
  });

  it("attributes capacity to the owning company", async () => {
    const company = await makeCompany("Owner Co");
    await makeProject({
      name: "Owned",
      ownerCompanyId: company.id,
      confirmedPowerMw: 400,
    });

    const rows = await getPowerByOwner();
    expect(rows[0]!.label).toBe("Owner Co");
    expect(rows[0]!.powerMw).toBe(400);
  });
});

describe("getCapacityByYear", () => {
  it("separates announced from operational capacity in the same year", async () => {
    await makeProject({
      name: "Open",
      status: "OPERATIONAL",
      confirmedPowerMw: 200,
      expectedOpeningDate: new Date("2026-03-01"),
    });
    await makeProject({
      name: "Building",
      status: "UNDER_CONSTRUCTION",
      confirmedPowerMw: 800,
      expectedOpeningDate: new Date("2026-09-01"),
    });

    const rows = await getCapacityByYear();
    const y2026 = rows.find((r) => r.year === 2026)!;

    expect(y2026.announcedMw).toBe(1000);
    // The gap between the two series is the un-energised pipeline.
    expect(y2026.operationalMw).toBe(200);
  });

  it("ignores projects with no dates at all", async () => {
    await makeProject({ name: "Undated", confirmedPowerMw: 500 });
    expect(await getCapacityByYear()).toHaveLength(0);
  });

  it("returns numbers, not strings, so charts can plot them", async () => {
    await makeProject({
      name: "Typed",
      confirmedPowerMw: 250,
      expectedOpeningDate: new Date("2027-01-01"),
    });

    const rows = await getCapacityByYear();
    expect(typeof rows[0]!.announcedMw).toBe("number");
    expect(typeof rows[0]!.year).toBe("number");
  });
});

describe("exposure rollups", () => {
  it("does not double-count a company that both owns and supplies a project", async () => {
    const company = await makeCompany("Dual Role Co", "GPU_VENDOR");
    await testDb.company.update({
      where: { id: company.id },
      data: { ticker: "DUAL" },
    });

    const project = await makeProject({
      name: "Dual Site",
      ownerCompanyId: company.id,
      confirmedPowerMw: 500,
    });
    await testDb.projectCompany.create({
      data: { projectId: project.id, companyId: company.id, role: "GPU_SUPPLIER" },
    });

    const exposure = await getPublicCompanyExposure();
    const row = exposure.find((c) => c.ticker === "DUAL")!;

    // 500 MW owned, and the same project must not add another 500 via the link.
    expect(row.ownedMw).toBe(500);
    expect(row.linkedMw).toBe(0);
    expect(row.totalMw).toBe(500);
    expect(row.projectCount).toBe(1);
  });

  it("excludes companies with no linked projects", async () => {
    const company = await makeCompany("Unlinked Co");
    await testDb.company.update({
      where: { id: company.id },
      data: { ticker: "NONE" },
    });

    const exposure = await getPublicCompanyExposure();
    expect(exposure.find((c) => c.ticker === "NONE")).toBeUndefined();
  });

  it("counts supplier capacity once per project even across multiple roles", async () => {
    const vendor = await makeCompany("Multi Role Vendor", "SERVER_VENDOR");
    const project = await makeProject({ name: "Vendor Site", confirmedPowerMw: 300 });

    await testDb.projectCompany.createMany({
      data: [
        { projectId: project.id, companyId: vendor.id, role: "SERVER_SUPPLIER" },
        { projectId: project.id, companyId: vendor.id, role: "GPU_SUPPLIER" },
      ],
    });

    const exposure = await getSupplierExposure();
    const row = exposure.find((s) => s.name === "Multi Role Vendor")!;

    expect(row.powerMw).toBe(300);
    expect(row.projectCount).toBe(1);
    expect(row.roles.sort()).toEqual(["GPU_SUPPLIER", "SERVER_SUPPLIER"]);
  });

  it("excludes cancelled projects from supplier exposure", async () => {
    const vendor = await makeCompany("Cancelled Vendor", "SERVER_VENDOR");
    const project = await makeProject({
      name: "Cancelled Site",
      confirmedPowerMw: 300,
      status: "CANCELLED",
    });
    await testDb.projectCompany.create({
      data: { projectId: project.id, companyId: vendor.id, role: "SERVER_SUPPLIER" },
    });

    const exposure = await getSupplierExposure();
    expect(exposure.find((s) => s.name === "Cancelled Vendor")).toBeUndefined();
  });
});
