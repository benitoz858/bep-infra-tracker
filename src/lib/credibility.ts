import type { ConfidenceLevel, ProjectStatus, SourceType } from "@/generated/prisma/enums";

/**
 * Project credibility — an inspectable assessment, not a score.
 *
 * The temptation is a 0–100 number. It is the wrong output: it invents
 * precision the evidence cannot support, and it hides the one thing a reader
 * actually needs, which is *why*. So this produces a category plus the list of
 * components that produced it, and the UI is expected to render both. If a
 * reader disagrees with a component they can see exactly which one.
 *
 * Every component is derived from evidence already in the database. Nothing
 * here infers, models or guesses — a component that cannot be evaluated returns
 * `unknown` and says so, which is itself information: a project whose power
 * basis is unknown is less credible than one where it is stated, and the
 * assessment should show that rather than quietly scoring it as average.
 */

export type ComponentVerdict = "positive" | "neutral" | "negative" | "unknown";

export type CredibilityComponent = {
  key: string;
  label: string;
  verdict: ComponentVerdict;
  /** Plain-language finding, shown verbatim in the UI. */
  detail: string;
};

export type CredibilityState =
  | "CONFIRMED"
  | "HIGH_CONFIDENCE"
  | "MEDIUM_CONFIDENCE"
  | "EARLY_STAGE"
  | "SPECULATIVE"
  | "STALE"
  | "INSUFFICIENT_EVIDENCE";

export const CREDIBILITY_META: Record<
  CredibilityState,
  { label: string; tone: "operational" | "construction" | "risk" | "planned" | "inert"; description: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    tone: "operational",
    description: "A primary source states operating capacity at this site.",
  },
  HIGH_CONFIDENCE: {
    label: "High confidence",
    tone: "operational",
    description: "Physical work is under way and the evidence includes a primary source.",
  },
  MEDIUM_CONFIDENCE: {
    label: "Medium confidence",
    tone: "construction",
    description: "Corroborated by more than one source, but not yet backed by physical evidence.",
  },
  EARLY_STAGE: {
    label: "Early stage",
    tone: "planned",
    description: "Announced and sourced, but nothing beyond announcement is evidenced.",
  },
  SPECULATIVE: {
    label: "Speculative",
    tone: "inert",
    description: "Rumoured, MOU-stage, or resting on a single secondary report.",
  },
  STALE: {
    label: "Stale",
    tone: "risk",
    description: "Not re-verified recently enough to rely on without checking.",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient evidence",
    tone: "inert",
    description: "Too little sourced material to assess.",
  },
};

/** A source is primary when it comes from the party that would know. */
const PRIMARY_SOURCE_TYPES: SourceType[] = [
  "COMPANY_ANNOUNCEMENT",
  "SEC_FILING",
  "GOVERNMENT_FILING",
  "PERMIT",
  "UTILITY_FILING",
  "EARNINGS_CALL",
];

/** Beyond this, a record is old enough that a reader should re-check it. */
export const STALE_AFTER_DAYS = 120;

export type CredibilityInput = {
  status: ProjectStatus;
  lastVerifiedAt: Date | null;
  sources: { sourceType: SourceType; isPrimarySource: boolean }[];
  claims: { confidenceLevel: ConfidenceLevel }[];
  confirmedPowerMw: number | null;
  estimatedPowerMw: number | null;
  /** Free text recorded by the analyst; scanned only for explicit conflict flags. */
  analystNotes?: string | null;
};

