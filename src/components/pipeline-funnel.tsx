import { formatCount, formatPowerScaled } from "@/lib/format";
import type { FunnelStage } from "@/lib/capacity";

/**
 * The pipeline funnel.
 *
 * Each stage counts capacity that has reached *at least* that stage, so the
 * bars shrink monotonically and the gap between two rows is capacity that has
 * not yet cleared the next gate. It is deliberately not a conversion rate:
 * projects do not move through these stages in lockstep, and a bitcoin-mine
 * conversion often has power before it has a tenant.
 */
export function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  const base = stages[0]?.powerMw || 1;

  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg">Pipeline funnel</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
          Capacity that has reached at least each stage. Rumoured, paused and cancelled
          projects are excluded throughout.
        </p>
      </div>

      <div className="p-4">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-fg-muted">
              <th className="pb-2 font-normal">Stage</th>
              <th className="pb-2 text-right font-normal">Projects</th>
              <th className="pb-2 text-right font-normal">Capacity</th>
              <th className="pb-2 text-right font-normal">Share</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, i) => {
              const previous = i > 0 ? stages[i - 1] : null;
              const dropMw = previous ? previous.powerMw - stage.powerMw : 0;
              return (
                <tr key={stage.key} className="border-t border-line/60 align-middle">
                  <td className="py-2 pr-2">
                    <div className="text-[12px] text-fg-dim">{stage.label}</div>
                    <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-sm bg-panel-2">
                      <div
                        className="h-full rounded-sm bg-cyan/70"
                        style={{
                          width: `${Math.max((stage.powerMw / base) * 100, stage.powerMw > 0 ? 1.5 : 0)}%`,
                        }}
                      />
                    </div>
                    {dropMw > 0 ? (
                      <div className="mt-1 text-[10px] text-fg-muted">
                        {formatPowerScaled(dropMw)} has not cleared this gate
                      </div>
                    ) : null}
                  </td>
                  <td className="num py-2 text-right align-top text-[12px] text-fg-dim">
                    {formatCount(stage.projects)}
                  </td>
                  <td className="num py-2 text-right align-top text-[12px] text-fg">
                    {formatPowerScaled(stage.powerMw)}
                  </td>
                  <td className="num py-2 text-right align-top text-[12px] text-fg-muted">
                    {stage.percentOfPipeline}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
