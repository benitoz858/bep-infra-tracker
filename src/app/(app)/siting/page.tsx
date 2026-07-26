import type { Metadata } from "next";
import Link from "next/link";

import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import {
  BINDING_LEVEL_META,
  GRID_REGION_LABEL,
  JURISDICTION_LEVEL_LABEL,
  RESTRICTION_SCOPE_LABEL,
  RESTRICTION_STATUS_META,
} from "@/lib/domain";
import { formatCount, formatDate, formatPowerScaled } from "@/lib/format";
import { getSessionUser } from "@/lib/permissions";
import {
  getAdoptionBaseRate,
  getExpiryCalendar,
  getExposureByGridRegion,
  getExposureByOwner,
  getExposureByProject,
  getSitingSummary,
  listRestrictions,
} from "@/lib/services/siting";

export const metadata: Metadata = { title: "Siting risk" };

export default async function SitingPage() {
  await getSessionUser();

  const [summary, byRegion, byOwner, exposure, expiries, baseRate, restrictions] =
    await Promise.all([
      getSitingSummary(),
      getExposureByGridRegion(),
      getExposureByOwner(),
      getExposureByProject(),
      getExpiryCalendar(),
      getAdoptionBaseRate(),
      listRestrictions(),
    ]);

  return (
    <>
      <PageHeader
        title="Siting risk"
        subtitle="How much announced capacity is actually blocked — not how many ordinances exist. Only restrictions that genuinely bind (conditional and above) and are in force right now count toward the figure, and each project is counted once at its largest affected capacity."
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Capacity at risk"
          value={formatPowerScaled(summary.atRiskMw)}
          hint={`${summary.shareOfPipelinePct}% of tracked pipeline`}
          accent="red"
        />
        <StatTile
          label="Projects affected"
          value={formatCount(summary.projectsAtRisk)}
          hint="Deduplicated"
          accent="amber"
        />
        <StatTile
          label="Live restrictions"
          value={formatCount(summary.liveRestrictions)}
          hint={`${summary.totalRestrictions} tracked in total`}
          accent="plain"
        />
        <StatTile
          label="Live but non-binding"
          value={formatCount(summary.nonBlockingLive)}
          hint="Counted by ordinance trackers, blocks nothing"
          accent="cyan"
        />
        <StatTile
          label="Expiring in 12 months"
          value={formatCount(summary.expiringWithin12Months)}
          hint="Capacity due to be released"
          accent="green"
        />
      </section>

      <div className="mb-5 rounded-lg border border-line bg-panel px-4 py-3">
        <p className="text-[12px] leading-relaxed text-fg-dim">
          <span className="eyebrow">Why the two counts differ — </span>
          {summary.liveRestrictions} restrictions are in force, but{" "}
          <span className="text-cyan">{summary.nonBlockingLive}</span> of them are
          advisory, proposed or merely procedural: they add process and cost
          without stopping a project. A tracker that counts ordinances reports the
          larger number. This page reports the megawatts.
          {baseRate.adoptionRatePct !== null ? (
            <>
              {" "}Of the {baseRate.decided} restrictions that reached a decision,{" "}
              <span className="text-fg">{baseRate.adoptionRatePct}%</span> were
              adopted ({baseRate.rejected} rejected, {baseRate.pending} still
              pending).
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Capacity at risk by grid region</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList
              rows={byRegion.map((r) => ({
                key: r.key,
                label:
                  r.key === "UNASSIGNED"
                    ? "Not assigned"
                    : (GRID_REGION_LABEL[r.key as keyof typeof GRID_REGION_LABEL] ?? r.key),
                value: r.mw,
                display: formatPowerScaled(r.mw),
                color: "#FF4444",
              }))}
              valueLabel="MW at risk"
              emptyText="No capacity currently blocked."
            />
            <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
              Restrictions bite through the interconnection queue, so the RTO view
              is the one that maps to transmission exposure.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Capacity at risk by owner</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList
              rows={byOwner.map((o) => ({
                key: o.key,
                label: o.ticker ? `${o.label} (${o.ticker})` : o.label,
                value: o.mw,
                display: formatPowerScaled(o.mw),
                color: "#FFB800",
              }))}
              valueLabel="MW at risk"
              emptyText="No capacity currently blocked."
            />
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Expiry calendar — capacity due to be released</PanelTitle>
            <span className="text-[11px] text-fg-muted">Next 24 months</span>
          </PanelHeader>
          <PanelBody className="p-0">
            {expiries.length === 0 ? (
              <EmptyState
                title="Nothing scheduled to expire"
                description="No live restriction has a published end date in the next two years."
              />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Expires</Th>
                      <Th>Jurisdiction</Th>
                      <Th>Restriction</Th>
                      <Th>Binding</Th>
                      <Th className="text-right">MW released</Th>
                      <Th className="text-right">Projects</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiries.map((e) => (
                      <Tr key={e.id}>
                        <Td className="num whitespace-nowrap">
                          {e.endDateUnpublished ? (
                            <span className="text-amber" title="A time-limited ban with no published end date">
                              Not published
                            </span>
                          ) : (
                            formatDate(e.expiryDate)
                          )}
                        </Td>
                        <Td className="text-fg">{e.jurisdiction}</Td>
                        <Td className="max-w-[320px] text-fg-dim">{e.title}</Td>
                        <Td>
                          <Badge tone={BINDING_LEVEL_META[e.bindingLevel].tone}>
                            {BINDING_LEVEL_META[e.bindingLevel].score} —{" "}
                            {BINDING_LEVEL_META[e.bindingLevel].label}
                          </Badge>
                        </Td>
                        <Td className="num text-right text-green">
                          {formatPowerScaled(e.releasedMw)}
                        </Td>
                        <Td className="num text-right text-fg-dim">{e.projectCount}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <p className="px-4 py-3 text-[11px] leading-relaxed text-fg-muted">
              An expiry is a positive catalyst — capacity returning to the
              pipeline — and nobody publishes a list of them. A time-limited ban
              with no published end date is shown as such rather than being
              treated as indefinite.
            </p>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Affected projects</PanelTitle>
            <span className="num text-[11px] text-fg-muted">{exposure.length}</span>
          </PanelHeader>
          <PanelBody className="p-0">
            {exposure.length === 0 ? (
              <EmptyState title="No projects currently blocked" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Project</Th>
                      <Th>Owner</Th>
                      <Th>Grid region</Th>
                      <Th>Worst binding</Th>
                      <Th className="text-right">Restrictions</Th>
                      <Th className="text-right">MW at risk</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {exposure.map((row) => (
                      <Tr key={row.projectId}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/projects/${row.projectSlug}`}
                              className="font-medium text-fg hover:text-cyan"
                            >
                              {row.projectName}
                            </Link>
                            {row.isDemoData ? <Badge tone="risk">Demo</Badge> : null}
                          </div>
                        </Td>
                        <Td className="text-fg-dim">
                          {row.ownerName ?? "Unattributed"}
                          {row.ownerTicker ? (
                            <span className="num ml-1.5 text-[11px] text-cyan">
                              {row.ownerTicker}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="num text-fg-dim">
                          {row.gridRegion ? GRID_REGION_LABEL[row.gridRegion] : "—"}
                        </Td>
                        <Td>
                          <Badge tone={BINDING_LEVEL_META[row.worstBinding].tone}>
                            {BINDING_LEVEL_META[row.worstBinding].score} —{" "}
                            {BINDING_LEVEL_META[row.worstBinding].label}
                          </Badge>
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {row.restrictionCount}
                        </Td>
                        <Td className="num text-right text-red">
                          {formatPowerScaled(row.atRiskMw)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>All tracked restrictions</PanelTitle>
            <span className="num text-[11px] text-fg-muted">{restrictions.length}</span>
          </PanelHeader>
          <PanelBody className="p-0">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Jurisdiction</Th>
                    <Th>Level</Th>
                    <Th>Restricts</Th>
                    <Th>Binding</Th>
                    <Th>Status</Th>
                    <Th>Enacted</Th>
                    <Th>Expires</Th>
                    <Th className="text-right">Projects</Th>
                  </tr>
                </thead>
                <tbody>
                  {restrictions.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">{r.jurisdiction}</span>
                          {r.isDemoData ? <Badge tone="risk">Demo</Badge> : null}
                        </div>
                        <p className="max-w-[360px] text-[11px] text-fg-muted">
                          {r.title}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap text-fg-dim">
                        {JURISDICTION_LEVEL_LABEL[r.level]}
                      </Td>
                      <Td className="whitespace-nowrap text-fg-dim">
                        {RESTRICTION_SCOPE_LABEL[r.scope]}
                      </Td>
                      <Td>
                        <Badge tone={BINDING_LEVEL_META[r.bindingLevel].tone}>
                          {BINDING_LEVEL_META[r.bindingLevel].score} —{" "}
                          {BINDING_LEVEL_META[r.bindingLevel].label}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={RESTRICTION_STATUS_META[r.status].tone}>
                          {RESTRICTION_STATUS_META[r.status].label}
                        </Badge>
                      </Td>
                      <Td className="num whitespace-nowrap text-fg-dim">
                        {formatDate(r.enactedDate)}
                      </Td>
                      <Td className="num whitespace-nowrap text-fg-dim">
                        {formatDate(r.expiryDate)}
                      </Td>
                      <Td className="num text-right text-fg-dim">
                        {r._count.projects}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </PanelBody>
        </Panel>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-fg-muted">
        Restrictions are linked to projects explicitly by an analyst, never
        inferred from matching location text. A wrong inference would silently
        move the headline figure, which is the one number this page exists to
        produce.
      </p>
    </>
  );
}
