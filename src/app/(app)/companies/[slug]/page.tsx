import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { ProjectMiniList } from "@/components/project-mini-list";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { COMPANY_TYPE_LABEL, PROJECT_COMPANY_ROLE_LABEL } from "@/lib/domain";
import {
  formatCount,
  formatCountCompact,
  formatMonthYear,
  formatPowerScaled,
} from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { getCompanyBySlug } from "@/lib/services/companies";
import { NotFoundError } from "@/lib/services/errors";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { company } = await getCompanyBySlug(slug);
    return { title: company.name };
  } catch {
    return { title: "Company not found" };
  }
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;

  let data: Awaited<ReturnType<typeof getCompanyBySlug>>;
  try {
    data = await getCompanyBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const {
    company,
    owned,
    operated,
    supplied,
    tenanted,
    invested,
    totals,
    geography,
    upcoming,
  } = data;

  return (
    <>
      <PageHeader title={company.name} subtitle={company.description ?? undefined} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{COMPANY_TYPE_LABEL[company.companyType]}</Badge>
        {company.ticker ? <Badge tone="planned">{company.ticker}</Badge> : null}
        {company.headquartersCountry ? (
          <span className="text-[12px] text-fg-dim">
            HQ: {company.headquartersCountry}
          </span>
        ) : null}
        {company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-cyan hover:underline"
          >
            Website <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total associated power"
          value={formatPowerScaled(totals.all.powerMw)}
          hint={`${totals.all.count} project${totals.all.count === 1 ? "" : "s"}, deduped`}
          accent="cyan"
        />
        <StatTile
          label="Owned power"
          value={formatPowerScaled(totals.owned.powerMw)}
          hint={`${totals.owned.count} owned`}
          accent="green"
        />
        <StatTile
          label="Supplied power"
          value={formatPowerScaled(totals.supplied.powerMw)}
          hint={`${totals.supplied.count} as supplier`}
          accent="amber"
        />
        <StatTile
          label="Associated accelerators"
          value={formatCountCompact(totals.all.gpuCount)}
          hint="Best figure per project"
          accent="purple"
        />
      </section>

      <p className="mb-4 text-[11px] leading-relaxed text-fg-muted">
        Exposure counts each project once per relationship category and excludes
        cancelled projects. A company that both owns and supplies a site is not
        double-counted in the total.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Projects owned</PanelTitle>
            <span className="num text-[11px] text-fg-muted">{owned.length}</span>
          </PanelHeader>
          <PanelBody className="pt-0">
            <ProjectMiniList
              projects={owned}
              emptyText="No projects owned by this company."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Geographic exposure</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList
              rows={geography.map((g) => ({
                key: g.country,
                label: g.country,
                value: g.powerMw,
                display: formatPowerScaled(g.powerMw),
              }))}
              valueLabel="Associated MW"
              emptyText="No projects linked."
            />
          </PanelBody>
        </Panel>

        {operated.length > 0 ? (
          <Panel className="lg:col-span-2">
            <PanelHeader>
              <PanelTitle>Projects operated or developed</PanelTitle>
            </PanelHeader>
            <PanelBody className="pt-0">
              <ProjectMiniList projects={operated} />
            </PanelBody>
          </Panel>
        ) : null}

        {supplied.length > 0 ? (
          <Panel className="lg:col-span-2">
            <PanelHeader>
              <PanelTitle>Projects supplied</PanelTitle>
            </PanelHeader>
            <PanelBody className="p-0">
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Project</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Power</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplied.map(({ project, role }) => (
                      <Tr key={`${project.id}-${role}`}>
                        <Td>
                          <Link
                            href={`/projects/${project.slug}`}
                            className="text-fg hover:text-cyan"
                          >
                            {project.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge tone="neutral">
                            {PROJECT_COMPANY_ROLE_LABEL[role]}
                          </Badge>
                        </Td>
                        <Td>
                          <StatusBadge status={project.status} />
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {formatPowerScaled(
                            project.confirmedPowerMw ?? project.estimatedPowerMw,
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader>
            <PanelTitle>Upcoming timeline</PanelTitle>
          </PanelHeader>
          <PanelBody className="pt-0">
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-xs text-fg-muted">
                No dated projects still to open.
              </p>
            ) : (
              <ul className="divide-y divide-[#1b1b1b]">
                {upcoming.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/projects/${p.slug}`}
                      className="min-w-0 truncate text-[13px] text-fg hover:text-cyan"
                    >
                      {p.name}
                    </Link>
                    <span className="num shrink-0 text-[12px] text-fg-dim">
                      {formatMonthYear(p.expectedOpeningDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        {tenanted.length > 0 || invested.length > 0 ? (
          <Panel className="lg:col-span-3">
            <PanelHeader>
              <PanelTitle>Other relationships</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="eyebrow mb-2">Tenant ({formatCount(tenanted.length)})</p>
                <ProjectMiniList projects={tenanted} emptyText="None." />
              </div>
              <div>
                <p className="eyebrow mb-2">
                  Investor ({formatCount(invested.length)})
                </p>
                <ProjectMiniList projects={invested} emptyText="None." />
              </div>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
