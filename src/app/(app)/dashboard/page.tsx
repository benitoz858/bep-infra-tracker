import type { Metadata } from "next";
import Link from "next/link";

import { BarList } from "@/components/bar-list";
import { PageHeader } from "@/components/page-header";
import { ProjectMiniList } from "@/components/project-mini-list";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PROJECT_STATUS_META, PROJECT_STATUS_ORDER, statusHex } from "@/lib/domain";
import {
  formatCount,
  formatCountCompact,
  formatPowerScaled,
  formatUsdCompact,
} from "@/lib/format";
import { can, requireUser } from "@/lib/permissions";
import {
  getDashboardSummary,
  getPowerByCountry,
  getPowerByOwner,
  getRecentProjects,
  getRecentlyUpdatedProjects,
  getStatusBreakdown,
} from "@/lib/services/analytics";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, statuses, byCountry, byOwner, recent, updated] = await Promise.all([
    getDashboardSummary(),
    getStatusBreakdown(),
    getPowerByCountry(10),
    getPowerByOwner(10),
    getRecentProjects(6),
    getRecentlyUpdatedProjects(6),
  ]);

  const statusRows = PROJECT_STATUS_ORDER.map((status) => {
    const row = statuses.find((s) => s.status === status);
    return {
      key: status,
      label: PROJECT_STATUS_META[status].label,
      value: row?.count ?? 0,
      display: formatCount(row?.count ?? 0),
      color: statusHex(status),
    };
  }).filter((r) => r.value > 0);

  const confirmedShare =
    summary.announcedPowerMw > 0
      ? Math.round((summary.confirmedPowerMw / summary.announcedPowerMw) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Global AI compute, power and supply-chain intelligence. Capacity totals combine confirmed disclosures with analyst estimates — the confirmed subtotal is shown separately on every power figure."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Open database</Link>
            </Button>
            {can(user.role, "record:create") ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/projects/new">Add project</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {summary.demoDataCount > 0 ? (
        <div className="mb-5 rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-2.5">
          <p className="text-[12px] leading-relaxed text-red">
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Demo data —{" "}
            </span>
            {summary.demoDataCount} of {summary.totalProjects} projects are illustrative
            seed records, not research output. Their figures are invented and are
            included in the totals below. Clear them with{" "}
            <code className="font-mono text-[11px]">npm run db:reset</code>.
          </p>
        </div>
      ) : null}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile
          label="Projects tracked"
          value={formatCount(summary.totalProjects)}
          hint={`${summary.liveProjects} live`}
          accent="plain"
        />
        <StatTile
          label="Announced power"
          value={formatPowerScaled(summary.announcedPowerMw)}
          hint="Best figure per project"
          accent="cyan"
        />
        <StatTile
          label="Confirmed power"
          value={formatPowerScaled(summary.confirmedPowerMw)}
          hint={`${confirmedShare}% of announced`}
          accent="green"
        />
        <StatTile
          label="Accelerators"
          value={formatCountCompact(summary.estimatedGpuCount)}
          hint={`${formatCountCompact(summary.confirmedGpuCount)} confirmed`}
          accent="purple"
        />
        <StatTile
          label="Announced capex"
          value={formatUsdCompact(summary.announcedCapexUsd)}
          hint={`${summary.countriesCovered} countries`}
          accent="amber"
        />
        <StatTile
          label="Needs verification"
          value={formatCount(summary.needsVerificationCount)}
          hint="Open review queue"
          accent={summary.needsVerificationCount > 0 ? "red" : "green"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader>
            <PanelTitle>Projects by status</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList rows={statusRows} valueLabel="Projects" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power by country</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList
              rows={byCountry.map((r) => ({
                key: r.key,
                label: r.label,
                value: r.powerMw,
                display: formatPowerScaled(r.powerMw),
              }))}
              valueLabel="Announced MW"
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power by owner</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <BarList
              rows={byOwner.map((r) => ({
                key: r.key,
                label: r.label,
                value: r.powerMw,
                display: formatPowerScaled(r.powerMw),
              }))}
              valueLabel="Announced MW"
            />
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Recently added</PanelTitle>
            <Link
              href="/projects?sort=createdAt.desc"
              className="text-[11px] text-cyan hover:underline"
            >
              View all
            </Link>
          </PanelHeader>
          <PanelBody className="pt-1">
            <ProjectMiniList projects={recent} timestampOf={(p) => p.createdAt} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Recently updated</PanelTitle>
          </PanelHeader>
          <PanelBody className="pt-1">
            <ProjectMiniList projects={updated} timestampOf={(p) => p.updatedAt} />
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
