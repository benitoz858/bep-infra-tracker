import type { Metadata } from "next";
import Link from "next/link";

import {
  CapacityByYearChart,
  GroupedBarChart,
  MixChart,
  StatusChart,
} from "@/components/analytics/charts";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { COMPANY_TYPE_LABEL, PROJECT_STATUS_META } from "@/lib/domain";
import { formatCount, formatCountCompact, formatPowerScaled } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import {
  getCapacityByYear,
  getCoolingMix,
  getPlatformMix,
  getPowerByCountry,
  getPowerByOwner,
  getPowerSourceMix,
  getStatusBreakdown,
} from "@/lib/services/analytics";
import {
  getPublicCompanyExposure,
  getSupplierExposure,
} from "@/lib/services/companies";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireUser();

  const [
    byYear,
    byCountry,
    byOwner,
    statuses,
    powerMix,
    coolingMix,
    platformMix,
    suppliers,
    publicExposure,
  ] = await Promise.all([
    getCapacityByYear(),
    getPowerByCountry(14),
    getPowerByOwner(14),
    getStatusBreakdown(),
    getPowerSourceMix(8),
    getCoolingMix(8),
    getPlatformMix(8),
    getSupplierExposure(),
    getPublicCompanyExposure(),
  ]);

  const statusData = statuses
    .map((s) => ({
      label: PROJECT_STATUS_META[s.status].label,
      count: s.count,
      tone: PROJECT_STATUS_META[s.status].tone,
    }))
    .filter((s) => s.count > 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Portfolio-level rollups across the tracked universe."
      />

      <div className="mb-5 rounded-lg border border-[#5a4400] bg-[#2b1f00] px-4 py-2.5">
        <p className="text-[12px] leading-relaxed text-amber">
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Read this first —{" "}
          </span>
          every total on this page mixes confirmed disclosures with analyst estimates,
          using the best available figure per project. Cancelled projects are excluded
          from capacity totals. Seeded demo projects are included, so treat absolute
          levels as illustrative until the demo rows are cleared. Per-claim provenance
          is on each project&apos;s{" "}
          <Link href="/projects" className="underline">
            evidence table
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Capacity by opening year — announced vs operational</PanelTitle>
            <span className="text-[11px] text-fg-muted">
              The gap is pipeline not yet energised
            </span>
          </PanelHeader>
          <PanelBody>
            <CapacityByYearChart data={byYear} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power by country</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <GroupedBarChart data={byCountry} metric="power" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power by owner</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <GroupedBarChart data={byOwner} metric="power" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Projects by status</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <StatusChart data={statusData} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Accelerators by platform</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <GroupedBarChart data={platformMix} metric="gpus" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power-source mix</PanelTitle>
            <span className="text-[11px] text-fg-muted">By project count</span>
          </PanelHeader>
          <PanelBody>
            <MixChart data={powerMix} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Cooling-technology mix</PanelTitle>
            <span className="text-[11px] text-fg-muted">By project count</span>
          </PanelHeader>
          <PanelBody>
            <MixChart data={coolingMix} />
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Public-company exposure</PanelTitle>
            <span className="text-[11px] text-fg-muted">
              Ticker-carrying names, by associated MW
            </span>
          </PanelHeader>
          <PanelBody className="p-0">
            {publicExposure.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-fg-muted">
                No ticker-carrying companies linked to projects.
              </p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Company</Th>
                      <Th>Ticker</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Projects</Th>
                      <Th className="text-right">Owned MW</Th>
                      <Th className="text-right">Other-role MW</Th>
                      <Th className="text-right">Total MW</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicExposure.map((c) => (
                      <Tr key={c.id}>
                        <Td>
                          <Link
                            href={`/companies/${c.slug}`}
                            className="text-fg hover:text-cyan"
                          >
                            {c.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge tone="planned">{c.ticker}</Badge>
                        </Td>
                        <Td className="text-fg-dim">
                          {COMPANY_TYPE_LABEL[c.companyType]}
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {formatCount(c.projectCount)}
                        </Td>
                        <Td className="num text-right text-green">
                          {formatPowerScaled(c.ownedMw)}
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {formatPowerScaled(c.linkedMw)}
                        </Td>
                        <Td className="num text-right font-semibold text-fg">
                          {formatPowerScaled(c.totalMw)}
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
            <PanelTitle>Supplier exposure</PanelTitle>
            <span className="text-[11px] text-fg-muted">
              Vendors by the capacity they appear on
            </span>
          </PanelHeader>
          <PanelBody className="p-0">
            {suppliers.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-fg-muted">
                No supplier relationships recorded.
              </p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Supplier</Th>
                      <Th>Ticker</Th>
                      <Th>Roles</Th>
                      <Th className="text-right">Projects</Th>
                      <Th className="text-right">Associated MW</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <Tr key={s.id}>
                        <Td>
                          <Link
                            href={`/companies/${s.slug}`}
                            className="text-fg hover:text-cyan"
                          >
                            {s.name}
                          </Link>
                        </Td>
                        <Td className="num text-cyan">{s.ticker ?? "—"}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {s.roles.map((role) => (
                              <Badge key={role} tone="neutral">
                                {role.toLowerCase().replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </Td>
                        <Td className="num text-right text-fg-dim">
                          {formatCount(s.projectCount)}
                        </Td>
                        <Td className="num text-right text-fg">
                          {formatPowerScaled(s.powerMw)}
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
            <PanelTitle>Projects by region</PanelTitle>
          </PanelHeader>
          <PanelBody className="p-0">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Country</Th>
                    <Th className="text-right">Projects</Th>
                    <Th className="text-right">Power</Th>
                    <Th className="text-right">Accelerators</Th>
                  </tr>
                </thead>
                <tbody>
                  {byCountry.map((c) => (
                    <Tr key={c.key}>
                      <Td>
                        <Link
                          href={`/projects?country=${encodeURIComponent(c.key)}`}
                          className="text-fg hover:text-cyan"
                        >
                          {c.label}
                        </Link>
                      </Td>
                      <Td className="num text-right text-fg-dim">
                        {formatCount(c.count)}
                      </Td>
                      <Td className="num text-right text-fg">
                        {formatPowerScaled(c.powerMw)}
                      </Td>
                      <Td className="num text-right text-fg-dim">
                        {formatCountCompact(c.gpuCount)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
