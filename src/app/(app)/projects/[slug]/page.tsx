import { History, MapPin, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import {
  ConfidenceBreakdown,
  EvidenceTable,
  SourceList,
} from "@/components/projects/evidence-section";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectMiniList } from "@/components/project-mini-list";
import { ConfidenceMeter, DemoDataBadge, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import {
  PROJECT_COMPANY_ROLE_LABEL,
  PROJECT_STATUS_META,
  PROJECT_TYPE_LABEL,
} from "@/lib/domain";
import {
  formatCount,
  formatDate,
  formatLocation,
  formatMonthYear,
  formatMw,
  formatRelative,
  formatUsdExact,
  NOT_DISCLOSED,
} from "@/lib/format";
import { can, getSessionUser } from "@/lib/permissions";
import { NotFoundError } from "@/lib/services/errors";
import { getProjectBySlug, getRelatedProjects } from "@/lib/services/projects";
import { decimalToString } from "@/lib/serialize";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = await getProjectBySlug(slug);
    return { title: project.name };
  } catch {
    return { title: "Project not found" };
  }
}

/**
 * A labelled value. `basis` states whether the number is confirmed or estimated,
 * which is the whole point: the same field can hold either, and the reader must
 * be able to tell without checking the evidence table.
 */
function Field({
  label,
  value,
  basis,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  basis?: "confirmed" | "estimated" | null;
  hint?: string;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-2">
        <span className="num text-[15px] text-fg">{value}</span>
        {basis === "confirmed" ? (
          <Badge tone="operational">Confirmed</Badge>
        ) : basis === "estimated" ? (
          <Badge tone="inert">Estimated</Badge>
        ) : null}
      </dd>
      {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  const { slug } = await params;

  let project: Awaited<ReturnType<typeof getProjectBySlug>>;
  try {
    project = await getProjectBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const related = await getRelatedProjects({
    id: project.id,
    ownerCompanyId: project.ownerCompanyId,
    country: project.country,
  });

  // Decimals are stringified here because this page hands values to the
  // evidence components; the raw Prisma objects cannot cross a client boundary.
  const powerConfirmed = decimalToString(project.confirmedPowerMw);
  const powerEstimated = decimalToString(project.estimatedPowerMw);
  const capexConfirmed = decimalToString(project.confirmedCapexUsd);
  const capexEstimated = decimalToString(project.estimatedCapexUsd);

  const metrics = project.metrics.map((m) => ({
    id: m.id,
    metricType: m.metricType,
    numericValue: decimalToString(m.numericValue),
    textValue: m.textValue,
    unit: m.unit,
    confidenceLevel: m.confidenceLevel,
    methodology: m.methodology,
    effectiveDate: m.effectiveDate,
    source: m.source,
  }));

  const owners = project.companies.filter(
    (c) => c.role === "OWNER" || c.role === "OPERATOR",
  );
  const suppliers = project.companies.filter(
    (c) => c.role !== "OWNER" && c.role !== "OPERATOR",
  );

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={project.description ?? undefined}
        actions={
          <>
            {can(user?.role, "record:edit") ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${project.slug}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {can(user?.role, "record:create") ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/sources/new?projectId=${project.id}`}>Add source</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {can(user?.role, "record:delete") ? (
        <div className="mb-4">
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.name}
            counts={{
              sources: project.sources.length,
              metrics: project.metrics.length,
              revisions: project.revisions.length,
            }}
          />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        <Badge tone="neutral">{PROJECT_TYPE_LABEL[project.projectType]}</Badge>
        {project.isDemoData ? <DemoDataBadge /> : null}
        {project.tags.map((t) => (
          <Badge key={t.id} tone="planned">
            {t.name}
          </Badge>
        ))}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-fg-muted">
          <span>Last verified {formatRelative(project.lastVerifiedAt)}</span>
          <ConfidenceMeter score={project.confidenceScore} />
        </span>
      </div>

      {project.isDemoData ? (
        <div className="mb-4 rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-2.5">
          <p className="text-[12px] leading-relaxed text-red">
            Every figure on this page is invented seed data for UI development. It is
            not research output and must not be used in analysis or cited.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Summary + key metrics ---- */}
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Key metrics</PanelTitle>
            <span className="text-[11px] text-fg-muted">
              {PROJECT_STATUS_META[project.status].description}
            </span>
          </PanelHeader>
          <PanelBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <Field
                label="Power"
                value={formatMw(powerConfirmed ?? powerEstimated)}
                basis={
                  powerConfirmed !== null
                    ? "confirmed"
                    : powerEstimated !== null
                      ? "estimated"
                      : null
                }
                hint={
                  powerConfirmed !== null && powerEstimated !== null
                    ? `Estimate at full build: ${formatMw(powerEstimated)}`
                    : undefined
                }
              />
              <Field
                label="Accelerators"
                value={formatCount(
                  project.confirmedGpuCount ?? project.estimatedGpuCount,
                )}
                basis={
                  project.confirmedGpuCount !== null
                    ? "confirmed"
                    : project.estimatedGpuCount !== null
                      ? "estimated"
                      : null
                }
                hint={project.gpuModel ?? undefined}
              />
              <Field
                label="Capex"
                value={formatUsdExact(capexConfirmed ?? capexEstimated)}
                basis={
                  capexConfirmed !== null
                    ? "confirmed"
                    : capexEstimated !== null
                      ? "estimated"
                      : null
                }
              />
              <Field
                label="Compute platform"
                value={project.computePlatform ?? NOT_DISCLOSED}
              />
              <Field
                label="Floor area"
                value={
                  project.squareFeet === null
                    ? NOT_DISCLOSED
                    : `${formatCount(project.squareFeet)} sq ft`
                }
              />
              <Field
                label="Cooling"
                value={project.coolingTechnology ?? NOT_DISCLOSED}
              />
              <Field
                label="Power source"
                value={project.powerSource ?? NOT_DISCLOSED}
              />
              <Field label="Utility" value={project.utilityProvider ?? NOT_DISCLOSED} />
              <Field
                label="Location"
                value={formatLocation(project)}
                hint={
                  project.latitude !== null && project.longitude !== null
                    ? `${project.latitude.toFixed(4)}, ${project.longitude.toFixed(4)}`
                    : "No coordinates — will not appear on the map"
                }
              />
            </dl>
          </PanelBody>
        </Panel>

        {/* ---- Confidence ---- */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Confidence breakdown</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ConfidenceBreakdown
              metrics={metrics}
              sources={project.sources}
              confidenceScore={project.confidenceScore}
            />
          </PanelBody>
        </Panel>

        {/* ---- Timeline ---- */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Timeline</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ol className="space-y-3">
              {[
                { label: "Announced", date: project.announcementDate },
                { label: "Expected opening", date: project.expectedOpeningDate },
                { label: "Actual opening", date: project.actualOpeningDate },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="eyebrow">{row.label}</span>
                  <span className="num text-[13px] text-fg">
                    {row.date ? formatMonthYear(row.date) : NOT_DISCLOSED}
                  </span>
                </li>
              ))}
            </ol>

            {project.expectedOpeningDate &&
            !project.actualOpeningDate &&
            project.expectedOpeningDate < new Date() ? (
              <p className="mt-3 rounded border border-[#5a4400] bg-[#2b1f00] px-3 py-2 text-[11px] leading-relaxed text-amber">
                The expected opening date has passed with no actual opening recorded.
                This project is in the verification queue.
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        {/* ---- Ownership + suppliers ---- */}
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Supplier ecosystem</PanelTitle>
          </PanelHeader>
          <PanelBody className="p-0">
            {project.companies.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-fg-muted">
                No companies linked to this project yet.
              </p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Company</Th>
                      <Th>Role</Th>
                      <Th>Ticker</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...owners, ...suppliers].map((link) => (
                      <Tr key={link.id}>
                        <Td>
                          <Link
                            href={`/companies/${link.company.slug}`}
                            className="font-medium text-fg hover:text-cyan"
                          >
                            {link.company.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              link.role === "OWNER" || link.role === "OPERATOR"
                                ? "planned"
                                : "neutral"
                            }
                          >
                            {PROJECT_COMPANY_ROLE_LABEL[link.role]}
                          </Badge>
                        </Td>
                        <Td className="num text-fg-dim">
                          {link.company.ticker ?? "—"}
                        </Td>
                        <Td className="text-[12px] text-fg-dim">{link.notes ?? "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </PanelBody>
        </Panel>

        {/* ---- Evidence ---- */}
        <Panel className="lg:col-span-3">
          <PanelHeader>
            <PanelTitle>Evidence — every claim and what backs it</PanelTitle>
            <span className="text-[11px] text-fg-muted">
              {metrics.length} claim{metrics.length === 1 ? "" : "s"} ·{" "}
              {project.sources.length} source{project.sources.length === 1 ? "" : "s"}
            </span>
          </PanelHeader>
          <PanelBody className="p-0">
            <EvidenceTable metrics={metrics} />
          </PanelBody>
        </Panel>

        {/* ---- Sources ---- */}
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Sources</PanelTitle>
            {can(user?.role, "record:create") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/sources/new?projectId=${project.id}`}>Add source</Link>
              </Button>
            ) : null}
          </PanelHeader>
          <PanelBody className="pt-0">
            <SourceList sources={project.sources} />
          </PanelBody>
        </Panel>

        {/* ---- Analyst notes ---- */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Analyst notes</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {project.analystNotes ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-dim">
                {project.analystNotes}
              </p>
            ) : (
              <p className="text-xs text-fg-muted">No analyst notes recorded.</p>
            )}
          </PanelBody>
        </Panel>

        {/* ---- Revisions ---- */}
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>
              <span className="inline-flex items-center gap-1.5">
                <History className="size-3" /> Revision history
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelBody className="pt-0">
            {project.revisions.length === 0 ? (
              <p className="py-6 text-center text-xs text-fg-muted">
                No revisions recorded.
              </p>
            ) : (
              <ul className="divide-y divide-[#1b1b1b]">
                {project.revisions.map((rev) => (
                  <li key={rev.id} className="py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] text-fg">{rev.changeSummary}</p>
                      <p className="num text-[11px] text-fg-muted">
                        {formatDate(rev.createdAt)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                      {rev.user?.name ?? rev.user?.email ?? "System"}
                    </p>
                    {rev.previousData && rev.newData ? (
                      <DiffList
                        previous={rev.previousData as Record<string, string | null>}
                        next={rev.newData as Record<string, string | null>}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        {/* ---- Related ---- */}
        <Panel>
          <PanelHeader>
            <PanelTitle>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3" /> Related projects
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelBody className="pt-0">
            <ProjectMiniList
              projects={related}
              emptyText="No related projects by owner or country."
            />
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

/** Field-level before/after for one revision. */
function DiffList({
  previous,
  next,
}: {
  previous: Record<string, string | null>;
  next: Record<string, string | null>;
}) {
  const fields = Object.keys(next);
  if (fields.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5">
      {fields.map((field) => (
        <li key={field} className="font-mono text-[11px] text-fg-muted">
          <span className="text-fg-dim">{field}</span>:{" "}
          <span className="text-red/80 line-through">{previous[field] ?? "—"}</span> →{" "}
          <span className="text-green">{next[field] ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}
