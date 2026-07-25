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
    expect(normalizeName("The Denton AI Factory Project")).toBe("denton factory");
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
