import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  CandidateReview,
  type ProposedClaimView,
} from "@/components/ingest/candidate-review";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/db";
import { formatCount, formatRelative } from "@/lib/format";
import { can, getSessionUser } from "@/lib/permissions";
import { getIngestionStats, listCandidates } from "@/lib/services/ingestion";

export const metadata: Metadata = { title: "Agent inbox" };

export default async function IngestPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "record:create")) redirect("/dashboard");

  const [candidates, stats, projects] = await Promise.all([
    listCandidates("PENDING"),
    getIngestionStats(),
    prisma.project.findMany({
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const failedRuns = stats.runs.filter((r) => r.status === "FAILED");

  return (
    <>
      <PageHeader
        title="Agent inbox"
        subtitle="Automated watchers stage what they find here. Nothing on this page has touched the database — a candidate becomes evidence only when you accept it, and machine-proposed claims are capped at Low confidence no matter what the extractor thought."
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={formatCount(stats.pending)}
          accent={stats.pending > 0 ? "amber" : "green"}
        />
        <StatTile label="Accepted" value={formatCount(stats.accepted)} accent="green" />
        <StatTile label="Rejected" value={formatCount(stats.rejected)} accent="plain" />
        <StatTile
          label="Failed runs"
          value={formatCount(failedRuns.length)}
          hint="Last 10 runs"
          accent={failedRuns.length > 0 ? "red" : "green"}
        />
      </section>

      {failedRuns.length > 0 ? (
        <div className="mb-5 rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-3">
          <p className="mb-1 text-[12px] font-medium text-red">
            {failedRuns.length} watcher run(s) failed
          </p>
          <ul className="space-y-0.5">
            {failedRuns.map((run) => (
              <li key={run.id} className="font-mono text-[11px] text-fg-dim">
                {run.watcher}: {run.error}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
            A silently broken watcher looks exactly like a quiet week, which is
            why failures are shown here rather than only in the job log.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <Panel>
              <EmptyState
                title="Nothing awaiting review"
                description="Public submissions from /submit land here, as do the watchers — run them with `npm run ingest` or wait for the scheduled run."
              />
            </Panel>
          ) : (
            candidates.map((c) => (
              <CandidateReview
                key={c.id}
                projects={projects}
                candidate={{
                  id: c.id,
                  url: c.url,
                  title: c.title,
                  publisher: c.publisher,
                  publicationDate: c.publicationDate,
                  sourceType: c.sourceType,
                  excerpt: c.excerpt,
                  origin: c.origin,
                  submitterName: c.submitterName,
                  submitterEmail: c.submitterEmail,
                  submitterNote: c.submitterNote,
                  matchScore: c.matchScore,
                  matchReason: c.matchReason,
                  extractor: c.extractor,
                  watcher: c.run.watcher,
                  suggestedProject: c.suggestedProject,
                  proposedClaims: (c.proposedClaims as ProposedClaimView[] | null) ?? [],
                }}
              />
            ))
          )}
        </div>

        <Panel className="h-fit">
          <PanelHeader>
            <PanelTitle>Recent runs</PanelTitle>
          </PanelHeader>
          <PanelBody className="pt-0">
            <ul className="divide-y divide-[#1b1b1b]">
              {stats.runs.map((run) => (
                <li key={run.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-fg-dim">
                      {run.watcher}
                    </span>
                    <Badge
                      tone={
                        run.status === "FAILED"
                          ? "risk"
                          : run.status === "RUNNING"
                            ? "construction"
                            : "operational"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <p className="num mt-0.5 text-[10px] text-fg-muted">
                    {run.itemsSeen} seen · {run.itemsNew} new ·{" "}
                    {formatRelative(run.startedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
