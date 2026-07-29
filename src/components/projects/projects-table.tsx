"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_LABEL } from "@/lib/domain";
import type { ProjectType } from "@/generated/prisma/enums";
import {
  formatCount,
  formatDate,
  formatLocation,
  formatPowerScaled,
  formatRelative,
  NOT_DISCLOSED,
} from "@/lib/format";
import type { NumericLike } from "@/lib/format";
import { buildQuery, nextSort } from "@/lib/url-state";
import { cn } from "@/lib/utils";
import {
  CREDIBILITY_META,
  POWER_BASIS_META,
  POWER_READINESS_META,
  type CredibilityState,
  type PowerBasis,
  type PowerReadiness,
} from "@/lib/credibility";

export type TableRow = {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  projectType: ProjectType;
  city: string | null;
  stateRegion: string | null;
  country: string;
  estimatedPowerMw: NumericLike;
  confirmedPowerMw: NumericLike;
  estimatedGpuCount: number | null;
  confirmedGpuCount: number | null;
  gpuModel: string | null;
  expectedOpeningDate: Date | null;
  actualOpeningDate: Date | null;
  lastVerifiedAt: Date | null;
  confidenceScore: number | null;
  isDemoData: boolean;
  // Derived in lib/services/projects from the row's own evidence — see
  // lib/credibility. Present on every row, so the table never has to fall back
  // to "not scored".
  credibility: CredibilityState;
  powerReadiness: PowerReadiness;
  powerBasis: PowerBasis;
  ownerCompany: {
    id: string;
    name: string;
    slug: string;
    ticker: string | null;
  } | null;
  _count: { sources: number };
};

type ColumnKey =
  | "project"
  | "owner"
  | "location"
  | "type"
  | "status"
  | "power"
  | "gpus"
  | "gpuModel"
  | "opening"
  | "verified"
  | "credibility"
  | "powerEvidence";

type Column = {
  key: ColumnKey;
  label: string;
  /** Sort field understood by projectQuerySchema, or null if not sortable. */
  sort: string | null;
  /** Cannot be hidden — without it a row has nothing to click through on. */
  always?: boolean;
  numeric?: boolean;
};

const COLUMNS: Column[] = [
  { key: "project", label: "Project", sort: "name", always: true },
  { key: "owner", label: "Owner", sort: null },
  { key: "location", label: "Location", sort: "country" },
  { key: "type", label: "Type", sort: "projectType" },
  { key: "status", label: "Status", sort: "status" },
  { key: "power", label: "Power MW", sort: "powerMw", numeric: true },
  { key: "gpus", label: "GPU count", sort: "gpuCount", numeric: true },
  { key: "gpuModel", label: "GPU model", sort: null },
  { key: "opening", label: "Expected opening", sort: "expectedOpeningDate" },
  { key: "verified", label: "Last verified", sort: "lastVerifiedAt" },
  // Sorting is by the stored legacy score, which is null on researched rows;
  // the displayed value is derived, so the column is not sortable.
  { key: "credibility", label: "Credibility", sort: null },
  { key: "powerEvidence", label: "Power evidence", sort: null },
];

