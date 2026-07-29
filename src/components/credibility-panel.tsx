import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  CREDIBILITY_META,
  POWER_READINESS_META,
  type CredibilityAssessment,
  type PowerReadiness,
} from "@/lib/credibility";

/**
 * Renders a credibility assessment with its components exposed.
 *
 * The components are the point. A reader who disagrees with the verdict should
 * be able to see precisely which input produced it and argue with that instead
 * — which is also how a correction gets filed.
 */

const MARK: Record<string, { glyph: string; className: string; sr: string }> = {
  positive: { glyph: "+", className: "text-green", sr: "Supports" },
  neutral: { glyph: "·", className: "text-fg-muted", sr: "Neutral" },
  negative: { glyph: "−", className: "text-red", sr: "Counts against" },
  unknown: { glyph: "?", className: "text-fg-muted", sr: "Unknown" },
};

export function CredibilityPanel({
  assessment,
  powerReadiness,
}: {
  assessment: CredibilityAssessment;
  powerReadiness: PowerReadiness;
}) {
  const meta = CREDIBILITY_META[assessment.state];
  const power = POWER_READINESS_META[powerReadiness];

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg">Credibility assessment</h2>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div className="px-4 py-3">
        <p className="text-[12px] leading-relaxed text-fg-dim">{meta.description}</p>

        <ul className="mt-3 space-y-1.5">
          {assessment.components.map((c) => {
            const mark = MARK[c.verdict];
            return (
              <li key={c.key} className="flex gap-2 text-[11px] leading-relaxed">
                <span
                  aria-hidden="true"
                  className={`num mt-px w-3 shrink-0 text-center font-semibold ${mark.className}`}
                >
                  {mark.glyph}
                </span>
                <span className="sr-only">{mark.sr}:</span>
                <span className="min-w-0">
                  <span className="text-fg-dim">{c.label}.</span>{" "}
                  <span className="text-fg-muted">{c.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 border-t border-line pt-3">
          <p className="eyebrow mb-1">Power readiness</p>
          <p className="text-[12px] text-fg-dim">{power.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">{power.description}</p>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
          Derived from the evidence on this page by a published rule, not a model.{" "}
          <Link href="/methodology" className="text-cyan hover:underline">
            How this is calculated
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
