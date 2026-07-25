import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  commitImport,
  mapHeaders,
  parseCsv,
  previewImport,
} from "@/lib/services/import";
import { disconnectTestDb, resetDatabase, testDb } from "../helpers/db";
import { makeCompany, makeProject, makeUser } from "../helpers/factories";

beforeEach(resetDatabase);
afterAll(disconnectTestDb);

const PROJECT_CSV_HEADER =
  "name,owner,project_type,status,country,city,estimated_power_mw,confirmed_power_mw,tags";

describe("parseCsv", () => {
  it("parses headers and rows, skipping blank lines", () => {
    const { headers, rows } = parseCsv("a,b\n1,2\n\n3,4\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toHaveLength(2);
  });

  it("handles quoted fields containing commas", () => {
    const { rows } = parseCsv('name,notes\n"Site A","Big, expensive, late"\n');
    expect(rows[0]!.notes).toBe("Big, expensive, late");
  });
});

describe("mapHeaders", () => {
  it("maps aliases to canonical fields", () => {
    const { mapping } = mapHeaders("projects", ["Project Name", "power_mw", "HQ"]);
    expect(mapping["Project Name"]).toBe("name");
    expect(mapping["power_mw"]).toBe("confirmedPowerMw");
  });

  it("reports unrecognised headers rather than guessing", () => {
    const { mapping, unmapped } = mapHeaders("projects", ["name", "wibble"]);
    expect(mapping["wibble"]).toBeNull();
    expect(unmapped).toEqual(["wibble"]);
  });
});

describe("previewImport — validation", () => {
  it("accepts a clean row", async () => {
    await makeCompany("Microsoft");
    const csv = `${PROJECT_CSV_HEADER}\nAshburn One,Microsoft,DATA_CENTER,ANNOUNCED,United States,Ashburn,250,,NVIDIA`;

    const preview = await previewImport("projects", csv);
    expect(preview.counts.error).toBe(0);
    expect(preview.rows[0]!.status).toBe("ok");
  });

  it("reports missing required columns and imports nothing", async () => {
    const preview = await previewImport("projects", "name,city\nOnly Name,Ashburn");
    expect(preview.missingRequired).toContain("country");
    expect(preview.rows[0]!.status).toBe("error");
  });

  it("rejects an invalid enum value with a row-level error", async () => {
    const csv = `${PROJECT_CSV_HEADER}\nBad Status,,DATA_CENTER,NOT_A_STATUS,United States,,,,`;
    const preview = await previewImport("projects", csv);

    expect(preview.rows[0]!.status).toBe("error");
    expect(preview.rows[0]!.issues.some((i) => i.column === "status")).toBe(true);
  });

  it("rejects a negative power value", async () => {
    const csv = `${PROJECT_CSV_HEADER}\nNegative,,DATA_CENTER,ANNOUNCED,United States,,-50,,`;
    const preview = await previewImport("projects", csv);

    expect(preview.rows[0]!.status).toBe("error");
    expect(
      preview.rows[0]!.issues.some((i) => i.message.includes("cannot be negative")),
    ).toBe(true);
  });

  it("treats a blank power cell as unknown, not as zero", async () => {
    const csv = `${PROJECT_CSV_HEADER}\nBlank Power,,DATA_CENTER,ANNOUNCED,United States,,,,`;
    const preview = await previewImport("projects", csv);

    const parsed = preview.rows[0]!.parsed as { estimatedPowerMw: number | null };
    expect(parsed.estimatedPowerMw).toBeNull();
  });

  it("preserves an explicit zero as a real value", async () => {
    const csv = `${PROJECT_CSV_HEADER}\nZero Power,,DATA_CENTER,ANNOUNCED,United States,,0,,`;
    const preview = await previewImport("projects", csv);

    const parsed = preview.rows[0]!.parsed as { estimatedPowerMw: number | null };
    expect(parsed.estimatedPowerMw).toBe(0);
  });

  it("warns rather than fails when the owner company is unknown", async () => {
    const csv = `${PROJECT_CSV_HEADER}\nOrphan,Nonexistent Corp,DATA_CENTER,ANNOUNCED,United States,,100,,`;
    const preview = await previewImport("projects", csv);

    expect(preview.rows[0]!.status).toBe("warning");
    expect(preview.rows[0]!.parsed).toBeDefined();
    expect(preview.rows[0]!.issues[0]!.column).toBe("owner");
  });

  it("resolves a known owner to its id", async () => {
    const company = await makeCompany("Oracle");
    const csv = `${PROJECT_CSV_HEADER}\nAbilene,Oracle,AI_FACTORY,ANNOUNCED,United States,Abilene,1200,,`;
    const preview = await previewImport("projects", csv);

    const parsed = preview.rows[0]!.parsed as { ownerCompanyId: string | null };
    expect(parsed.ownerCompanyId).toBe(company.id);
  });
});

describe("previewImport — duplicate detection", () => {
  it("flags a row that duplicates a project already in the database", async () => {
    await makeProject({ name: "Mount Pleasant AI Campus Phase 2" });
    const csv = `${PROJECT_CSV_HEADER}\nMt. Pleasant AI campus (phase 2),,DATA_CENTER,ANNOUNCED,United States,,,,`;

    const preview = await previewImport("projects", csv);
    expect(preview.rows[0]!.status).toBe("warning");
    expect(preview.rows[0]!.duplicateOf?.[0]?.name).toBe(
      "Mount Pleasant AI Campus Phase 2",
    );
  });

  it("flags a row that duplicates an earlier row in the same file", async () => {
    const csv = [
      PROJECT_CSV_HEADER,
      "Twin Site,,DATA_CENTER,ANNOUNCED,United States,,,,",
      "Twin Site,,DATA_CENTER,ANNOUNCED,United States,,,,",
    ].join("\n");

    const preview = await previewImport("projects", csv);
    expect(preview.rows[0]!.duplicateOfRow).toBeUndefined();
    expect(preview.rows[1]!.duplicateOfRow).toBe(1);
  });
});

describe("commitImport", () => {
  it("writes only the accepted rows", async () => {
    const user = await makeUser();
    const csv = [
      PROJECT_CSV_HEADER,
      "Accepted Site,,DATA_CENTER,ANNOUNCED,United States,,100,,",
      "Skipped Site,,DATA_CENTER,ANNOUNCED,United States,,200,,",
    ].join("\n");

    const result = await commitImport("projects", csv, [1], user.id);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    const names = (await testDb.project.findMany({ select: { name: true } })).map(
      (p) => p.name,
    );
    expect(names).toEqual(["Accepted Site"]);
  });

  it("writes nothing when no rows are accepted", async () => {
    const user = await makeUser();
    const csv = `${PROJECT_CSV_HEADER}\nUnaccepted,,DATA_CENTER,ANNOUNCED,United States,,100,,`;

    const result = await commitImport("projects", csv, [], user.id);
    expect(result.created).toBe(0);
    expect(await testDb.project.count()).toBe(0);
  });

  it("continues past a failing row instead of aborting the whole import", async () => {
    const user = await makeUser();
    // Row 1 is fine; row 2 collides on a unique company slug when imported twice.
    const csv = [
      "name,company_type",
      "Alpha Vendor,GPU_VENDOR",
      "Alpha Vendor,GPU_VENDOR",
    ].join("\n");

    const result = await commitImport("companies", csv, [1, 2], user.id);

    expect(result.created).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.rowNumber).toBe(2);
  });

  it("imports companies with a normalised uppercase ticker", async () => {
    const user = await makeUser();
    const csv = "name,company_type,ticker\nExample Neocloud,NEOCLOUD,exmpl";

    await commitImport("companies", csv, [1], user.id);

    const company = await testDb.company.findFirstOrThrow();
    expect(company.ticker).toBe("EXMPL");
  });

  it("imports sources against an existing project slug", async () => {
    const user = await makeUser();
    const project = await makeProject({ name: "Source Target", sourceCount: 0 });

    const csv = [
      "project_slug,title,url,source_type,reliability_score,is_primary_source",
      `${project.slug},Filing,https://example.com/f,UTILITY_FILING,96,TRUE`,
    ].join("\n");

    const result = await commitImport("sources", csv, [1], user.id);
    expect(result.created).toBe(1);

    const source = await testDb.source.findFirstOrThrow();
    expect(source.projectId).toBe(project.id);
    expect(source.isPrimarySource).toBe(true);
  });

  it("rejects a source row whose project slug does not exist", async () => {
    const csv = [
      "project_slug,title,url,source_type",
      "no-such-project,Filing,https://example.com/f,UTILITY_FILING",
    ].join("\n");

    const preview = await previewImport("sources", csv);
    expect(preview.rows[0]!.status).toBe("error");
    expect(preview.rows[0]!.issues[0]!.message).toContain("no-such-project");
  });
});
