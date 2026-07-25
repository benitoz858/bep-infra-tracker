import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/services/errors";
import {
  createSource,
  createSourceWithClaims,
  deleteSource,
  listProjectsMissingSources,
  normalizeUrl,
} from "@/lib/services/sources";
import { disconnectTestDb, resetDatabase, testDb } from "../helpers/db";
import { makeProject } from "../helpers/factories";

beforeEach(resetDatabase);
afterAll(disconnectTestDb);

describe("normalizeUrl", () => {
  it("ignores trailing slashes and case", () => {
    expect(normalizeUrl("https://Example.com/Path/")).toBe("https://example.com/path");
  });

  it("strips tracking parameters so the same article is one source", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&id=7")).toBe(
      "https://example.com/a?id=7",
    );
  });

  it("drops the fragment", () => {
    expect(normalizeUrl("https://example.com/a#section-2")).toBe(
      "https://example.com/a",
    );
  });

  it("does not throw on a malformed URL", () => {
    expect(normalizeUrl("not a url/")).toBe("not a url");
  });
});

describe("createSource", () => {
  it("attaches a source to a project", async () => {
    const project = await makeProject({ name: "Source Host", sourceCount: 0 });

    const source = await createSource({
      projectId: project.id,
      title: "Company announcement",
      url: "https://example.com/announcement",
      sourceType: "COMPANY_ANNOUNCEMENT",
      publisher: "Example Corp",
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: 95,
      isPrimarySource: true,
      accessedAt: null,
      allowDuplicateUrl: false,
    });

    expect(source.projectId).toBe(project.id);
    // accessedAt defaults to now rather than being left null.
    expect(source.accessedAt).toBeInstanceOf(Date);
  });

  it("rejects an unknown project", async () => {
    await expect(
      createSource({
        projectId: "does-not-exist",
        title: "x",
        url: "https://example.com/x",
        sourceType: "NEWS_ARTICLE",
        publisher: null,
        publicationDate: null,
        excerpt: null,
        archivedUrl: null,
        reliabilityScore: null,
        isPrimarySource: false,
        accessedAt: null,
        allowDuplicateUrl: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("blocks a duplicate URL on the same project, ignoring trailing-slash differences", async () => {
    const project = await makeProject({ name: "Dup Host", sourceCount: 0 });
    const base = {
      projectId: project.id,
      title: "First",
      sourceType: "NEWS_ARTICLE" as const,
      publisher: null,
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: null,
      isPrimarySource: false,
      accessedAt: null,
      allowDuplicateUrl: false,
    };

    await createSource({ ...base, url: "https://example.com/story" });

    await expect(
      createSource({ ...base, title: "Second", url: "https://example.com/story/" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("permits the duplicate URL when explicitly overridden", async () => {
    const project = await makeProject({ name: "Override Host", sourceCount: 0 });
    const base = {
      projectId: project.id,
      title: "First",
      sourceType: "NEWS_ARTICLE" as const,
      publisher: null,
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: null,
      isPrimarySource: false,
      accessedAt: null,
      allowDuplicateUrl: false,
    };

    await createSource({ ...base, url: "https://example.com/story" });
    const second = await createSource({
      ...base,
      title: "Second",
      url: "https://example.com/story",
      allowDuplicateUrl: true,
    });

    expect(second.id).toBeTruthy();
  });

  it("allows the same URL on a different project", async () => {
    const a = await makeProject({ name: "Project A", sourceCount: 0 });
    const b = await makeProject({ name: "Project B", sourceCount: 0 });
    const base = {
      title: "Shared coverage",
      url: "https://example.com/shared",
      sourceType: "NEWS_ARTICLE" as const,
      publisher: null,
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: null,
      isPrimarySource: false,
      accessedAt: null,
      allowDuplicateUrl: false,
    };

    await createSource({ ...base, projectId: a.id });
    const second = await createSource({ ...base, projectId: b.id });
    expect(second.projectId).toBe(b.id);
  });
});

describe("createSourceWithClaims", () => {
  it("creates the source, the metrics, and cites every metric to that source", async () => {
    const project = await makeProject({ name: "Inbox Host", sourceCount: 0 });

    const result = await createSourceWithClaims({
      projectId: project.id,
      title: "Interconnection filing",
      url: "https://example.com/queue",
      sourceType: "UTILITY_FILING",
      publisher: "Utility",
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: 96,
      isPrimarySource: true,
      accessedAt: null,
      allowDuplicateUrl: false,
      claims: [
        {
          metricType: "POWER_MW",
          numericValue: 200,
          textValue: null,
          unit: "MW",
          confidenceLevel: "CONFIRMED",
          methodology: "Energised load.",
          effectiveDate: null,
        },
        {
          metricType: "LAND_ACRES",
          numericValue: 875,
          textValue: null,
          unit: "acres",
          confidenceLevel: "HIGH",
          methodology: null,
          effectiveDate: null,
        },
      ],
    });

    expect(result.claimCount).toBe(2);

    const metrics = await testDb.projectMetric.findMany({
      where: { projectId: project.id },
    });
    expect(metrics).toHaveLength(2);
    // The whole point of the inbox: a claim is never orphaned from its source.
    expect(metrics.every((m) => m.sourceId === result.source.id)).toBe(true);
  });

  it("writes a revision describing the source and claim count", async () => {
    const project = await makeProject({ name: "Revision Host", sourceCount: 0 });

    await createSourceWithClaims({
      projectId: project.id,
      title: "Company blog",
      url: "https://example.com/blog",
      sourceType: "COMPANY_ANNOUNCEMENT",
      publisher: null,
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: 90,
      isPrimarySource: true,
      accessedAt: null,
      allowDuplicateUrl: false,
      claims: [],
    });

    const revision = await testDb.projectRevision.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });
    expect(revision?.changeSummary).toContain("Company blog");
  });

  it("rolls the source back if a claim fails", async () => {
    const project = await makeProject({ name: "Rollback Host", sourceCount: 0 });

    await expect(
      createSourceWithClaims({
        projectId: project.id,
        title: "Bad claim source",
        url: "https://example.com/bad",
        sourceType: "NEWS_ARTICLE",
        publisher: null,
        publicationDate: null,
        excerpt: null,
        archivedUrl: null,
        reliabilityScore: 50,
        isPrimarySource: false,
        accessedAt: null,
        allowDuplicateUrl: false,
        claims: [
          {
            metricType: "POWER_MW",
            // Exceeds Decimal(20,4) precision, so the insert must fail.
            numericValue: 1e30,
            textValue: null,
            unit: "MW",
            confidenceLevel: "LOW",
            methodology: null,
            effectiveDate: null,
          },
        ],
      }),
    ).rejects.toThrow();

    // The transaction must leave no partial state behind.
    const sources = await testDb.source.count({ where: { projectId: project.id } });
    expect(sources).toBe(0);
  });
});

describe("deleteSource", () => {
  it("refuses to delete a source that metrics still cite", async () => {
    const project = await makeProject({ name: "Cited Host", sourceCount: 0 });
    const result = await createSourceWithClaims({
      projectId: project.id,
      title: "Cited source",
      url: "https://example.com/cited",
      sourceType: "SEC_FILING",
      publisher: null,
      publicationDate: null,
      excerpt: null,
      archivedUrl: null,
      reliabilityScore: 99,
      isPrimarySource: true,
      accessedAt: null,
      allowDuplicateUrl: false,
      claims: [
        {
          metricType: "CAPEX_USD",
          numericValue: 1_000_000,
          textValue: null,
          unit: "USD",
          confidenceLevel: "CONFIRMED",
          methodology: null,
          effectiveDate: null,
        },
      ],
    });

    await expect(deleteSource(result.source.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes an uncited source", async () => {
    const project = await makeProject({ name: "Uncited Host", sourceCount: 1 });
    const source = await testDb.source.findFirstOrThrow({
      where: { projectId: project.id },
    });

    await deleteSource(source.id);
    expect(await testDb.source.count({ where: { id: source.id } })).toBe(0);
  });
});

describe("listProjectsMissingSources", () => {
  it("returns only projects with no evidence at all", async () => {
    await makeProject({ name: "Has Evidence", sourceCount: 2 });
    await makeProject({ name: "No Evidence", sourceCount: 0 });
    await makeProject({
      name: "Cancelled No Evidence",
      sourceCount: 0,
      status: "CANCELLED",
    });

    const missing = await listProjectsMissingSources();
    expect(missing.map((p) => p.name)).toEqual(["No Evidence"]);
  });
});
