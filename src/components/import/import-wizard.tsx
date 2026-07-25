"use client";

import { AlertTriangle, CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { CommitResult, ImportPreview } from "@/lib/services/import";

const ENTITIES = [
  { value: "projects", label: "Projects" },
  { value: "companies", label: "Companies" },
  { value: "sources", label: "Sources" },
] as const;

type Entity = (typeof ENTITIES)[number]["value"];

export function ImportWizard() {
  const [entity, setEntity] = useState<Entity>("projects");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setCsv(await file.text());
    setPreview(null);
    setResult(null);
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, csv }),
      });
      const body = (await response.json()) as {
        data?: ImportPreview;
        error?: { message: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "Preview failed.");
      }
      setPreview(body.data);
      // Pre-tick clean rows only. A warning row (duplicate, unknown owner) has
      // to be accepted deliberately.
      setAccepted(
        new Set(
          body.data.rows.filter((r) => r.status === "ok").map((r) => r.rowNumber),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/imports?commit=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, csv, acceptedRowNumbers: [...accepted] }),
      });
      const body = (await response.json()) as {
        data?: CommitResult;
        error?: { message: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "Import failed.");
      }
      setResult(body.data);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(rowNumber: number) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>1 · Choose a file</PanelTitle>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/imports/template?entity=${entity}`} download>
              <Download /> {entity} template
            </a>
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="entity">Import type</Label>
              <Select
                id="entity"
                className="mt-1.5 w-auto"
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value as Entity);
                  setPreview(null);
                  setResult(null);
                }}
              >
                {ENTITIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="file">CSV file</Label>
              <input
                id="file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
                className="mt-1.5 block text-[12px] text-fg-dim file:mr-3 file:rounded file:border file:border-line-2 file:bg-panel-2 file:px-2.5 file:py-1.5 file:text-fg"
              />
            </div>

            <Button
              variant="primary"
              disabled={!csv.trim() || busy}
              onClick={() => void runPreview()}
            >
              <Upload /> {busy ? "Checking…" : "Preview"}
            </Button>
          </div>

          <div>
            <Label htmlFor="csv" hint="Or paste CSV directly.">
              CSV content
            </Label>
            <Textarea
              id="csv"
              rows={6}
              className="mt-1.5 font-mono text-[11px]"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
              placeholder="name,owner,project_type,status,country,estimated_power_mw&#10;Example Campus,Microsoft,DATA_CENTER,ANNOUNCED,United States,250"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-fg-muted">
            Leave a cell blank for an unknown value. A blank imports as “not disclosed”;
            entering 0 records a real zero, which is a different claim.
          </p>
        </PanelBody>
      </Panel>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-2.5 text-[12px] text-red"
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Import complete</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-2">
            <p className="text-[13px] text-fg">
              <span className="text-green">{result.created} created</span> ·{" "}
              <span className="text-fg-dim">{result.skipped} skipped</span>
              {result.failed.length > 0 ? (
                <>
                  {" · "}
                  <span className="text-red">{result.failed.length} failed</span>
                </>
              ) : null}
            </p>
            {result.failed.length > 0 ? (
              <ul className="space-y-0.5">
                {result.failed.map((f) => (
                  <li key={f.rowNumber} className="text-[12px] text-red">
                    Row {f.rowNumber}: {f.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      {preview ? (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>2 · Column mapping</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {preview.headers.map((header) => {
                  const field = preview.mapping[header];
                  return (
                    <Badge key={header} tone={field ? "operational" : "inert"}>
                      {header}
                      {field ? ` → ${field}` : " → ignored"}
                    </Badge>
                  );
                })}
              </div>
              {preview.missingRequired.length > 0 ? (
                <p className="text-[12px] text-red">
                  Missing required column(s): {preview.missingRequired.join(", ")}.
                  Nothing can import until the file provides them.
                </p>
              ) : null}
              {preview.unmappedHeaders.length > 0 ? (
                <p className="text-[12px] text-amber">
                  Ignored column(s): {preview.unmappedHeaders.join(", ")}. Rename them
                  to a recognised name if the data matters.
                </p>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>3 · Review rows</PanelTitle>
              <span className="num text-[11px] text-fg-muted">
                {preview.counts.ok} ok · {preview.counts.warning} warning ·{" "}
                {preview.counts.error} error
              </span>
            </PanelHeader>
            <PanelBody className="p-0">
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-8">Import</Th>
                      <Th className="w-12">Row</Th>
                      <Th>Status</Th>
                      <Th>Summary</Th>
                      <Th>Issues</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <Tr key={row.rowNumber}>
                        <Td>
                          <input
                            type="checkbox"
                            className="accent-cyan"
                            aria-label={`Import row ${row.rowNumber}`}
                            disabled={row.status === "error"}
                            checked={accepted.has(row.rowNumber)}
                            onChange={() => toggleRow(row.rowNumber)}
                          />
                        </Td>
                        <Td className="num text-fg-muted">{row.rowNumber}</Td>
                        <Td>
                          {row.status === "ok" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green">
                              <CheckCircle2 className="size-3.5" /> Ready
                            </span>
                          ) : row.status === "warning" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber">
                              <AlertTriangle className="size-3.5" /> Check
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red">
                              <XCircle className="size-3.5" /> Rejected
                            </span>
                          )}
                        </Td>
                        <Td className="max-w-[280px] truncate text-[12px] text-fg-dim">
                          {Object.values(row.raw)
                            .slice(0, 4)
                            .filter(Boolean)
                            .join(" · ")}
                        </Td>
                        <Td className="max-w-[380px]">
                          <ul className="space-y-0.5">
                            {row.issues.map((issue, i) => (
                              <li key={i} className="text-[11px] text-amber">
                                <span className="font-mono">{issue.column}</span>:{" "}
                                {issue.message}
                              </li>
                            ))}
                            {row.duplicateOfRow !== undefined ? (
                              <li className="text-[11px] text-amber">
                                Duplicate of row {row.duplicateOfRow} in this file.
                              </li>
                            ) : null}
                            {row.duplicateOf?.map((d) => (
                              <li key={d.id} className="text-[11px] text-amber">
                                Possible duplicate of{" "}
                                <a
                                  href={`/projects/${d.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan underline"
                                >
                                  {d.name}
                                </a>{" "}
                                ({d.score}%)
                              </li>
                            ))}
                            {row.issues.length === 0 &&
                            !row.duplicateOf &&
                            row.duplicateOfRow === undefined ? (
                              <li className="text-[11px] text-fg-muted">—</li>
                            ) : null}
                          </ul>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </PanelBody>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={accepted.size === 0 || busy}
              onClick={() => void runCommit()}
            >
              {busy ? "Importing…" : `Import ${accepted.size} row(s)`}
            </Button>
            <p className="text-[11px] text-fg-muted">
              Only ticked rows are written. Rejected rows cannot be ticked until the
              file is corrected.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
