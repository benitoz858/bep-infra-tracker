import type { IngestionOrigin, SourceType } from "@/generated/prisma/enums";

/**
 * Queue triage.
 *
 * With a few hundred pending candidates, strict chronology buries a 1 GW
 * groundbreaking under a week of feed noise. This module orders the queue by
 * how much a candidate is likely to change the database — and every input to
 * that ordering is shown to the reviewer as a plain-language reason. The
 * numeric rank is an ordering convenience and is never displayed: an opaque
 * "priority 73" would invent precision the heuristics cannot support, which is
 * the same sin the tracker exists to call out in capacity figures.
 *
 * Triage decides what you look at first, never what happens to it. An item
 * ranked last is still reviewed by a human or expired visibly — never silently
 * dropped.
 */

export type TriageInput = {
  origin: IngestionOrigin;
  sourceType: SourceType;
  matchScore: number | null;
  suggestedProjectName: string | null;
  proposedClaimCount: number;
  submitterNote: string | null;
  title: string;
  excerpt: string | null;
};

export type Triage = {
  /** Sort key within an origin tier. Internal — display the reasons instead. */
  rank: number;
  /** Why this item ranked where it did, in reviewer-readable form. */
  reasons: string[];
};

/** Source types whose publisher is a principal, not a reporter. */
const PRIMARY_TYPE_SOURCES: ReadonlySet<SourceType> = new Set([
  "COMPANY_ANNOUNCEMENT",
  "GOVERNMENT_FILING",
  "SEC_FILING",
  "PERMIT",
  "UTILITY_FILING",
] satisfies SourceType[]);

/**
 * Largest power figure mentioned in free text, normalised to MW.
 *
 * "1.2 GW", "300MW", "1,200 megawatts" all count. This reads marketing copy,
 * so the result is a triage signal only — it says the text talks about big
 * numbers, not that the numbers are true.
 */
export function largestPowerMentionMw(text: string): number | null {
  const pattern = /([\d,]+(?:\.\d+)?)\s*(gigawatts?|megawatts?|gw|mw)\b/gi;
  let max: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    const mw = /^g/i.test(match[2]) ? value * 1000 : value;
    if (max === null || mw > max) max = mw;
  }
  return max;
}

/** Largest dollar figure mentioned, normalised to billions. */
export function largestCapexMentionBn(text: string): number | null {
  const pattern = /\$\s*([\d,]+(?:\.\d+)?)\s*(billion|bn|b|million|mn|m)\b/gi;
  let max: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    const bn = /^b/i.test(match[2]) ? value : value / 1000;
    if (max === null || bn > max) max = bn;
  }
  return max;
}

function formatMw(mw: number): string {
  return mw >= 1000 ? `${(mw / 1000).toFixed(mw % 1000 === 0 ? 0 : 1)} GW` : `${mw} MW`;
}

export function triage(input: TriageInput): Triage {
  const text = `${input.title} ${input.excerpt ?? ""}`;
  let rank = 0;
  const reasons: string[] = [];

  const mw = largestPowerMentionMw(text);
  if (mw !== null && mw >= 1000) {
    rank += 40;
    reasons.push(`mentions ${formatMw(mw)}`);
  } else if (mw !== null && mw >= 100) {
    rank += 25;
    reasons.push(`mentions ${formatMw(mw)}`);
  } else if (mw !== null) {
    rank += 10;
    reasons.push(`mentions ${formatMw(mw)}`);
  }

  const bn = largestCapexMentionBn(text);
  if (bn !== null && bn >= 1) {
    rank += bn >= 10 ? 25 : 15;
    reasons.push(`mentions $${bn >= 10 ? Math.round(bn) : bn}B`);
  }

  if (PRIMARY_TYPE_SOURCES.has(input.sourceType)) {
    rank += 20;
    reasons.push("primary-type source");
  }

  if (input.suggestedProjectName && (input.matchScore ?? 0) >= 40) {
    rank += 15;
    reasons.push(`likely about ${input.suggestedProjectName}`);
  }

  if (input.proposedClaimCount > 0) {
    rank += 10;
    reasons.push(
      input.proposedClaimCount === 1
        ? "1 extracted claim"
        : `${input.proposedClaimCount} extracted claims`,
    );
  }

  if (input.submitterNote && input.submitterNote.trim().length > 0) {
    rank += 10;
    reasons.push("submitter explained why");
  }

  return { rank, reasons };
}
