import type { ConfidenceLevel, ProjectStatus } from "@/generated/prisma/enums";

/**
 * Capacity accounting.
 *
 * One number for "how much AI datacenter capacity exists" is always wrong, and
 * the tracker's whole argument is that the wrongness is systematic: a press
 * release, a signed interconnection agreement and an energized hall are three
 * different facts that the industry reports as one. This module is the single
 * place that decides what counts toward what, so the dashboard, the analytics
 * page, the API and the exports cannot drift apart.
 *
 * Everything here is a pure function over plain rows. No Prisma, no formatting,
 * no React — so it is directly testable and callable from a script.
 */

export type CapacityRow = {
  status: ProjectStatus;
  estimatedPowerMw: number | null;
  confirmedPowerMw: number | null;
};

/**
 * Statuses whose capacity is not evidence of a buildout.
 *
 * CANCELLED is obvious. RUMORED and PAUSED are the interesting ones: both are
 * routinely counted in industry "announced pipeline" figures, and both describe
 * capacity that nobody has committed to building — an unacknowledged report and
 * a project its sponsor has stopped. Excluding them is the difference between a
 * pipeline number and a press-release number.
 */
export const NON_PIPELINE_STATUSES: ProjectStatus[] = ["CANCELLED", "RUMORED", "PAUSED"];

/** Ground is broken or power is flowing — capacity backed by physical work. */
export const BUILDING_STATUSES: ProjectStatus[] = [
  "UNDER_CONSTRUCTION",
  "PARTIALLY_OPERATIONAL",
  "OPERATIONAL",
];

/** Serving load today, in whole or in part. */
export const ENERGIZED_STATUSES: ProjectStatus[] = ["PARTIALLY_OPERATIONAL", "OPERATIONAL"];

/**
 * The best available figure for a project: a confirmed number where one exists,
 * otherwise the estimate. Null when neither exists — never 0, because a project
 * with no disclosed capacity is not a project with no capacity.
 */
export function bestPowerMw(row: CapacityRow): number | null {
  if (row.confirmedPowerMw !== null) return row.confirmedPowerMw;
  return row.estimatedPowerMw;
}

function sum(rows: CapacityRow[], pick: (r: CapacityRow) => number | null): number {
  return rows.reduce((total, r) => total + (pick(r) ?? 0), 0);
}

/**
 * Confidence weights for modelled capacity.
 *
 * These are judgement, not measurement, which is why they live in one exported
 * constant that the methodology page renders directly rather than being buried
 * in a query. Anyone who disagrees can see the number they disagree with.
 */
export const CONFIDENCE_WEIGHTS: Record<ConfidenceLevel, number> = {
  CONFIRMED: 1,
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.25,
  // An explicitly analyst-derived figure carries no independent corroboration,
  // so it is weighted at the floor rather than in the middle.
  ESTIMATED: 0.25,
};

export type CapacityViews = {
  /** Every non-cancelled project's best figure. The industry-standard number. */
  announcedMw: number;
  /** Announced, minus rumoured and paused capacity. */
  crediblePipelineMw: number;
  /** Projects with ground broken or power flowing. */
  underConstructionOrBeyondMw: number;
  /** Projects serving load, in whole or in part. */
  energizedProjectsMw: number;
  /** Only figures a source states as operating capacity. */
  confirmedMw: number;
  /** Capacity excluded from the credible pipeline, reported rather than hidden. */
  rumoredOrPausedMw: number;
  cancelledMw: number;
};

export function capacityViews(rows: CapacityRow[]): CapacityViews {
  const notCancelled = rows.filter((r) => r.status !== "CANCELLED");
  const credible = notCancelled.filter((r) => !NON_PIPELINE_STATUSES.includes(r.status));

  return {
    announcedMw: sum(notCancelled, bestPowerMw),
    crediblePipelineMw: sum(credible, bestPowerMw),
    underConstructionOrBeyondMw: sum(
      rows.filter((r) => BUILDING_STATUSES.includes(r.status)),
      bestPowerMw,
    ),
    energizedProjectsMw: sum(
      rows.filter((r) => ENERGIZED_STATUSES.includes(r.status)),
      bestPowerMw,
    ),
    confirmedMw: sum(
      rows.filter((r) => r.status !== "CANCELLED"),
      (r) => r.confirmedPowerMw,
    ),
    rumoredOrPausedMw: sum(
      rows.filter((r) => r.status === "RUMORED" || r.status === "PAUSED"),
      bestPowerMw,
    ),
    cancelledMw: sum(
      rows.filter((r) => r.status === "CANCELLED"),
      bestPowerMw,
    ),
  };
}

