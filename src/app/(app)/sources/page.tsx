import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { SOURCE_TYPE_LABEL } from "@/lib/domain";
import { formatDate, formatRelative } from "@/lib/format";
import { can, getSessionUser } from "@/lib/permissions";
import { listProjectsMissingSources, listRecentSources } from "@/lib/services/sources";

export const metadata: Metadata = {
  title: "Evidence library",
  description:
    "Every source cited in the tracker, with its publisher, reliability and the claims it supports.",
};

export default async function SourcesPage() {
  const user = await getSessionUser();
  const canCreate = can(user?.role, "record:create");
  const [recent, missing] = await Promise.all([
    listRecentSources(40),
    listProjectsMissingSources(20),
  ]);

  return (
    <>
      <PageHeader
        title="Evidence library"
        subtitle="Every source behind the figures, with its publisher, reliability and the claims it supports. Nothing is auto-extracted — each figure is entered by the analyst who read the source, so a claim can always be traced back to a sentence."
        actions={
          can(user?.role, "record:create") ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/sources/new">Add source</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Recently added sources</PanelTitle>
          </PanelHeader>
          <PanelBody className="p-0">
            {recent.length === 0 ? (
              <EmptyState
                title="No sources yet"
                description="Start by pasting a URL for a project you are researching."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href="/sources/new">Add the first source</Link>
                  </Button>
                }
              />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Source</Th>
                      <Th>Project</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Reliability</Th>
                      <Th className="text-right">Claims</Th>
                      <Th>Added</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((s) => (
                      <Tr key={s.id}>
                        <Td className="max-w-[280px]">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1 text-fg hover:text-cyan"
                          >
                            <span className="line-clamp-2">{s.title}</span>
                            <ExternalLink className="mt-0.5 size-3 shrink-0" />
                          </a>
                          <p className="text-[11px] text-fg-muted">
                            {s.publisher ?? "Publisher not recorded"} ·{" "}
                            {formatDate(s.publicationDate)}
                          </p>
                        </Td>
                        <Td>
                          <Link
                            href={`/projects/${s.project.slug}`}
                            className="text-fg-dim hover:text-cyan"
                          >
                            {s.project.name}
                          </Link>
                          {s.project.isDemoData ? (
                            <Badge tone="risk" className="ml-1.5">
                              Demo
                            </Badge>
                          ) : null}
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <Badge tone="neutral">
                              {SOURCE_TYPE_LABEL[s.sourceType]}
                            </Badge>
                            {s.isPrimarySource ? (
                              <Badge tone="operational">Primary</Badge>
                            ) : null}
                          </div>
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {s.reliabilityScore ?? "—"}
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {s._count.metrics}
                        </Td>
                        <Td className="whitespace-nowrap text-[11px] text-fg-muted">
                          {formatRelative(s.createdAt)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Projects with no evidence</PanelTitle>
            <span className="num text-[11px] text-red">{missing.length}</span>
          </PanelHeader>
          <PanelBody className="pt-0">
            {missing.length === 0 ? (
              <p className="py-6 text-center text-xs text-green">
                Every project has at least one source.
              </p>
            ) : (
              <>
                <p className="mb-2 pt-2 text-[11px] leading-relaxed text-fg-muted">
                  These assert figures with nothing behind them. They stay in the
                  verification queue until sourced.
                </p>
                <ul className="divide-y divide-[#1b1b1b]">
                  {missing.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <Link
                        href={`/projects/${p.slug}`}
                        className="min-w-0 truncate text-[13px] text-fg hover:text-cyan"
                      >
                        {p.name}
                      </Link>
                      {canCreate ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/sources/new?projectId=${p.id}`}>Add</Link>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
