import { describe, expect, it } from "vitest";

import { normalizeName, normalizePlace } from "@/lib/services/duplicates";

describe("normalizeName", () => {
  it("collapses the real-world variants of one campus name to the same key", () => {
    const variants = [
      "Mount Pleasant AI Campus Phase 2",
      "Mt. Pleasant AI campus (phase 2)",
      "MOUNT PLEASANT PHASE II",
      "Mount Pleasant Data Center Campus — Phase Two",
    ];
    const keys = variants.map(normalizeName);
    // Every variant should reduce to the same tokens, in the same order.
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("mount pleasant phase2");
  });

  it("keeps genuinely different phases distinct", () => {
    expect(normalizeName("Stargate Site 1 Phase 1")).not.toBe(
      normalizeName("Stargate Site 1 Phase 2"),
    );
  });

  it("keeps different sites distinct", () => {
    expect(normalizeName("Abilene Stargate")).not.toBe(
      normalizeName("Memphis Colossus"),
    );
  });

  it("strips domain noise words that carry no information", () => {
    // "factory" was added to the noise list after agent ingestion matched every
    // "AI Factories" headline to the seeded "Denton AI Factory". Like "campus"
    // and "facility" before it, the word describes the category, not the asset.
    //
    // The tradeoff is accepted deliberately: "Denton AI Factory" and "Denton
    // Data Center" now normalise alike, so duplicate detection will flag them
    // as possible matches. That is the safer error — detection is advisory and
    // the analyst can dismiss it, whereas a missed duplicate silently splits
    // one campus across two records and double-counts its megawatts.
    expect(normalizeName("The Denton AI Factory Project")).toBe("denton");
  });

  it("normalises accents so the same place matches", () => {
    expect(normalizeName("Querétaro Inference Region")).toBe(
      normalizeName("Queretaro inference"),
    );
  });
});

describe("normalizePlace", () => {
  it("is case- and punctuation-insensitive", () => {
    expect(normalizePlace("Mount Pleasant")).toBe(normalizePlace("mount  pleasant"));
    expect(normalizePlace("St. Louis")).toBe("st louis");
  });

  it("returns an empty string for a missing place", () => {
    expect(normalizePlace(null)).toBe("");
    expect(normalizePlace(undefined)).toBe("");
  });
});