export type CredibilityAssessment = {
  state: CredibilityState;
  components: CredibilityComponent[];
};

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function assessCredibility(
  input: CredibilityInput,
  now: Date = new Date(),
): CredibilityAssessment {
  const components: CredibilityComponent[] = [];

  // --- evidence volume -----------------------------------------------------
  const sourceCount = input.sources.length;
  components.push({
    key: "sources",
    label: "Independent sources",
    verdict: sourceCount === 0 ? "negative" : sourceCount >= 2 ? "positive" : "neutral",
    detail:
      sourceCount === 0
        ? "No sources recorded."
        : sourceCount === 1
          ? "Single source — not corroborated."
          : `${sourceCount} sources recorded.`,
  });

  // --- evidence quality ----------------------------------------------------
  const hasPrimary = input.sources.some(
    (s) => s.isPrimarySource || PRIMARY_SOURCE_TYPES.includes(s.sourceType),
  );
  components.push({
    key: "primary",
    label: "Primary source",
    verdict: hasPrimary ? "positive" : "negative",
    detail: hasPrimary
      ? "Includes an owner statement, filing or permit."
      : "Trade press or secondary reporting only.",
  });

  // --- physical progress ---------------------------------------------------
  const building = (
    ["UNDER_CONSTRUCTION", "PARTIALLY_OPERATIONAL", "OPERATIONAL"] as ProjectStatus[]
  ).includes(input.status);
  const speculativeStatus = (["RUMORED"] as ProjectStatus[]).includes(input.status);
  const halted = (["PAUSED", "CANCELLED"] as ProjectStatus[]).includes(input.status);
  components.push({
    key: "physical",
    label: "Physical progress",
    verdict: building ? "positive" : halted ? "negative" : speculativeStatus ? "negative" : "neutral",
    detail: building
      ? "Construction or operation is evidenced."
      : halted
        ? "Sponsor has paused or cancelled the project."
        : speculativeStatus
          ? "Not acknowledged by the owner."
          : "Announced or in planning; no construction evidence.",
  });

  // --- operating capacity --------------------------------------------------
  const hasConfirmedPower = input.confirmedPowerMw !== null;
  components.push({
    key: "operating-capacity",
    label: "Operating capacity",
    verdict: hasConfirmedPower ? "positive" : input.estimatedPowerMw !== null ? "neutral" : "unknown",
    detail: hasConfirmedPower
      ? "A source states capacity that is energized."
      : input.estimatedPowerMw !== null
        ? "Capacity figure is an announced target, not energized capacity."
        : "No capacity figure disclosed.",
  });

  // --- claim strength ------------------------------------------------------
  const strong = input.claims.filter(
    (c) => c.confidenceLevel === "CONFIRMED" || c.confidenceLevel === "HIGH",
  ).length;
  components.push({
    key: "claims",
    label: "Claim confidence",
    verdict:
      input.claims.length === 0 ? "unknown" : strong > 0 ? "positive" : "neutral",
    detail:
      input.claims.length === 0
        ? "No individual claims recorded."
        : `${strong} of ${input.claims.length} claims at HIGH or CONFIRMED.`,
  });

  // --- freshness -----------------------------------------------------------
  const age = input.lastVerifiedAt ? daysSince(input.lastVerifiedAt, now) : null;
  const stale = age === null || age > STALE_AFTER_DAYS;
  components.push({
    key: "freshness",
    label: "Verification freshness",
    verdict: age === null ? "unknown" : stale ? "negative" : "positive",
    detail:
      age === null
        ? "Never verified."
        : stale
          ? `Last verified ${age} days ago — past the ${STALE_AFTER_DAYS}-day threshold.`
          : `Verified ${age} day${age === 1 ? "" : "s"} ago.`,
  });

  // --- explicit contradiction ---------------------------------------------
  // Only an analyst's own flag counts. Inferring conflict from prose would
  // manufacture doubt the evidence does not support.
  const contradicted = /\bcontradict|\bconflict(ing|s)?\b|\bdisputed\b/i.test(
    input.analystNotes ?? "",
  );
  if (contradicted) {
    components.push({
      key: "contradiction",
      label: "Contradictory evidence",
      verdict: "negative",
      detail: "An analyst has flagged conflicting reporting on this project.",
    });
  }

  return { state: resolveState({ input, sourceCount, hasPrimary, building, speculativeStatus, halted, hasConfirmedPower, stale, contradicted }), components };
}

function resolveState(ctx: {
  input: CredibilityInput;
  sourceCount: number;
  hasPrimary: boolean;
  building: boolean;
  speculativeStatus: boolean;
  halted: boolean;
  hasConfirmedPower: boolean;
  stale: boolean;
  contradicted: boolean;
}): CredibilityState {
  if (ctx.sourceCount === 0) return "INSUFFICIENT_EVIDENCE";

  // Operating capacity from a party that would know is the strongest claim the
  // dataset can carry, and it outranks staleness: an energized hall does not
  // become less energized because nobody re-checked it this quarter.
  if (ctx.hasConfirmedPower && ctx.hasPrimary) return "CONFIRMED";

  if (ctx.contradicted) return "SPECULATIVE";
  if (ctx.speculativeStatus) return "SPECULATIVE";
  if (ctx.sourceCount === 1 && !ctx.hasPrimary) return "SPECULATIVE";

  // Staleness is only disqualifying for projects whose status implies motion.
  // A paused project that has not moved in six months is accurately described.
  if (ctx.stale && !ctx.halted) return "STALE";

  if (ctx.building && ctx.hasPrimary) return "HIGH_CONFIDENCE";
  if (ctx.building || (ctx.sourceCount >= 2 && ctx.hasPrimary)) return "MEDIUM_CONFIDENCE";
  if (ctx.sourceCount >= 2) return "MEDIUM_CONFIDENCE";
  return "EARLY_STAGE";
}

/**
 * Power readiness — a separate axis from credibility.
 *
 * A project can be entirely real and have no identified electricity. The
 * industry conflates announced megawatts with secured supply constantly, and
 * this keeps the two apart. Derived from the power basis recorded on the
 * project's claims and notes; deliberately conservative.
 */
export type PowerReadiness =
  | "CONFIRMED_OPERATING"
  | "BASIS_STATED"
  | "BASIS_UNCLEAR"
  | "NO_FIGURE_DISCLOSED";

export const POWER_READINESS_META: Record<
  PowerReadiness,
  { label: string; description: string }
> = {
  CONFIRMED_OPERATING: {
    label: "Operating capacity confirmed",
    description: "A source states capacity that is energized and serving load.",
  },
  BASIS_STATED: {
    label: "Capacity basis stated",
    description:
      "The source distinguishes IT load from total site power or on-site generation.",
  },
  BASIS_UNCLEAR: {
    label: "Capacity basis unclear",
    description:
      "A megawatt figure exists but the source does not say whether it is IT load, site power or generation.",
  },
  NO_FIGURE_DISCLOSED: {
    label: "No capacity disclosed",
    description: "No megawatt figure has been sourced for this project.",
  },
};

export function assessPowerReadiness(input: {
  confirmedPowerMw: number | null;
  estimatedPowerMw: number | null;
  /** Methodology text from the project's power claim, where one exists. */
  powerMethodology?: string | null;
}): PowerReadiness {
  if (input.confirmedPowerMw !== null) return "CONFIRMED_OPERATING";
  if (input.estimatedPowerMw === null) return "NO_FIGURE_DISCLOSED";
  const basis = input.powerMethodology ?? "";
  if (/basis:\s*(it load|site power|generation)/i.test(basis)) return "BASIS_STATED";
  return "BASIS_UNCLEAR";
}
