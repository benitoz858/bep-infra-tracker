import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ConflictError, DataQualityError } from "@/lib/services/errors";
import { createProject, listProjects, updateProject } from "@/lib/services/projects";
import { projectQuerySchema } from "@/lib/validations/project";
import { disconnectTestDb, resetDatabase, testDb } from "../helpers/db";
import { makeCompany, makeProject, makeUser, projectInput } from "../helpers/factories";

const query = (overrides: Record<string, string> = {}) =>
  projectQuerySchema.parse(overrides);

beforeEach(resetDatabase);
afterAll(disconnectTestDb);

describe("createProject", () => {
  it("creates a project and derives a unique slug", async () => {
    const user = await makeUser();
    const { project } = await createProject(
      projectInput({ name: "Ashburn Campus One" }),
      user.id,
    );

    expect(project.slug).toBe("ashburn-campus-one");

    const stored = await testDb.project.findUnique({ where: { id: project.id } });
    expect(stored?.name).toBe("Ashburn Campus One");
    // Not seeded, so it must not carry the demo flag.
    expect(stored?.isDemoData).toBe(false);
  });

  it("suffixes the slug rather than colliding", async () => {
    const user = await makeUser();
    await createProject(projectInput({ name: "Twin Site" }), user.id);
    const second = await createProject(
      projectInput({ name: "Twin Site", city: "Elsewhere" }),
      user.id,
    );
    expect(second.project.slug).toBe("twin-site-2");
  });

  it("writes a creation revision", async () => {
    const user = await makeUser();
    const { project } = await createProject(projectInput(), user.id);

    const revisions = await testDb.projectRevision.findMany({
      where: { projectId: project.id },
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.changeSummary).toContain("created");
    expect(revisions[0]!.userId).toBe(user.id);
  });

  it("persists sources and links metrics to the source created in the same request", async () => {
    const user = await makeUser();
    const { project } = await createProject(
      projectInput({
        name: "Evidence Site",
        sources: [
          {
            title: "Utility filing",
            url: "https://example.com/filing",
            sourceType: "UTILITY_FILING",
            publisher: "ERCOT",
            publicationDate: null,
            excerpt: null,
            archivedUrl: null,
            reliabilityScore: 96,
            isPrimarySource: true,
            accessedAt: null,
          },
        ],
        metrics: [
          {
            metricType: "POWER_MW",
            numericValue: 200,
            textValue: null,
            unit: "MW",
            confidenceLevel: "CONFIRMED",
            methodology: "Energised load in the filing.",
            effectiveDate: null,
            // The form references a not-yet-persisted source by index.
            sourceId: "new:0",
          },
        ],
      }),
      user.id,
    );

    const metrics = await testDb.projectMetric.findMany({
      where: { projectId: project.id },
      include: { source: true },
    });

    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.sourceId).not.toBeNull();
    expect(metrics[0]!.source?.title).toBe("Utility filing");
  });

  it("rejects a CONFIRMED metric whose source does not resolve", async () => {
    const user = await makeUser();
    await expect(
      createProject(
        projectInput({
          metrics: [
            {
              metricType: "POWER_MW",
              numericValue: 100,
              textValue: null,
              unit: "MW",
              confidenceLevel: "CONFIRMED",
              methodology: null,
              effectiveDate: null,
              // Points at a source index that was never submitted.
              sourceId: "new:5",
            },
          ],
        }),
        user.id,
      ),
    ).rejects.toBeInstanceOf(DataQualityError);
  });

  it("blocks a likely duplicate until it is acknowledged", async () => {
    const user = await makeUser();
    await createProject(
      projectInput({
        name: "Mount Pleasant AI Campus Phase 2",
        city: "Mount Pleasant",
      }),
      user.id,
    );

    const attempt = createProject(
      projectInput({
        name: "Mt. Pleasant AI campus (phase 2)",
        city: "Mount Pleasant",
        acknowledgeDuplicate: false,
      }),
      user.id,
    );

    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows the duplicate through once acknowledged", async () => {
    const user = await makeUser();
    await createProject(projectInput({ name: "Twin Campus" }), user.id);

    const { project } = await createProject(
      projectInput({ name: "Twin Campus", acknowledgeDuplicate: true }),
      user.id,
    );
    expect(project.id).toBeTruthy();
  });

  it("links tags, creating them when new", async () => {
    const user = await makeUser();
    const { project } = await createProject(
      projectInput({ tagNames: ["NVIDIA", "liquid cooling"] }),
      user.id,
    );

    const stored = await testDb.project.findUnique({
      where: { id: project.id },
      include: { tags: true },
    });
    expect(stored?.tags.map((t) => t.name).sort()).toEqual([
      "NVIDIA",
      "liquid cooling",
    ]);
  });

  it("returns a warning when the expected opening precedes the announcement", async () => {
    const user = await makeUser();
    const { warnings } = await createProject(
      projectInput({
        announcementDate: new Date("2026-06-01"),
        expectedOpeningDate: new Date("2026-01-01"),
      }),
      user.id,
    );
    expect(warnings.join(" ")).toContain("before the announcement date");
  });
});

