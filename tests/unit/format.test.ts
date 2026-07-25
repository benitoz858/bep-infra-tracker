import { describe, expect, it } from "vitest";

import {
  NOT_DISCLOSED,
  formatCount,
  formatLocation,
  formatMw,
  formatPowerScaled,
  formatUsdCompact,
  slugify,
  toNumber,
} from "@/lib/format";

/**
 * These tests exist to protect one specific data-quality rule: unknown is not
 * zero. It is the rule most easily broken by a well-meaning `|| 0`, and breaking
 * it silently understates every total in the product.
 */
describe("unknown is never rendered as zero", () => {
  it("renders null as 'Not disclosed' and zero as a real zero", () => {
    expect(formatMw(null)).toBe(NOT_DISCLOSED);
    expect(formatMw(undefined)).toBe(NOT_DISCLOSED);
    expect(formatMw(0)).toBe("0 MW");

    expect(formatCount(null)).toBe(NOT_DISCLOSED);
    expect(formatCount(0)).toBe("0");

    expect(formatUsdCompact(null)).toBe(NOT_DISCLOSED);
    expect(formatUsdCompact(0)).toBe("$0");
  });

  it("treats an empty string as unknown, not as zero", () => {
    // CSV cells and cleared form inputs both arrive as "".
    expect(toNumber("")).toBeNull();
    expect(formatMw("")).toBe(NOT_DISCLOSED);
  });

  it("keeps zero distinguishable from null through toNumber", () => {
    expect(toNumber(0)).toBe(0);
    expect(toNumber("0")).toBe(0);
    expect(toNumber(null)).toBeNull();
  });

  it("rejects non-numeric junk rather than coercing it to zero", () => {
    expect(toNumber("not a number")).toBeNull();
    expect(formatCount("abc")).toBe(NOT_DISCLOSED);
  });
});

describe("Prisma Decimal handling", () => {
  it("accepts a Decimal-like object via toString", () => {
    const decimalLike = { toString: () => "1234.5" };
    expect(toNumber(decimalLike)).toBe(1234.5);
    expect(formatMw(decimalLike)).toBe("1,234.5 MW");
  });

  it("does not lose precision reading a large capex string", () => {
    expect(toNumber("7400000000")).toBe(7_400_000_000);
    expect(formatUsdCompact("7400000000")).toBe("$7.4B");
  });
});

describe("formatPowerScaled", () => {
  it("stays in MW below 1 GW and rolls over above it", () => {
    expect(formatPowerScaled(450)).toBe("450 MW");
    expect(formatPowerScaled(999)).toBe("999 MW");
    expect(formatPowerScaled(1000)).toBe("1 GW");
    expect(formatPowerScaled(2110)).toBe("2.1 GW");
  });
});

describe("formatUsdCompact", () => {
  it("abbreviates by magnitude", () => {
    expect(formatUsdCompact(340_000_000)).toBe("$340M");
    expect(formatUsdCompact(1_200_000_000)).toBe("$1.2B");
    expect(formatUsdCompact(500_000_000_000)).toBe("$500B");
  });

  it("shows one decimal only when the mantissa is below 10", () => {
    // $7.4B carries information; $13K vs $12.5K does not, and the extra digit
    // makes a dense table noisier.
    expect(formatUsdCompact(7_400_000_000)).toBe("$7.4B");
    expect(formatUsdCompact(12_500)).toBe("$13K");
  });

  it("keeps the sign on negatives", () => {
    expect(formatUsdCompact(-1_200_000_000)).toBe("-$1.2B");
  });
});

describe("formatLocation", () => {
  it("omits missing parts without leaving stray commas", () => {
    expect(
      formatLocation({
        city: "Ashburn",
        stateRegion: "Virginia",
        country: "United States",
      }),
    ).toBe("Ashburn, Virginia, United States");
    expect(formatLocation({ city: null, stateRegion: null, country: "Iceland" })).toBe(
      "Iceland",
    );
  });

  it("falls back to Not disclosed when nothing is known", () => {
    expect(formatLocation({})).toBe(NOT_DISCLOSED);
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Mount Pleasant AI Campus Phase 2")).toBe(
      "mount-pleasant-ai-campus-phase-2",
    );
  });

  it("strips accents rather than dropping the characters", () => {
    expect(slugify("Querétaro Inference Region")).toBe("queretaro-inference-region");
  });
});
