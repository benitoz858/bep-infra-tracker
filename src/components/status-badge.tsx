import type { ConfidenceLevel, ProjectStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { CONFIDENCE_META, PROJECT_STATUS_META } from "@/lib/domain";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const meta = CONFIDENCE_META[level];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/**
 * Rendered on every seeded project, everywhere it appears. The spec requires
 * demo figures to be unmistakable; this is the single component responsible for
 * that, so it must not be made conditional on the current page.
 */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="risk"
      className={className}
      title="Illustrative seed data. Not researched, not verified, not for use in analysis."
    >
      Demo data — not verified
    </Badge>
  );
}

/**
 * Confidence score 0–100 as a compact 5-block meter. Reads faster than a bare
 * number in a dense table.
 */
export function ConfidenceMeter({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-fg-muted">Not scored</span>;
  }
  const filled = Math.round((Math.min(100, Math.max(0, score)) / 100) * 5);
  const tone = score >= 75 ? "bg-green" : score >= 45 ? "bg-amber" : "bg-red";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Confidence ${score}/100`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-1.5 rounded-sm ${i < filled ? tone : "bg-[#262626]"}`}
          />
        ))}
      </span>
      <span className="num text-[11px] text-fg-dim">{score}</span>
    </span>
  );
}