/**
 * Coverage: how much of the dataset a total actually rests on.
 *
 * A total over 103 projects where 28 have no disclosed capacity is not a total
 * over 103 projects, and saying so is the difference between a figure a reader
 * can calibrate and one that quietly understates. Every capacity headline in
 * the UI is expected to render one of these alongside it.
 */
export type Coverage = {
  withValue: number;
  total: number;
  /** 0–100, rounded. 0 when there are no rows, never NaN. */
  percent: number;
};

export function coverage(rows: CapacityRow[]): Coverage {
  const eligible = rows.filter((r) => r.status !== "CANCELLED");
  const withValue = eligible.filter((r) => bestPowerMw(r) !== null).length;
  return {
    withValue,
    total: eligible.length,
    percent: eligible.length === 0 ? 0 : Math.round((withValue / eligible.length) * 100),
  };
}

/**
 * Confidence-weighted capacity — an explicitly modelled figure, never a fact.
 *
 * Each project contributes its best power figure multiplied by the weight of
 * the confidence level attached to that figure. Callers must label the result
 * as modelled; `CONFIDENCE_WEIGHTS` is exported so the assumption travels with
 * the number.
 */
export function confidenceWeightedMw(
  rows: (CapacityRow & { confidence: ConfidenceLevel | null })[],
): number {
  return rows
    .filter((r) => !NON_PIPELINE_STATUSES.includes(r.status))
    .reduce((total, r) => {
      const mw = bestPowerMw(r);
      if (mw === null) return total;
      // No confidence assessment means no basis for weighting up: treat it as
      // the floor rather than silently assuming the figure is good.
      const weight = r.confidence ? CONFIDENCE_WEIGHTS[r.confidence] : CONFIDENCE_WEIGHTS.LOW;
      return total + mw * weight;
    }, 0);
}

/**
 * The pipeline funnel.
 *
 * Deliberately not a strict sequence: a project can be under construction while
 * its later phases are still permitting, and bitcoin-conversion sites often
 * have power before they have a tenant. Each stage counts projects that have
 * *reached at least* that stage, so the bars shrink monotonically and the drop
 * between two stages is the honest read — capacity that has not yet cleared the
 * next gate, not capacity that failed.
 */
export const FUNNEL_STAGES = [
  { key: "announced", label: "Announced or beyond", statuses: null },
  {
    key: "planning",
    label: "Planning or beyond",
    statuses: [
      "PLANNING",
      "PERMITTING",
      "UNDER_CONSTRUCTION",
      "PARTIALLY_OPERATIONAL",
      "OPERATIONAL",
      "DELAYED",
    ] as ProjectStatus[],
  },
  {
    key: "permitting",
    label: "Permitting or beyond",
    statuses: [
      "PERMITTING",
      "UNDER_CONSTRUCTION",
      "PARTIALLY_OPERATIONAL",
      "OPERATIONAL",
      "DELAYED",
    ] as ProjectStatus[],
  },
  {
    key: "building",
    label: "Under construction or beyond",
    statuses: ["UNDER_CONSTRUCTION", "PARTIALLY_OPERATIONAL", "OPERATIONAL"] as ProjectStatus[],
  },
  {
    key: "energized",
    label: "Partially or fully operational",
    statuses: ["PARTIALLY_OPERATIONAL", "OPERATIONAL"] as ProjectStatus[],
  },
  { key: "operational", label: "Fully operational", statuses: ["OPERATIONAL"] as ProjectStatus[] },
] as const;

export type FunnelStage = {
  key: string;
  label: string;
  projects: number;
  powerMw: number;
  /** Share of the credible pipeline's capacity, 0–100. */
  percentOfPipeline: number;
};

export function pipelineFunnel(rows: CapacityRow[]): FunnelStage[] {
  const credible = rows.filter((r) => !NON_PIPELINE_STATUSES.includes(r.status));
  const base = sum(credible, bestPowerMw);

  return FUNNEL_STAGES.map((stage) => {
    const matching = stage.statuses
      ? credible.filter((r) => (stage.statuses as ProjectStatus[]).includes(r.status))
      : credible;
    const powerMw = sum(matching, bestPowerMw);
    return {
      key: stage.key,
      label: stage.label,
      projects: matching.length,
      powerMw,
      percentOfPipeline: base === 0 ? 0 : Math.round((powerMw / base) * 100),
    };
  });
}
