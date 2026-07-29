import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_WEIGHTS,
  bestPowerMw,
  capacityViews,
  confidenceWeightedMw,
  coverage,
  pipelineFunnel,
} from "@/lib/capacity";
import type { CapacityRow } from "@/lib/capacity";

function row(
  status: CapacityRow["status"],
  estimated: number | null,
  confirmed: number | null = null,
): CapacityRow {
  return { status, estimatedPowerMw: estimated, confirmedPowerMw: confirmed };
}

describe("bestPowerMw", () => {
  it("prefers a confirmed figure over an estimate", () => {
    expect(bestPowerMw(row("OPERATIONAL", 1200, 300))).toBe(300);
  });

  it("falls back to the estimate when nothing is confirmed", () => {
    expect(bestPowerMw(row("ANNOUNCED", 1200))).toBe(1200);
  });

  it("returns null, never 0, when no figure is disclosed", () => {
    expect(bestPowerMw(row("ANNOUNCED", null))).toBeNull();
  });

  it("preserves a genuine confirmed zero", () => {
    // A site confirmed to draw no power is a real, different claim from one
    // nobody has sourced. Truthiness checks would collapse the two.
    expect(bestPowerMw(row("OPERATIONAL", 500, 0))).toBe(0);
  });
});

describe("capacityViews", () => {
  const rows: CapacityRow[] = [
    row("OPERATIONAL", 400, 300),
    row("UNDER_CONSTRUCTION", 1000),
    row("PARTIALLY_OPERATIONAL", 800, 133),
    row("ANNOUNCED", 2000),
    row("RUMORED", 500),
    row("PAUSED", 100),
    row("CANCELLED", 9000),
    row("ANNOUNCED", null),
  ];

  const views = capacityViews(rows);

  it("excludes cancelled capacity from the announced total", () => {
    // 300 + 1000 + 133 + 2000 + 500 + 100
    expect(views.announcedMw).toBe(4033);
    expect(views.cancelledMw).toBe(9000);
  });

  it("excludes rumoured and paused capacity from the credible pipeline", () => {
    expect(views.crediblePipelineMw).toBe(3433);
    expect(views.rumoredOrPausedMw).toBe(600);
    // The whole point of the split: the two differ by exactly the excluded set.
    expect(views.announcedMw - views.crediblePipelineMw).toBe(views.rumoredOrPausedMw);
  });

  it("counts only physically progressed capacity as under construction or beyond", () => {
    expect(views.underConstructionOrBeyondMw).toBe(1433);
  });

  it("counts only energized projects' capacity as energized", () => {
    expect(views.energizedProjectsMw).toBe(433);
  });

  it("counts only confirmed figures as confirmed, never estimates", () => {
    expect(views.confirmedMw).toBe(433);
  });

  it("returns zeroes rather than NaN for an empty dataset", () => {
    const empty = capacityViews([]);
    expect(empty.announcedMw).toBe(0);
    expect(empty.crediblePipelineMw).toBe(0);
  });
});

describe("coverage", () => {
  it("reports how many projects a total actually rests on", () => {
    const c = coverage([
      row("ANNOUNCED", 100),
      row("ANNOUNCED", null),
      row("UNDER_CONSTRUCTION", 200),
      row("ANNOUNCED", null),
    ]);
    expect(c).toEqual({ withValue: 2, total: 4, percent: 50 });
  });

  it("ignores cancelled projects, which no total includes", () => {
    const c = coverage([row("ANNOUNCED", 100), row("CANCELLED", null)]);
    expect(c).toEqual({ withValue: 1, total: 1, percent: 100 });
  });

  it("returns 0 percent rather than NaN when there is nothing to cover", () => {
    expect(coverage([]).percent).toBe(0);
  });
});

describe("confidenceWeightedMw", () => {
  it("weights each project by the confidence of its figure", () => {
    const total = confidenceWeightedMw([
      { ...row("OPERATIONAL", null, 100), confidence: "CONFIRMED" },
      { ...row("UNDER_CONSTRUCTION", 100), confidence: "HIGH" },
      { ...row("ANNOUNCED", 100), confidence: "MEDIUM" },
      { ...row("ANNOUNCED", 100), confidence: "LOW" },
    ]);
    expect(total).toBe(100 + 80 + 50 + 25);
  });

  it("treats an unassessed figure as the floor rather than assuming it is good", () => {
    const total = confidenceWeightedMw([
      { ...row("ANNOUNCED", 100), confidence: null },
    ]);
    expect(total).toBe(100 * CONFIDENCE_WEIGHTS.LOW);
  });

  it("never weights rumoured, paused or cancelled capacity in", () => {
    const total = confidenceWeightedMw([
      { ...row("RUMORED", 1000), confidence: "HIGH" },
      { ...row("PAUSED", 1000), confidence: "HIGH" },
      { ...row("CANCELLED", 1000), confidence: "CONFIRMED" },
    ]);
    expect(total).toBe(0);
  });

  it("never exceeds the credible pipeline it is derived from", () => {
    const rows = [
      { ...row("UNDER_CONSTRUCTION", 500), confidence: "HIGH" as const },
      { ...row("ANNOUNCED", 900), confidence: "MEDIUM" as const },
    ];
    expect(confidenceWeightedMw(rows)).toBeLessThanOrEqual(capacityViews(rows).crediblePipelineMw);
  });
});

describe("pipelineFunnel", () => {
  const rows: CapacityRow[] = [
    row("ANNOUNCED", 1000),
    row("PERMITTING", 500),
    row("UNDER_CONSTRUCTION", 300),
    row("OPERATIONAL", 100),
    row("RUMORED", 700),
  ];
  const stages = pipelineFunnel(rows);

  it("shrinks monotonically, because each stage means 'reached at least here'", () => {
    for (let i = 1; i < stages.length; i += 1) {
      expect(stages[i].powerMw).toBeLessThanOrEqual(stages[i - 1].powerMw);
    }
  });

  it("excludes non-pipeline statuses from the base", () => {
    expect(stages[0].powerMw).toBe(1900);
    expect(stages[0].percentOfPipeline).toBe(100);
  });

  it("counts a project at every stage it has passed", () => {
    const building = stages.find((s) => s.key === "building")!;
    expect(building.powerMw).toBe(400);
    expect(building.projects).toBe(2);

    const operational = stages.find((s) => s.key === "operational")!;
    expect(operational.powerMw).toBe(100);
  });

  it("does not divide by zero on an empty pipeline", () => {
    expect(pipelineFunnel([]).every((s) => s.percentOfPipeline === 0)).toBe(true);
  });
});
