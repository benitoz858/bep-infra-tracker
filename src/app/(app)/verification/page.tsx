import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { VerifyButton } from "@/components/verification/verify-button";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { formatCount, formatDate, formatRelative } from "@/lib/format";
import { can, requireUser } from "@/lib/permissions";
import {
  REVIEW_REASON_LABEL,
  STALE_AFTER_DAYS,
  getVerificationQueue,
  type ReviewReason,
} from "@/lib/services/verification";

export const metadata: Metadata = { title: "Verification queue" };

/** Reasons that mean the record's evidence is thin, rather than merely stale. */
const EVIDENCE_REASONS: ReviewReason[] = [
  "no_sources",
  "single_source",
  "low_reliability",
  "value_conflict",
];

export default async function VerificationPage() {
  const user = await requireUser();
  const queue = await getVerificationQueue();

  const counts = queue.reduce<Record<string, number>>((acc, item) => {
    for (const reason of item.reasons) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  const evidenceGaps = queue.filter((i) =>
    i.reasons.some((r) => EVIDENCE_REASONS.includes(r)),
  ).length;

  return (
    <>
      <PageHeader
        title="Verification queue"
        subtitle={`Projects needing review. A record enters the queue if it is unverified for ${STALE_AFTER_DAYS} days, its expected opening has passed, it has thin or low-reliability evidence, its estimated and confirmed figures disagree, or its status is inherently unstable.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/projects?needsVerification=1">Open as filtered table</Link>
          </Button>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="In queue"
          value={formatCount(queue.length)}
          accent={queue.length > 0 ? "red" : "green"}
        />
        <StatTile
          label="Evidence gaps"
          value={formatCount(evidenceGaps)}
          hint="Thin, weak or conflicting evidence"
          accent="amber"
        />
        <StatTile
          label="Opening date passed"
          value={formatCount(counts.opening_date_passed ?? 0)}
          hint="Not yet marked operational"
          accent="amber"
        />
        <StatTile
          label="Never verified"
          value={formatCount(counts.never_verified ?? 0)}
          accent="plain"
        />
      </section>

      <Panel>
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing needs review"
            description="Every project has been verified recently, has at least two sources, and has no conflicting figures."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Owner</Th>
                  <Th>Status</Th>
                  <Th>Review reasons</Th>
                  <Th className="text-right">Sources</Th>
                  <Th>Last verified</Th>
                  <Th>Expected opening</Th>
                  {can(user.role, "record:edit") ? <Th>Actions</Th> : null}
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${item.slug}`}
                          className="font-medium text-fg hover:text-cyan"
                        >
                          {item.name}
                        </Link>
                        {item.isDemoData ? <Badge tone="risk">Demo</Badge> : null}
                      </div>
                      <p className="text-[11px] text-fg-muted">{item.country}</p>
                    </Td>
                    <Td className="text-fg-dim">{item.ownerName ?? "Unattributed"}</Td>
                    <Td>
                      <StatusBadge status={item.status as ProjectStatus} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {item.reasons.map((reason) => (
                          <Badge
                            key={reason}
                            tone={
                              EVIDENCE_REASONS.includes(reason)
                                ? "risk"
                                : "construction"
                            }
                          >
                            {REVIEW_REASON_LABEL[reason]}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td
                      className={`num text-right ${
                        item.sourceCount === 0 ? "text-red" : "text-fg-dim"
                      }`}
                    >
                      {item.sourceCount}
                    </Td>
                    <Td className="whitespace-nowrap text-fg-dim">
                      {formatRelative(item.lastVerifiedAt)}
                    </Td>
                    <Td className="num whitespace-nowrap text-fg-dim">
                      {formatDate(item.expectedOpeningDate)}
                    </Td>
                    {can(user.role, "record:edit") ? (
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <VerifyButton projectId={item.id} />
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/projects/${item.slug}/edit`}>Edit</Link>
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
        Rows are ordered by number of review reasons, worst first. Marking a project
        verified stamps the current time and writes a revision — it does not change any
        figure, so a stale number stays stale until someone edits it.
      </p>
    </>
  );
}