export function ProjectsTable({
  rows,
  total,
  page,
  perPage,
  pageCount,
  canEdit,
}: {
  rows: TableRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = searchParams.get("sort");

  // Column visibility is UI-local rather than URL state: it is a per-analyst
  // preference, not part of the shareable query.
  const hidden = useMemo(
    () => new Set((searchParams.get("hide") ?? "").split(",").filter(Boolean)),
    [searchParams],
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const visible = COLUMNS.filter((c) => c.always || !hidden.has(c.key));

  function push(patch: Parameters<typeof buildQuery>[1]) {
    startTransition(() => {
      router.push(`${pathname}${buildQuery(searchParams.toString(), patch)}`);
    });
  }

  function toggleColumn(key: ColumnKey) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    push({ hide: [...next], page });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  async function runBulk(action: "status" | "tags") {
    setBulkBusy(true);
    setBulkError(null);
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "status"
            ? { projectIds: [...selected], status: bulkStatus }
            : {
                projectIds: [...selected],
                tagNames: bulkTags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              },
        ),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Bulk update failed.");

      setSelected(new Set());
      setBulkStatus("");
      setBulkTags("");
      startTransition(() => router.refresh());
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  // Exports reuse the current query string, so the file matches the view.
  const exportQuery = searchParams.toString();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="num text-[12px] text-fg-dim">
          {formatCount(total)} project{total === 1 ? "" : "s"}
          {total > perPage ? ` · page ${page} of ${pageCount}` : ""}
        </p>

        <div className="relative ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColumnMenu((v) => !v)}
            aria-expanded={showColumnMenu}
          >
            <Columns3 /> Columns
          </Button>

          {showColumnMenu ? (
            <div className="absolute right-0 top-9 z-20 w-56 rounded-md border border-line-2 bg-panel p-2 shadow-xl">
              {COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-panel-2",
                    c.always && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-cyan"
                    disabled={c.always}
                    checked={c.always || !hidden.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          ) : null}

          <Button asChild variant="outline" size="sm">
            <a href={`/api/projects/export?format=csv&${exportQuery}`}>
              <Download /> CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/projects/export?format=json&${exportQuery}`}>
              <Download /> JSON
            </a>
          </Button>
        </div>
      </div>

      {canEdit && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-cyan/40 bg-cyan/5 px-3 py-2">
          <span className="num text-[12px] text-cyan">{selected.size} selected</span>

          <Select
            aria-label="Bulk status"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="w-auto min-w-[170px]"
          >
            <option value="">Set status…</option>
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={!bulkStatus || bulkBusy}
            onClick={() => void runBulk("status")}
          >
            Apply
          </Button>

          <input
            aria-label="Bulk tags, comma separated"
            value={bulkTags}
            onChange={(e) => setBulkTags(e.target.value)}
            placeholder="Add tags (comma separated)"
            className="h-9 min-w-[220px] rounded-md border border-line-2 bg-panel-2 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
          />
          <Button
            size="sm"
            disabled={!bulkTags.trim() || bulkBusy}
            onClick={() => void runBulk("tags")}
          >
            Tag
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>

          {bulkError ? (
            <p role="alert" className="text-[12px] text-red">
              {bulkError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-lg border border-line bg-panel",
          isPending && "opacity-70",
        )}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No projects match these filters"
            description="Loosen a filter, clear the search term, or add the project you were looking for."
            action={
              <Button asChild variant="primary" size="sm">
                <Link href="/projects/new">Add project</Link>
              </Button>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  {canEdit ? (
                    <Th className="w-8">
                      <input
                        type="checkbox"
                        className="accent-cyan"
                        aria-label="Select all rows on this page"
                        checked={allOnPageSelected}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const r of rows) {
                              if (e.target.checked) next.add(r.id);
                              else next.delete(r.id);
                            }
                            return next;
                          })
                        }
                      />
                    </Th>
                  ) : null}
                  {visible.map((c) => (
                    <Th key={c.key} className={c.numeric ? "text-right" : undefined}>
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() => push({ sort: nextSort(currentSort, c.sort!) })}
                          className="inline-flex items-center gap-1 uppercase hover:text-fg"
                        >
                          {c.label}
                          <SortIcon field={c.sort} current={currentSort} />
                        </button>
                      ) : (
                        c.label
                      )}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const power = row.confirmedPowerMw ?? row.estimatedPowerMw;
                  const isConfirmedPower = row.confirmedPowerMw !== null;
                  const gpus = row.confirmedGpuCount ?? row.estimatedGpuCount;
                  const isConfirmedGpus = row.confirmedGpuCount !== null;

                  return (
                    <Tr key={row.id}>
                      {canEdit ? (
                        <Td>
                          <input
                            type="checkbox"
                            className="accent-cyan"
                            aria-label={`Select ${row.name}`}
                            checked={selected.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                          />
                        </Td>
                      ) : null}

                      {visible.map((c) => {
                        switch (c.key) {
                          case "project":
                            return (
                              <Td key={c.key}>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/projects/${row.slug}`}
                                    className="font-medium text-fg hover:text-cyan"
                                  >
                                    {row.name}
                                  </Link>
                                  {row.isDemoData ? (
                                    <Badge tone="risk">Demo</Badge>
                                  ) : null}
                                </div>
                              </Td>
                            );
                          case "owner":
                            return (
                              <Td key={c.key} className="whitespace-nowrap">
                                {row.ownerCompany ? (
                                  <Link
                                    href={`/companies/${row.ownerCompany.slug}`}
                                    className="text-fg-dim hover:text-cyan"
                                  >
                                    {row.ownerCompany.name}
                                    {row.ownerCompany.ticker ? (
                                      <span className="num ml-1.5 text-[11px] text-fg-muted">
                                        {row.ownerCompany.ticker}
                                      </span>
                                    ) : null}
                                  </Link>
                                ) : (
                                  <span className="text-fg-muted">Unattributed</span>
                                )}
                              </Td>
                            );
                          case "location":
                            return (
                              <Td key={c.key} className="text-fg-dim">
                                {formatLocation(row)}
                              </Td>
                            );
                          case "type":
                            return (
                              <Td key={c.key} className="whitespace-nowrap text-fg-dim">
                                {PROJECT_TYPE_LABEL[row.projectType]}
                              </Td>
                            );
                          case "status":
                            return (
                              <Td key={c.key}>
                                <StatusBadge status={row.status} />
                              </Td>
                            );
                          case "power":
                            return (
                              <Td
                                key={c.key}
                                className="num text-right whitespace-nowrap"
                              >
                                <span
                                  className={
                                    isConfirmedPower ? "text-green" : "text-fg-dim"
                                  }
                                  title={
                                    isConfirmedPower
                                      ? "Confirmed figure"
                                      : "Analyst estimate"
                                  }
                                >
                                  {formatPowerScaled(power)}
                                </span>
                                {power !== null ? (
                                  <span
                                    className="ml-1.5 font-mono text-[10px] text-fg-muted"
                                    title={`${
                                      isConfirmedPower
                                        ? "Energized capacity"
                                        : "Announced target, not energized"
                                    } · ${POWER_BASIS_META[row.powerBasis].label}`}
                                  >
                                    {isConfirmedPower ? "E" : "A"}
                                    {POWER_BASIS_META[row.powerBasis].short}
                                  </span>
                                ) : null}
                              </Td>
                            );
                          case "gpus":
                            return (
                              <Td
                                key={c.key}
                                className="num text-right whitespace-nowrap"
                              >
                                <span
                                  className={
                                    isConfirmedGpus ? "text-green" : "text-fg-dim"
                                  }
                                  title={
                                    isConfirmedGpus
                                      ? "Confirmed figure"
                                      : "Analyst estimate"
                                  }
                                >
                                  {formatCount(gpus)}
                                </span>
                              </Td>
                            );
                          case "gpuModel":
                            return (
                              <Td key={c.key} className="text-fg-dim">
                                {row.gpuModel ?? (
                                  <span className="text-fg-muted">{NOT_DISCLOSED}</span>
                                )}
                              </Td>
                            );
                          case "opening":
                            return (
                              <Td
                                key={c.key}
                                className="num whitespace-nowrap text-fg-dim"
                              >
                                {formatDate(
                                  row.actualOpeningDate ?? row.expectedOpeningDate,
                                )}
                              </Td>
                            );
                          case "verified":
                            return (
                              <Td key={c.key} className="whitespace-nowrap text-fg-dim">
                                {formatRelative(row.lastVerifiedAt)}
                                <span className="ml-1.5 text-[11px] text-fg-muted">
                                  ({row._count.sources} src)
                                </span>
                              </Td>
                            );
                          case "credibility":
                            return (
                              <Td key={c.key} className="whitespace-nowrap">
                                <Badge tone={CREDIBILITY_META[row.credibility].tone}>
                                  {CREDIBILITY_META[row.credibility].label}
                                </Badge>
                              </Td>
                            );
                          case "powerEvidence":
                            return (
                              <Td key={c.key} className="whitespace-nowrap text-fg-dim">
                                {POWER_READINESS_META[row.powerReadiness].label}
                              </Td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Select
            aria-label="Rows per page"
            value={String(perPage)}
            onChange={(e) => push({ perPage: e.target.value })}
            className="w-auto"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => push({ page: page - 1 })}
            >
              Previous
            </Button>
            <span className="num px-2 text-[12px] text-fg-dim">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => push({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortIcon({ field, current }: { field: string; current: string | null }) {
  const [currentField, dir] = (current ?? "").split(".");
  if (currentField !== field) {
    return <ChevronsUpDown className="size-3 text-fg-muted" />;
  }
  return dir === "asc" ? (
    <ArrowUp className="size-3 text-cyan" />
  ) : (
    <ArrowDown className="size-3 text-cyan" />
  );
}
