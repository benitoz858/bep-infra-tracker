import { POWER_BASIS_META, type PowerBasis } from "@/lib/credibility";
import { formatMonthYear, formatPowerScaled, formatUsdCompact } from "@/lib/format";

/**
 * The twenty-second read.
 *
 * A dossier that opens with an evidence ledger makes a reader assemble the
 * conclusion themselves; a dossier that opens with a conclusion and no evidence
 * is a blog post. This sits between: what is established, what is explicitly not
 * disclosed, and why the project matters — each generated from the record rather
 * than written, so it cannot drift from the data beneath it.
 *
 * "Not known" is the part most databases omit, and it is often the most
 * decision-relevant thing on the page: a gigawatt with no disclosed power source
 * and no named tenant is a different asset from a gigawatt with both.
 */
export function ProjectBrief({
  status,
  powerMw,
  isConfirmedPower,
  powerBasis,
  gpuCount,
  gpuModel,
  capexUsd,
  expectedOpening,
  ownerName,
  tenantNames,
  utilityProvider,
  powerSource,
  coolingTechnology,
  analystNotes,
}: {
  status: string;
  powerMw: number | null;
  isConfirmedPower: boolean;
  powerBasis: PowerBasis;
  gpuCount: number | null;
  gpuModel: string | null;
  capexUsd: number | null;
  expectedOpening: Date | null;
  ownerName: string | null;
  tenantNames: string[];
  utilityProvider: string | null;
  powerSource: string | null;
  coolingTechnology: string | null;
  analystNotes: string | null;
}) {
  const known: string[] = [];
  const unknown: string[] = [];

  if (powerMw !== null) {
    known.push(
      `${formatPowerScaled(powerMw)} ${
        isConfirmedPower ? "confirmed energized" : "announced"
      } (${POWER_BASIS_META[powerBasis].label.toLowerCase()})`,
    );
  } else {
    unknown.push("capacity");
  }

  if (gpuCount !== null) {
    known.push(
      `${gpuCount.toLocaleString("en-US")} accelerators${gpuModel ? ` (${gpuModel})` : ""}`,
    );
  } else {
    unknown.push("accelerator count");
  }

  if (!gpuModel && gpuCount === null) unknown.push("hardware platform");
  if (capexUsd !== null) known.push(`${formatUsdCompact(capexUsd)} announced investment`);
  else unknown.push("project capex");

  if (expectedOpening) known.push(`expected ${formatMonthYear(expectedOpening)}`);
  else unknown.push("timeline");

  if (ownerName) known.push(`owned or developed by ${ownerName}`);
  if (tenantNames.length > 0) known.push(`tenant: ${tenantNames.join(", ")}`);
  else unknown.push("named tenant");

  if (utilityProvider) known.push(`utility: ${utilityProvider}`);
  if (powerSource) known.push(`power source: ${powerSource}`);
  else unknown.push("power source");

  if (!coolingTechnology) unknown.push("cooling technology");

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-panel p-4 lg:grid-cols-3">
      <div className="min-w-0">
        <p className="eyebrow mb-1.5 text-green">What is established</p>
        <p className="text-[12px] leading-relaxed text-fg-dim">
          {known.length > 0 ? (
            <>
              {status}. {known.join("; ")}.
            </>
          ) : (
            "Nothing beyond the project's existence has been sourced."
          )}
        </p>
      </div>

      <div className="min-w-0">
        <p className="eyebrow mb-1.5 text-amber">What is not disclosed</p>
        <p className="text-[12px] leading-relaxed text-fg-dim">
          {unknown.length > 0 ? (
            <>
              {unknown.join(", ").replace(/^./, (c) => c.toUpperCase())} — not disclosed by any
              source on this page. Recorded as unknown, never as zero.
            </>
          ) : (
            "Every tracked field has a sourced value."
          )}
        </p>
      </div>

      <div className="min-w-0">
        <p className="eyebrow mb-1.5 text-cyan">Analyst note</p>
        {analystNotes ? (
          <p className="line-clamp-6 text-[12px] leading-relaxed text-fg-dim">
            {analystNotes}
          </p>
        ) : (
          <p className="text-[12px] leading-relaxed text-fg-muted">
            No analyst commentary recorded. The figures above stand on their sources alone.
          </p>
        )}
      </div>
    </div>
  );
}
