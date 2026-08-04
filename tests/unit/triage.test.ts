import { describe, expect, it } from "vitest";

import {
  largestCapexMentionBn,
  largestPowerMentionMw,
  triage,
} from "@/lib/ingest/triage";
import type { TriageInput } from "@/lib/ingest/triage";

function input(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    origin: "WATCHER",
    sourceType: "NEWS_ARTICLE",
    matchScore: null,
    suggestedProjectName: null,
    proposedClaimCount: 0,
    submitterNote: null,
    title: "A data center article",
    excerpt: null,
    ...overrides,
  };
}

describe("largestPowerMentionMw", () => {
  it("reads MW and GW mentions and normalises to MW", () => {
    expect(largestPowerMentionMw("a 300 MW campus")).toBe(300);
    expect(largestPowerMentionMw("a 1.2 GW campus")).toBe(1200);
    expect(largestPowerMentionMw("scaling to 2 gigawatts")).toBe(2000);
    expect(largestPowerMentionMw("about 45 megawatts of IT load")).toBe(45);
  });

  it("takes the largest figure when several are mentioned", () => {
    expect(largestPowerMentionMw("from 55 megawatts to 200 megawatts by 2028")).toBe(200);
  });

  it("handles thousands separators and glued units", () => {
    expect(largestPowerMentionMw("1,200 MW substation")).toBe(1200);
    expect(largestPowerMentionMw("a 300MW facility")).toBe(300);
  });

  it("returns null when no power figure is mentioned", () => {
    expect(largestPowerMentionMw("county approves zoning change")).toBeNull();
  });

  it("does not read 'GWh' or stray letters as capacity", () => {
    // 500 GWh would be energy, not capacity — the unit boundary must hold.
    expect(largestPowerMentionMw("consumed 500 GWh last year")).toBeNull();
  });
});

describe("largestCapexMentionBn", () => {
  it("reads billion and million dollar figures, normalised to billions", () => {
    expect(largestCapexMentionBn("a $14 billion deal")).toBe(14);
    expect(largestCapexMentionBn("a $500 million expansion")).toBe(0.5);
    expect(largestCapexMentionBn("$2.5bn investment")).toBe(2.5);
  });

  it("returns null when no dollar figure is mentioned", () => {
    expect(largestCapexMentionBn("300 MW and 5,000 jobs")).toBeNull();
  });
});

describe("triage", () => {
  it("explains every point of rank with a reason", () => {
    const result = triage(
      input({
        title: "Company announces 1.1 GW campus in a $14 billion deal",
        sourceType: "COMPANY_ANNOUNCEMENT",
        matchScore: 60,
        suggestedProjectName: "Some Campus",
        proposedClaimCount: 2,
      }),
    );
    expect(result.rank).toBeGreaterThan(0);
    expect(result.reasons).toContain("mentions 1.1 GW");
    expect(result.reasons).toContain("mentions $14B");
    expect(result.reasons).toContain("primary-type source");
    expect(result.reasons).toContain("likely about Some Campus");
    expect(result.reasons).toContain("2 extracted claims");
  });

  it("ranks a gigawatt announcement above generic feed noise", () => {
    const big = triage(input({ title: "Utility approves 2 GW interconnection" }));
    const noise = triage(input({ title: "Five trends shaping the cloud in 2026" }));
    expect(big.rank).toBeGreaterThan(noise.rank);
  });

  it("gives an unmatched, figure-free item rank zero and no reasons", () => {
    const result = triage(input());
    expect(result.rank).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("does not credit a project match below the confidence floor", () => {
    const result = triage(
      input({ matchScore: 20, suggestedProjectName: "Wrong Project" }),
    );
    expect(result.reasons).not.toContain("likely about Wrong Project");
  });

  it("credits a submitter who explained their reasoning", () => {
    const result = triage(input({ submitterNote: "This confirms energization." }));
    expect(result.reasons).toContain("submitter explained why");
  });
});