describe("updateProject", () => {
  it("records a revision containing only the fields that changed", async () => {
    const user = await makeUser();
    const { project } = await createProject(
      projectInput({ name: "Before Name", status: "ANNOUNCED" }),
      user.id,
    );

    await updateProject(
      project.id,
      projectInput({ name: "After Name", status: "UNDER_CONSTRUCTION" }),
      user.id,
    );

    const revisions = await testDb.projectRevision.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });

    // One for creation, one for this edit.
    expect(revisions).toHaveLength(2);
    const diff = revisions[0]!.newData as Record<string, string>;
    expect(diff.name).toBe("After Name");
    expect(diff.status).toBe("UNDER_CONSTRUCTION");
    expect(Object.keys(diff)).not.toContain("country");
  });

  it("does not write a revision when nothing material changed", async () => {
    const user = await makeUser();
    const input = projectInput({ name: "Unchanged Site" });
    const { project } = await createProject(input, user.id);

    // Re-submit the identical form.
    await updateProject(project.id, input, user.id);

    const revisions = await testDb.projectRevision.count({
      where: { projectId: project.id },
    });
    expect(revisions).toBe(1);
  });

  it("replaces the tag list rather than appending to it", async () => {
    const user = await makeUser();
    const { project } = await createProject(
      projectInput({ tagNames: ["NVIDIA", "nuclear"] }),
      user.id,
    );

    await updateProject(project.id, projectInput({ tagNames: ["NVIDIA"] }), user.id);

    const stored = await testDb.project.findUnique({
      where: { id: project.id },
      include: { tags: true },
    });
    expect(stored?.tags.map((t) => t.name)).toEqual(["NVIDIA"]);
  });
});

describe("listProjects filtering and sorting", () => {
  it("filters by status", async () => {
    await makeProject({ name: "Live One", status: "OPERATIONAL" });
    await makeProject({ name: "Dead One", status: "CANCELLED" });

    const result = await listProjects(query({ status: "OPERATIONAL" }));
    expect(result.rows.map((r) => r.name)).toEqual(["Live One"]);
  });

  it("filters by country and owner", async () => {
    const company = await makeCompany("Owner Co");
    await makeProject({
      name: "US Site",
      country: "United States",
      ownerCompanyId: company.id,
    });
    await makeProject({ name: "JP Site", country: "Japan" });

    expect(
      (await listProjects(query({ country: "Japan" }))).rows.map((r) => r.name),
    ).toEqual(["JP Site"]);
    expect(
      (await listProjects(query({ ownerId: company.id }))).rows.map((r) => r.name),
    ).toEqual(["US Site"]);
  });

  it("applies minPowerMw against the best available figure", async () => {
    await makeProject({ name: "Confirmed Big", confirmedPowerMw: 500 });
    await makeProject({ name: "Estimated Big", estimatedPowerMw: 400 });
    await makeProject({ name: "Small", confirmedPowerMw: 50 });

    const result = await listProjects(query({ minPowerMw: "300" }));
    expect(result.rows.map((r) => r.name).sort()).toEqual([
      "Confirmed Big",
      "Estimated Big",
    ]);
  });

  it("searches across name and country", async () => {
    await makeProject({ name: "Reykjanes Node", country: "Iceland" });
    await makeProject({ name: "Denton Factory", country: "United States" });

    expect((await listProjects(query({ q: "reykjanes" }))).rows).toHaveLength(1);
    expect((await listProjects(query({ q: "iceland" }))).rows).toHaveLength(1);
  });

  it("hides demo rows only when asked", async () => {
    await makeProject({ name: "Real Site", isDemoData: false });
    await makeProject({ name: "Demo Site", isDemoData: true });

    expect((await listProjects(query())).total).toBe(2);
    expect(
      (await listProjects(query({ includeDemo: "0" }))).rows.map((r) => r.name),
    ).toEqual(["Real Site"]);
  });

  it("sorts by power descending with unknowns last", async () => {
    await makeProject({ name: "No Power" });
    await makeProject({ name: "Mid", confirmedPowerMw: 300 });
    await makeProject({ name: "Top", confirmedPowerMw: 900 });

    const result = await listProjects(query({ sort: "powerMw.desc" }));
    expect(result.rows.map((r) => r.name)).toEqual(["Top", "Mid", "No Power"]);
  });

  it("serialises Decimal columns to strings so rows can cross to the client", async () => {
    await makeProject({ name: "Decimal Site", confirmedPowerMw: 450 });

    const result = await listProjects(query());
    const row = result.rows[0]!;
    expect(typeof row.confirmedPowerMw).toBe("string");
    expect(row.confirmedPowerMw).toBe("450");
  });

  it("paginates", async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeProject({ name: `Site ${i}` });
    }

    const page1 = await listProjects(query({ perPage: "2", page: "1" }));
    const page2 = await listProjects(query({ perPage: "2", page: "2" }));

    expect(page1.rows).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.pageCount).toBe(3);
    expect(page2.rows[0]!.id).not.toBe(page1.rows[0]!.id);
  });
});
