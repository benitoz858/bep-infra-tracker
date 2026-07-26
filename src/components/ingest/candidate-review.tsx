"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SOURCE_TYPE_LABEL } from "@/lib/domain";
import { formatCount, formatDate, formatUsdCompact } from "@/lib/format";
import type { SourceType } from "@/generated/prisma/enums";

export type ProposedClaimView = {
  metricType: string;
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
  methodology: string;
};

export type CandidateView = {
  id: string;
  url: string;
  title: string;
  publisher: string | null;
  publicationDate: Date | null;
  sourceType: SourceType;
  excerpt: string | null;
  matchScore: number | null;
  matchReason: string | null;
  extractor: string;
  watcher: string;
  suggestedProject: { id: string; name: string; slug: string; country: string } | null;
  proposedClaims: ProposedClaimView[];
};

/** Render a proposed value in the units its metric implies. */
function claimValue(claim: ProposedClaimView): string {
  if (claim.numericValue === null) return claim.textValue ?? "—";
  if (claim.metricType === "CAPEX_USD") return formatUsdCompact(claim.numericValue);
  return `${formatCount(claim.numericValue)}${claim.unit ? ` ${claim.unit}` : ""}`;
}

export function CandidateReview({
  candidate,
  projects,
}: {
  candidate: CandidateView;
  projects: { id: string; name: string; country: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [projectId, setProjectId] = useState(candidate.suggestedProject?.id ?? "");
  // Nothing is ticked by default. Accepting every machine guess with one click
  // is exactly the failure this queue exists to prevent.
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [reliability, setReliability] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "accepted" | "rejected">(null);

  async function review(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ingest/${candidate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "accept"
            ? {
                action,
                projectId,
                keepClaimIndices: [...kept],
                reliabilityScore: reliability === "" ? null : Number(reliability),
                reviewNote: note || null,
              }
            : { action, reviewNote: note || null },
        ),
      });
      const body = (await response.json()) as {
        error?: { message: string; details?: { issues?: { message: string }[] } };
      };
      if (!response.ok) {
        throw new Error(
          body.error?.details?.issues?.[0]?.message ?? body.error?.message ?? "Failed.",
        );
      }
      setDone(action === "accept" ? "accepted" : "rejected");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-line bg-panel px-4 py-2.5">
        <p className="text-[12px] text-fg-dim">
          <Badge tone={done === "accepted" ? "operational" : "inert"}>{done}</Badge>{" "}
          <span className="ml-2">{candidate.title}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <a
            href={candidate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 text-[14px] font-medium text-fg hover:text-cyan"
          >
            {candidate.title}
            <ExternalLink className="mt-1 size-3 shrink-0" />
          </a>
          <p className="mt-1 text-[11px] text-fg-muted">
            {candidate.publisher ?? "Unknown publisher"} ·{" "}
            {formatDate(candidate.publicationDate)} · via{" "}
            <span className="font-mono">{candidate.watcher}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone="neutral">{SOURCE_TYPE_LABEL[candidate.sourceType]}</Badge>
          <Badge tone={candidate.extractor === "none" ? "inert" : "planned"}>
            {candidate.extractor}
          </Badge>
        </div>
      </div>

      {candidate.excerpt ? (
        <blockquote className="mx-4 mt-3 border-l-2 border-line-2 pl-3 text-[12px] leading-relaxed text-fg-dim">
          {candidate.excerpt.slice(0, 400)}
          {candidate.excerpt.length > 400 ? "…" : ""}
        </blockquote>
      ) : null}

      <div className="space-y-3 p-4">
        <div>
          <label className="eyebrow" htmlFor={`project-${candidate.id}`}>
            Attach to project
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Select
              id={`project-${candidate.id}`}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="max-w-md"
            >
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.country}
                </option>
              ))}
            </Select>
            {candidate.matchScore !== null && candidate.suggestedProject ? (
              <span className="text-[11px] text-fg-muted">
                suggested at {candidate.matchScore}% —{" "}
                <span className="text-fg-dim">{candidate.matchReason}</span>
              </span>
            ) : (
              <span className="text-[11px] text-fg-muted">
                No confident match — pick one, or create the project first.
              </span>
            )}
          </div>
        </div>

        {candidate.proposedClaims.length > 0 ? (
          <div>
            <p className="eyebrow mb-1.5">
              Proposed claims — tick only what the source actually supports
            </p>
            <ul className="space-y-1.5">
              {candidate.proposedClaims.map((claim, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 rounded border border-line-2 bg-panel-2 p-2"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-cyan"
                    aria-label={`Keep ${claim.metricType} claim`}
                    checked={kept.has(index)}
                    onChange={(e) =>
                      setKept((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(index);
                        else next.delete(index);
                        return next;
                      })
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] text-fg">
                      <span className="font-mono text-[11px] text-fg-dim">
                        {claim.metricType}
                      </span>{" "}
                      <span className="num font-medium">{claimValue(claim)}</span>{" "}
                      <Badge tone="risk">Low — machine proposed</Badge>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
                      {claim.methodology}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[12px] text-fg-muted">
            No claims extracted. Accepting records the source only — you can add
            claims by hand from the project page.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="eyebrow" htmlFor={`rel-${candidate.id}`}>
              Reliability
            </label>
            <Input
              id={`rel-${candidate.id}`}
              type="number"
              min={0}
              max={100}
              placeholder="0–100"
              value={reliability}
              onChange={(e) => setReliability(e.target.value)}
              className="mt-1 w-24"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="eyebrow" htmlFor={`note-${candidate.id}`}>
              Review note
            </label>
            <Input
              id={`note-${candidate.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you accepted or rejected this"
              className="mt-1"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!projectId || busy}
            onClick={() => void review("accept")}
          >
            <Check /> Accept
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => void review("reject")}
          >
            <X /> Reject
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-[12px] text-red">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
