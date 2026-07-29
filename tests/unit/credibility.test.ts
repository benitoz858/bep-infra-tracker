import { describe, expect, it } from "vitest";

import {
  STALE_AFTER_DAYS,
  assessCredibility,
  assessPowerReadiness,
  powerBasisFrom,
} from "@/lib/credibility";
import type { CredibilityInput } from "@/lib/credibility";

const NOW = new Date("2026-07-28T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function input(overrides: Partial<CredibilityInput> = {}): CredibilityInput {
  return {
    status: "ANNOUNCED",
    lastVerifiedAt: daysAgo(5),
    sources: [{ sourceType: "NEWS_ARTICLE", isPrimarySource: false }],
    claims: [],
    confirmedPowerMw: null,
    estimatedPowerMw: 500,
    analystNotes: null,
    ...overrides,
  };
}

describe("assessCredibility", () => {
  it("always explains itself — every assessment carries its components", () => {
    const { components } = assessCredibility(input(), NOW);
    expect(components.length).toBeGreaterThanOrEqual(6);
    for (const c of components) {
      expect(c.detail.length).toBeGreaterThan(0);
      expect(["positive", "neutral", "negative", "unknown"]).toContain(c.verdict);
    }
  });

  it("returns INSUFFICIENT_EVIDENCE when nothing is sourced", () => {
    const { state } = assessCredibility(input({ sources: [] }), NOW);
    expect(state).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("returns CONFIRMED only for operating capacity from a primary source", () => {
    const { state } = assessCredibility(
      input({
        status: "OPERATIONAL",
        confirmedPowerMw: 300,
        sources: [{ sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true }],
      }),
      NOW,
    );
    expect(state).toBe("CONFIRMED");
  });

  it("does not return CONFIRMED for operating capacity sourced only to trade press", () => {
    const { state } = assessCredibility(
      input({
        status: "OPERATIONAL",
        confirmedPowerMw: 300,
        sources: [{ sourceType: "NEWS_ARTICLE", isPrimarySource: false }],
      }),
      NOW,
    );
    expect(state).not.toBe("CONFIRMED");
  });

  it("treats a single secondary source as speculative however large the project", () => {
    const { state } = assessCredibility(input({ estimatedPowerMw: 5000 }), NOW);
    expect(state).toBe("SPECULATIVE");
  });

  it("treats a rumoured project as speculative even when well sourced", () => {
    const { state } = assessCredibility(
      input({
        status: "RUMORED",
        sources: [
          { sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true },
          { sourceType: "NEWS_ARTICLE", isPrimarySource: false },
        ],
      }),
      NOW,
    );
    expect(state).toBe("SPECULATIVE");
  });

  it("rates construction backed by a primary source as high confidence", () => {
    const { state } = assessCredibility(
      input({
        status: "UNDER_CONSTRUCTION",
        sources: [
          { sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true },
          { sourceType: "NEWS_ARTICLE", isPrimarySource: false },
        ],
      }),
      NOW,
    );
    expect(state).toBe("HIGH_CONFIDENCE");
  });

  it("flags a project nobody has re-checked as stale", () => {
    const { state } = assessCredibility(
      input({
        status: "UNDER_CONSTRUCTION",
        lastVerifiedAt: daysAgo(STALE_AFTER_DAYS + 1),
        sources: [{ sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true }],
      }),
      NOW,
    );
    expect(state).toBe("STALE");
  });

  it("does not call a paused project stale — 'not moving' is the accurate description", () => {
    const { state } = assessCredibility(
      input({
        status: "PAUSED",
        lastVerifiedAt: daysAgo(STALE_AFTER_DAYS + 30),
        sources: [
          { sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true },
          { sourceType: "NEWS_ARTICLE", isPrimarySource: false },
        ],
      }),
      NOW,
    );
    expect(state).not.toBe("STALE");
  });

  it("does not let staleness override confirmed operating capacity", () => {
    const { state } = assessCredibility(
      input({
        status: "OPERATIONAL",
        confirmedPowerMw: 300,
        lastVerifiedAt: daysAgo(STALE_AFTER_DAYS + 200),
        sources: [{ sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true }],
      }),
      NOW,
    );
    expect(state).toBe("CONFIRMED");
  });

  it("downgrades a project an analyst has flagged as contradicted", () => {
    const { state, components } = assessCredibility(
      input({
        status: "UNDER_CONSTRUCTION",
        sources: [
          { sourceType: "COMPANY_ANNOUNCEMENT", isPrimarySource: true },
          { sourceType: "NEWS_ARTICLE", isPrimarySource: false },
        ],
        analystNotes: "Reporting on capacity is contradictory; owner has not confirmed.",
      }),
      NOW,
    );
    expect(state).toBe("SPECULATIVE");
    expect(components.some((c) => c.key === "contradiction")).toBe(true);
  });

  it("does not manufacture a contradiction from ordinary notes", () => {
    const { components } = assessCredibility(
      input({ analystNotes: "Capacity is an announced target, basis unstated." }),
      NOW,
    );
    expect(components.some((c) => c.key === "contradiction")).toBe(false);
  });

  it("marks an unknowable component 'unknown' rather than guessing", () => {
    const { components } = assessCredibility(
      input({ lastVerifiedAt: null, estimatedPowerMw: null, claims: [] }),
      NOW,
    );
    const freshness = components.find((c) => c.key === "freshness")!;
    const capacity = components.find((c) => c.key === "operating-capacity")!;
    expect(freshness.verdict).toBe("unknown");
    expect(capacity.verdict).toBe("unknown");
  });
});

describe("assessPowerReadiness", () => {
  it("recognises confirmed operating capacity", () => {
    expect(assessPowerReadiness({ confirmedPowerMw: 300, estimatedPowerMw: null })).toBe(
      "CONFIRMED_OPERATING",
    );
  });

  it("recognises a stated basis when the source distinguished IT load from site power", () => {
    expect(
      assessPowerReadiness({
        confirmedPowerMw: null,
        estimatedPowerMw: 902,
        powerMethodology: "Basis: IT load. Announced target, not energized capacity.",
      }),
    ).toBe("BASIS_STATED");
  });

  it("says the basis is unclear rather than assuming IT load", () => {
    expect(
      assessPowerReadiness({
        confirmedPowerMw: null,
        estimatedPowerMw: 1000,
        powerMethodology: "Basis: unclear. Announced target.",
      }),
    ).toBe("BASIS_UNCLEAR");
  });

  it("distinguishes no disclosed figure from a figure of zero megawatts", () => {
    expect(assessPowerReadiness({ confirmedPowerMw: null, estimatedPowerMw: null })).toBe(
      "NO_FIGURE_DISCLOSED",
    );
    expect(assessPowerReadiness({ confirmedPowerMw: 0, estimatedPowerMw: null })).toBe(
      "CONFIRMED_OPERATING",
    );
  });
});

describe("powerBasisFrom", () => {
  it("reads the basis the researcher recorded", () => {
    expect(powerBasisFrom("Basis: IT load. Announced target.")).toBe("IT_LOAD");
    expect(powerBasisFrom("Basis: site power. Approved supply plan.")).toBe("SITE_POWER");
    expect(powerBasisFrom("Basis: generation. On-site turbines.")).toBe("GENERATION");
  });

  it("says unclear rather than assuming when the source did not distinguish", () => {
    expect(powerBasisFrom("Basis: unclear. Announced target.")).toBe("UNCLEAR");
    expect(powerBasisFrom("Some other methodology text")).toBe("UNCLEAR");
  });

  it("distinguishes no methodology at all from an unclear one", () => {
    expect(powerBasisFrom(null)).toBe("NONE");
    expect(powerBasisFrom("")).toBe("NONE");
  });
});
