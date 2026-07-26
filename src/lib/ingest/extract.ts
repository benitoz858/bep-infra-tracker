import type { ClaimExtractor, ProposedClaim, WatchedItem } from "@/lib/ingest/types";

/**
 * Claim extraction.
 *
 * The heuristic extractor is deliberately conservative and deliberately dumb:
 * it only proposes a claim when a number sits next to an unambiguous unit in
 * the source text, and it always quotes the sentence it took the number from so
 * a reviewer can reject it in one glance. It cannot infer, and it must not — a
 * plausible-looking invented figure is worse for this product than no figure.
 *
 * Every claim it produces is capped at LOW/ESTIMATED. Promotion to CONFIRMED is
 * a human act, enforced in lib/services/ingestion.ts.
 */

/** Sentence containing a match, for the methodology note. */
function sentenceAround(text: string, index: number): string {
  const start = text.lastIndexOf(".", index) + 1;
  const end = text.indexOf(".", index);
  return text
    .slice(start, end === -1 ? Math.min(text.length, index + 200) : end + 1)
    .trim()
    .slice(0, 300);
}

/** "1.2 GW" → 1200 MW; "450 megawatts" → 450. */
function toMw(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("gw") || u.startsWith("gigawatt")) return value * 1000;
  if (u.startsWith("kw") || u.startsWith("kilowatt")) return value / 1000;
  return value;
}

/** "$1.2 billion" → 1_200_000_000. */
function toUsd(value: number, scale: string | undefined): number {
  const s = (scale ?? "").toLowerCase();
  if (s.startsWith("t")) return value * 1e12;
  if (s.startsWith("b")) return value * 1e9;
  if (s.startsWith("m")) return value * 1e6;
  if (s.startsWith("k")) return value * 1e3;
  return value;
}

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;

export const heuristicExtractor: ClaimExtractor = {
  key: "heuristic",

  async extract(item: WatchedItem): Promise<ProposedClaim[]> {
    const text = `${item.title}. ${item.text ?? ""}`;
    const claims: ProposedClaim[] = [];
    const seen = new Set<string>();

    const push = (claim: ProposedClaim, dedupeKey: string) => {
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      claims.push(claim);
    };

    // --- Power ---------------------------------------------------------
    const powerRe = new RegExp(
      `${NUM}\\s*(gigawatts?|megawatts?|kilowatts?|GW|MW|kW)\\b`,
      "gi",
    );
    for (const m of text.matchAll(powerRe)) {
      const raw = Number(m[1]!.replace(/,/g, ""));
      if (!Number.isFinite(raw)) continue;
      const mw = toMw(raw, m[2]!);
      // A datacentre below 1 MW or above 100 GW is almost certainly a
      // misparse (a percentage, a year, an unrelated figure).
      if (mw < 1 || mw > 100_000) continue;

      push(
        {
          metricType: "POWER_MW",
          numericValue: mw,
          textValue: null,
          unit: "MW",
          confidenceLevel: "LOW",
          methodology: `Auto-extracted from source text: "${sentenceAround(text, m.index)}" — unverified, confirm against the source before use.`,
        },
        `POWER_MW:${mw}`,
      );
    }

    // --- Accelerators ---------------------------------------------------
    const gpuRe = new RegExp(
      `${NUM}\\s*(?:thousand\\s*)?(?:NVIDIA\\s+|AMD\\s+)?(GPUs?|accelerators?|chips?)\\b`,
      "gi",
    );
    for (const m of text.matchAll(gpuRe)) {
      let raw = Number(m[1]!.replace(/,/g, ""));
      if (!Number.isFinite(raw)) continue;
      if (/thousand/i.test(m[0])) raw *= 1000;
      if (raw < 100 || raw > 50_000_000) continue;

      push(
        {
          metricType: "GPU_COUNT",
          numericValue: raw,
          textValue: null,
          unit: "GPUs",
          confidenceLevel: "LOW",
          methodology: `Auto-extracted from source text: "${sentenceAround(text, m.index)}" — unverified, confirm against the source before use.`,
        },
        `GPU_COUNT:${raw}`,
      );
    }

    // --- Capex ----------------------------------------------------------
    const capexRe = new RegExp(
      `\\$\\s*${NUM}\\s*(trillion|billion|million|thousand|[tbmk])?\\b`,
      "gi",
    );
    for (const m of text.matchAll(capexRe)) {
      const raw = Number(m[1]!.replace(/,/g, ""));
      if (!Number.isFinite(raw)) continue;
      const usd = toUsd(raw, m[2]);
      // Below $1m is not a capex figure worth tracking at this granularity.
      if (usd < 1e6 || usd > 1e12) continue;

      push(
        {
          metricType: "CAPEX_USD",
          numericValue: usd,
          textValue: null,
          unit: "USD",
          confidenceLevel: "LOW",
          methodology: `Auto-extracted from source text: "${sentenceAround(text, m.index)}" — unverified, confirm against the source before use.`,
        },
        `CAPEX_USD:${usd}`,
      );
    }

    // Cap the output. A filing that says "megawatt" thirty times should not
    // produce thirty claims for a human to wade through.
    return claims.slice(0, 6);
  },
};

/** Used when extraction is disabled: the item is still staged for review. */
export const noopExtractor: ClaimExtractor = {
  key: "none",
  async extract() {
    return [];
  },
};

/**
 * Seam for an LLM extractor.
 *
 * Not implemented here on purpose. A model reading the full article would
 * extract far better claims than the regexes above, but it needs an API key and
 * a spend decision, and — more importantly — it needs its own evaluation before
 * anything it says is allowed near the review queue. When it lands it must
 * still return LOW/ESTIMATED and still be staged, exactly like the heuristic.
 */
export function getExtractor(key: string | undefined): ClaimExtractor {
  switch (key) {
    case "heuristic":
      return heuristicExtractor;
    case "none":
    case undefined:
      return noopExtractor;
    default:
      throw new Error(
        `Unknown extractor "${key}". Available: heuristic, none.`,
      );
  }
}
