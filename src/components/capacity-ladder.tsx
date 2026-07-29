import Link from "next/link";

import { formatCount, formatPowerScaled } from "@/lib/format";
import type { CapacityViews, Coverage } from "@/lib/capacity";
import { cn } from "@/lib/utils";

/**
 * The capacity ladder.
 *
 * The product's central claim is that one megawatt figure is always misleading,
 * so the front door shows the ladder instead: each rung narrows the definition,
 * and the drop between rungs is the finding. Every rung states what it counts —
 * a number whose definition is in a tooltip is a number that will be misquoted.
 */

type Rung = {
  label: string;
  mw: number;
  meaning: string;
  tone: "cyan" | "amber" | "green" | "dim";
  href?: string;
};

const TONE: Record<Rung["tone"], string> = {
  cyan: "text-cyan",
  amber: "text-amber",
  green: "text-green",
  dim: "text-fg-dim",
};

export function CapacityLadder({
  views,
  coverage,
  confidenceWeightedMw,
}: {
  views: CapacityViews;
  coverage: Coverage;
  confidenceWeightedMw: number;
}) {
  const rungs: Rung[] = [
    {
      label: "Announced",
      mw: views.announcedMw,
      meaning: "Every non-cancelled project's best figure — the number the industry quotes.",
      tone: "dim",
      href: "/projects",
    },
    {
      label: "Credible pipeline",
      mw: views.crediblePipelineMw,
      meaning: "Announced, less rumoured and paused capacity nobody has committed to build.",
      tone: "cyan",
      href: "/projects?status=ANNOUNCED,PLANNING,PERMITTING,UNDER_CONSTRUCTION,PARTIALLY_OPERATIONAL,OPERATIONAL,DELAYED",
    },
    {
      label: "Under construction or beyond",
      mw: views.underConstructionOrBeyondMw,
      meaning: "Ground broken or power flowing — capacity backed by physical work.",
      tone: "amber",
      href: "/projects?status=UNDER_CONSTRUCTION,PARTIALLY_OPERATIONAL,OPERATIONAL",
    },
    {
      label: "Confirmed operating",
      mw: views.confirmedMw,
      meaning: "Only figures a source states as energized and serving load.",
      tone: "green",
      href: "/projects?status=PARTIALLY_OPERATIONAL,OPERATIONAL",
    },
  ];

  const top = rungs[0].mw || 1;
  const confirmedShare =
    views.announcedMw > 0 ? (views.confirmedMw / views.announcedMw) * 100 : 0;

  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg">Capacity, by what the evidence supports</h2>
        <p className="text-[11px] text-fg-muted">
          {confirmedShare < 1
            ? "Under 1% of announced capacity is confirmed operating"
            : `${confirmedShare.toFixed(1)}% of announced capacity is confirmed operating`}
        </p>
      </div>

      <div className="space-y-3 p-4">
        {rungs.map((rung) => (
          <div key={rung.label} className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              {rung.href ? (
                <Link href={rung.href} className="text-[12px] text-fg-dim hover:text-cyan">
                  {rung.label}
                </Link>
              ) : (
                <span className="text-[12px] text-fg-dim">{rung.label}</span>
              )}
              <span className={cn("num text-[15px] font-semibold", TONE[rung.tone])}>
                {formatPowerScaled(rung.mw)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-panel-2">
              <div
                className={cn(
                  "h-full rounded-sm",
                  rung.tone === "green"
                    ? "bg-green"
                    : rung.tone === "amber"
                      ? "bg-amber"
                      : rung.tone === "cyan"
                        ? "bg-cyan"
                        : "bg-fg-muted/40",
                )}
                // A confirmed figure three orders of magnitude below the
                // announced one would render as an invisible sliver, so the
                // bar has a visible floor. The number beside it is exact.
                style={{ width: `${Math.max((rung.mw / top) * 100, rung.mw > 0 ? 1.5 : 0)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{rung.meaning}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-t border-line px-4 py-3 text-[11px] leading-relaxed text-fg-muted">
        <p>
          <span className="text-fg-dim">Coverage.</span> A power figure is sourced for{" "}
          <span className="num text-fg-dim">
            {formatCount(coverage.withValue)} of {formatCount(coverage.total)}
          </span>{" "}
          projects ({coverage.percent}%). The rest are tracked with no capacity disclosed —
          counted as unknown, never as zero.
        </p>
        <p>
          <span className="text-fg-dim">Confidence-weighted:</span>{" "}
          <span className="num text-fg-dim">{formatPowerScaled(confidenceWeightedMw)}</span>{" "}
          — a <em>modelled</em> figure, discounting each project by the confidence of its own
          power claim. Not a measurement.{" "}
          <Link href="/methodology" className="text-cyan hover:underline">
            See the weights
          </Link>
          .
        </p>
        {views.rumoredOrPausedMw > 0 ? (
          <p>
            <span className="text-fg-dim">Excluded from the credible pipeline:</span>{" "}
            <span className="num text-fg-dim">{formatPowerScaled(views.rumoredOrPausedMw)}</span>{" "}
            of rumoured or paused capacity
            {views.cancelledMw > 0 ? (
              <>
                , plus{" "}
                <span className="num text-fg-dim">{formatPowerScaled(views.cancelledMw)}</span>{" "}
                cancelled
              </>
            ) : null}
            . Reported here rather than dropped silently.
          </p>
        ) : null}
      </div>
    </section>
  );
}
