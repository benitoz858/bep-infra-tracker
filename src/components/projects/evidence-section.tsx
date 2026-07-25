import { ExternalLink, FileText } from "lucide-react";

import { ConfidenceBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { ConfidenceLevel, MetricType, SourceType } from "@/generated/prisma/enums";
import { CONFIDENCE_META, METRIC_TYPE_META, SOURCE_TYPE_LABEL } from "@/lib/domain";
import {
  formatCount,
  formatDate,
  formatNumber,
  formatUsdExact,
  NOT_DISCLOSED,
} from "@/lib/format";

export type EvidenceMetric = {
  id: string;
  metricType: MetricType;
  numericValue: string | null;
  textValue: string | null;
  unit: string | null;
  confidenceLevel: ConfidenceLevel;
  methodology: string | null;
  effectiveDate: Date | null;
  source: { id: string; title: string; publisher: string | null; url: string } | null;
};

export type EvidenceSource = {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  publicationDate: Date | null;
  sourceType: SourceType;
  excerpt: string | null;
  archivedUrl: string | null;
  reliabilityScore: number | null;
  isPrimarySource: boolean;
  accessedAt: Date | null;
};

/** Render a metric value in the units the metric type implies. */
function metricValue(metric: EvidenceMetric): string {
  if (metric.numericValue === null) return metric.textValue ?? NOT_DISCLOSED;

  switch (metric.metricType) {
    case "CAPEX_USD":
      return formatUsdExact(metric.numericValue);
    case "GPU_COUNT":
    case "RACK_COUNT":
    case "SQUARE_FEET":
      return `${formatCount(metric.numericValue)}${metric.unit ? ` ${metric.unit}` : ""}`;
    case "PUE":
      return formatNumber(metric.numericValue, { maximumFractionDigits: 3 });
    default:
      return `${formatNumber(metric.numericValue, { maximumFractionDigits: 2 })}${
        metric.unit ? ` ${metric.unit}` : ""
      }`;
  }
}

/**
 * The Evidence table: every claim, its confidence, the reasoning, and the source
 * that backs it. This is the part of the product that distinguishes a fact from
 * an estimate, so a metric with no citation is called out explicitly rather than
 * shown as a blank cell.
 */
export function EvidenceTable({ metrics }: { metrics: EvidenceMetric[] }) {
  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No metrics recorded"
        description="Add a claim from the source inbox to start the evidence trail for this project."
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Metric</Th>
            <Th className="text-right">Value</Th>
            <Th>Confidence</Th>
            <Th>As of</Th>
            <Th>Basis / methodology</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <Tr key={m.id}>
              <Td className="whitespace-nowrap font-medium text-fg">
                {METRIC_TYPE_META[m.metricType].label}
              </Td>
              <Td className="num whitespace-nowrap text-right text-fg">
                {metricValue(m)}
              </Td>
              <Td>
                <ConfidenceBadge level={m.confidenceLevel} />
              </Td>
              <Td className="num whitespace-nowrap text-fg-dim">
                {formatDate(m.effectiveDate)}
              </Td>
              <Td className="max-w-[320px] text-[12px] leading-relaxed text-fg-dim">
                {m.methodology ?? (
                  <span className="text-fg-muted">No methodology recorded</span>
                )}
              </Td>
              <Td className="max-w-[220px]">
                {m.source ? (
                  <a
                    href={m.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 text-[12px] text-cyan hover:underline"
                  >
                    <span className="line-clamp-2">
                      {m.source.publisher ?? m.source.title}
                    </span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0" />
                  </a>
                ) : (
                  // A CONFIRMED metric can never reach this branch — the service
                  // rejects it — so an uncited metric here is an estimate.
                  <Badge tone="risk">Uncited</Badge>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

export function SourceList({ sources }: { sources: EvidenceSource[] }) {
  if (sources.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No sources attached"
        description="This project is unsourced and will stay in the verification queue until evidence is added."
      />
    );
  }

  return (
    <ul className="divide-y divide-[#1b1b1b]">
      {sources.map((s) => (
        <li key={s.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-fg hover:text-cyan"
                >
                  {s.title}
                </a>
                {s.isPrimarySource ? <Badge tone="operational">Primary</Badge> : null}
                <Badge tone="neutral">{SOURCE_TYPE_LABEL[s.sourceType]}</Badge>
              </div>

              <p className="mt-1 text-[11px] text-fg-muted">
                {s.publisher ?? "Publisher not recorded"} ·{" "}
                {formatDate(s.publicationDate)}
                {s.accessedAt ? ` · accessed ${formatDate(s.accessedAt)}` : ""}
              </p>

              {s.excerpt ? (
                <blockquote className="mt-2 border-l-2 border-line-2 pl-3 text-[12px] leading-relaxed text-fg-dim">
                  {s.excerpt}
                </blockquote>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan hover:underline"
                >
                  Open source <ExternalLink className="size-3" />
                </a>
                {s.archivedUrl ? (
                  <a
                    href={s.archivedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-fg-dim hover:text-cyan"
                  >
                    Archived copy <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="eyebrow">Reliability</p>
              <p className="num text-sm text-fg">
                {s.reliabilityScore === null ? (
                  <span className="text-fg-muted">n/a</span>
                ) : (
                  `${s.reliabilityScore}/100`
                )}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Confidence breakdown: how much of what we assert about this project is
 * actually sourced. Deliberately blunt — it is easy to accumulate a page of
 * estimates that reads as knowledge.
 */
export function ConfidenceBreakdown({
  metrics,
  sources,
  confidenceScore,
}: {
  metrics: EvidenceMetric[];
  sources: EvidenceSource[];
  confidenceScore: number | null;
}) {
  const byLevel = new Map<ConfidenceLevel, number>();
  for (const m of metrics) {
    byLevel.set(m.confidenceLevel, (byLevel.get(m.confidenceLevel) ?? 0) + 1);
  }

  const cited = metrics.filter((m) => m.source !== null).length;
  const primaryCount = sources.filter((s) => s.isPrimarySource).length;
  const citedShare = metrics.length ? Math.round((cited / metrics.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="eyebrow">Project confidence</dt>
          <dd className="num mt-0.5 text-lg text-fg">
            {confidenceScore === null ? (
              <span className="text-fg-muted text-sm">Not scored</span>
            ) : (
              `${confidenceScore}/100`
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Claims with a source</dt>
          <dd className="num mt-0.5 text-lg text-fg">
            {cited}/{metrics.length}{" "}
            <span className="text-sm text-fg-dim">({citedShare}%)</span>
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Sources</dt>
          <dd className="num mt-0.5 text-lg text-fg">{sources.length}</dd>
        </div>
        <div>
          <dt className="eyebrow">Primary sources</dt>
          <dd className="num mt-0.5 text-lg text-fg">
            {primaryCount}
            {primaryCount === 0 && sources.length > 0 ? (
              <span className="ml-2 text-[11px] text-amber">secondary only</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="space-y-1.5 border-t border-line pt-3">
        {(Object.keys(CONFIDENCE_META) as ConfidenceLevel[]).map((level) => {
          const count = byLevel.get(level) ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / metrics.length) * 100);
          return (
            <div key={level} className="flex items-center gap-2">
              <span className="w-24 shrink-0">
                <ConfidenceBadge level={level} />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-panel-2">
                <span
                  className="block h-full rounded-sm bg-cyan/60"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="num w-14 text-right text-[11px] text-fg-dim">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
