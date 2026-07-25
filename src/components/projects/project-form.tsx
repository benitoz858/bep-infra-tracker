"use client";

import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type UseFormRegisterReturn, useFieldArray, useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/misc";
import type { DuplicateCandidate } from "@/lib/services/duplicates";
import {
  CONFIDENCE_OPTIONS,
  METRIC_TYPE_META,
  METRIC_TYPE_OPTIONS,
  PRIMARY_SOURCE_TYPES,
  PROJECT_COMPANY_ROLE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
} from "@/lib/domain";

/** Plain form shape: every field is a string, as HTML inputs produce. */
export type ProjectFormValues = {
  name: string;
  slug: string;
  description: string;
  ownerCompanyId: string;
  projectType: string;
  status: string;
  city: string;
  stateRegion: string;
  country: string;
  latitude: string;
  longitude: string;
  announcementDate: string;
  expectedOpeningDate: string;
  actualOpeningDate: string;
  estimatedPowerMw: string;
  confirmedPowerMw: string;
  estimatedGpuCount: string;
  confirmedGpuCount: string;
  gpuModel: string;
  computePlatform: string;
  estimatedCapexUsd: string;
  confirmedCapexUsd: string;
  squareFeet: string;
  coolingTechnology: string;
  powerSource: string;
  utilityProvider: string;
  confidenceScore: string;
  analystNotes: string;
  lastVerifiedAt: string;
  tagNames: string;
  suppliers: { companyId: string; role: string; notes: string }[];
  sources: {
    id?: string;
    title: string;
    publisher: string;
    url: string;
    publicationDate: string;
    sourceType: string;
    excerpt: string;
    archivedUrl: string;
    reliabilityScore: string;
    isPrimarySource: boolean;
  }[];
  metrics: {
    id?: string;
    metricType: string;
    numericValue: string;
    textValue: string;
    unit: string;
    confidenceLevel: string;
    methodology: string;
    effectiveDate: string;
    sourceId: string;
  }[];
};

export const EMPTY_PROJECT: ProjectFormValues = {
  name: "",
  slug: "",
  description: "",
  ownerCompanyId: "",
  projectType: "DATA_CENTER",
  status: "ANNOUNCED",
  city: "",
  stateRegion: "",
  country: "",
  latitude: "",
  longitude: "",
  announcementDate: "",
  expectedOpeningDate: "",
  actualOpeningDate: "",
  estimatedPowerMw: "",
  confirmedPowerMw: "",
  estimatedGpuCount: "",
  confirmedGpuCount: "",
  gpuModel: "",
  computePlatform: "",
  estimatedCapexUsd: "",
  confirmedCapexUsd: "",
  squareFeet: "",
  coolingTechnology: "",
  powerSource: "",
  utilityProvider: "",
  confidenceScore: "",
  analystNotes: "",
  lastVerifiedAt: "",
  tagNames: "",
  suppliers: [],
  sources: [],
  metrics: [],
};

type CompanyOption = { id: string; name: string; ticker: string | null };

const SECTIONS = [
  "Basic information",
  "Location",
  "Timeline",
  "Power",
  "Compute",
  "Capital expenditure",
  "Building & cooling",
  "Owner & suppliers",
  "Sources",
  "Claims & confidence",
] as const;

export function ProjectForm({
  mode,
  projectId,
  projectSlug,
  defaultValues,
  companies,
}: {
  mode: "create" | "edit";
  projectId?: string;
  projectSlug?: string;
  defaultValues: ProjectFormValues;
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const draftKey = useMemo(
    () => `bep-project-draft:${mode}:${projectId ?? "new"}`,
    [mode, projectId],
  );

  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [acknowledgeDuplicate, setAcknowledgeDuplicate] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<ProjectFormValues>({ defaultValues });

  const suppliers = useFieldArray({ control, name: "suppliers" });
  const sources = useFieldArray({ control, name: "sources" });
  const metrics = useFieldArray({ control, name: "metrics" });

  // ---- Local autosave -----------------------------------------------------
  // Draft lives in localStorage, not the database: an unsaved half-formed
  // project must never appear in the tracker's totals.
  useEffect(() => {
    const stored = window.localStorage.getItem(draftKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { values: ProjectFormValues; at: string };
      reset(parsed.values);
      setDraftRestored(true);
      setDraftSavedAt(parsed.at);
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, reset]);

  const watched = watch();
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      const at = new Date().toISOString();
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ values: getValues(), at }),
      );
      setDraftSavedAt(at);
    }, 800);
    return () => clearTimeout(timer);
  }, [watched, isDirty, draftKey, getValues]);

  function discardDraft() {
    window.localStorage.removeItem(draftKey);
    reset(defaultValues);
    setDraftRestored(false);
    setDraftSavedAt(null);
  }

  // ---- Live duplicate check ----------------------------------------------
  const name = watch("name");
  const country = watch("country");
  const city = watch("city");
  const stateRegion = watch("stateRegion");
  const ownerCompanyId = watch("ownerCompanyId");
  const lastCheck = useRef("");

  const checkDuplicates = useCallback(async () => {
    if (!name?.trim() || !country?.trim()) {
      setDuplicates([]);
      return;
    }
    const key = `${name}|${country}|${city}|${stateRegion}|${ownerCompanyId}`;
    if (key === lastCheck.current) return;
    lastCheck.current = key;

    try {
      const response = await fetch("/api/projects/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          country,
          city: city || null,
          stateRegion: stateRegion || null,
          ownerCompanyId: ownerCompanyId || null,
          excludeProjectId: projectId ?? null,
        }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data: { duplicates: DuplicateCandidate[] };
      };
      setDuplicates(payload.data.duplicates);
    } catch {
      // A failed duplicate check must not block editing; the server re-checks
      // on submit, which is the authoritative gate.
    }
  }, [name, country, city, stateRegion, ownerCompanyId, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => void checkDuplicates(), 600);
    return () => clearTimeout(timer);
  }, [checkDuplicates]);

  // ---- Submit -------------------------------------------------------------
  async function onSubmit(values: ProjectFormValues) {
    setSaving(true);
    setSubmitError(null);
    setServerErrors({});
    setWarnings([]);

    const payload = {
      ...values,
      ownerCompanyId: values.ownerCompanyId || null,
      tagNames: values.tagNames
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      suppliers: values.suppliers.filter((s) => s.companyId),
      sources: values.sources.filter((s) => s.url && s.title),
      metrics: values.metrics.filter((m) => m.metricType),
      acknowledgeDuplicate,
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/projects" : `/api/projects/${projectId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as {
        data?: { project: { slug: string }; warnings: string[] };
        error?: {
          code: string;
          message: string;
          details?: {
            issues?: { path: string; message: string }[];
            duplicates?: DuplicateCandidate[];
          };
        };
      };

      if (!response.ok || !body.data) {
        const issues = body.error?.details?.issues;
        if (issues?.length) {
          setServerErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        }
        if (body.error?.details?.duplicates) {
          setDuplicates(body.error.details.duplicates);
        }
        setSubmitError(body.error?.message ?? "Could not save the project.");
        return;
      }

      // Saved: the draft is no longer needed.
      window.localStorage.removeItem(draftKey);

      if (body.data.warnings.length > 0) {
        // Warnings are informational — the record saved. Show them on the
        // detail page rather than swallowing them.
        setWarnings(body.data.warnings);
        setTimeout(() => router.push(`/projects/${body.data!.project.slug}`), 1800);
        return;
      }

      router.push(`/projects/${body.data.project.slug}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Network error while saving.",
      );
    } finally {
      setSaving(false);
    }
  }

  const err = (path: string): string | undefined => serverErrors[path];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-16">
      {/* Section jump links */}
      <nav
        aria-label="Form sections"
        className="sticky top-[57px] z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 backdrop-blur"
      >
        {SECTIONS.map((section) => (
          <a
            key={section}
            href={`#section-${section.replace(/[^a-z]/gi, "").toLowerCase()}`}
            className="shrink-0 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:bg-panel-2 hover:text-cyan"
          >
            {section}
          </a>
        ))}
      </nav>

      {draftRestored ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#5a4400] bg-[#2b1f00] px-4 py-2.5">
          <AlertTriangle className="size-4 shrink-0 text-amber" />
          <p className="flex-1 text-[12px] text-amber">
            Restored an unsaved local draft
            {draftSavedAt ? ` from ${new Date(draftSavedAt).toLocaleString()}` : ""}.
            Nothing has been written to the database yet.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
            Discard draft
          </Button>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="rounded-lg border border-[#5a4400] bg-[#2b1f00] px-4 py-3">
          <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-amber">
            <AlertTriangle className="size-4" />
            Possible duplicate{duplicates.length === 1 ? "" : "s"} already in the
            database
          </p>
          <ul className="mb-2 space-y-1">
            {duplicates.map((d) => (
              <li key={d.id} className="text-[12px] text-fg-dim">
                <Link
                  href={`/projects/${d.slug}`}
                  target="_blank"
                  className="text-cyan hover:underline"
                >
                  {d.name}
                </Link>{" "}
                — {[d.city, d.stateRegion, d.country].filter(Boolean).join(", ")}
                {d.ownerName ? ` · ${d.ownerName}` : ""}{" "}
                <Badge tone="construction">{d.score}% match</Badge>{" "}
                <span className="text-fg-muted">({d.matchedOn.join(", ")})</span>
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-amber">
            <input
              type="checkbox"
              checked={acknowledgeDuplicate}
              onChange={(e) => setAcknowledgeDuplicate(e.target.checked)}
              className="accent-amber"
            />
            I have reviewed these and this is a distinct project — save anyway
          </label>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-[#5a4400] bg-[#2b1f00] px-4 py-3">
          <p className="mb-1.5 text-[12px] font-medium text-amber">
            Saved with data-quality warnings
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-[12px] text-fg-dim">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-2.5 text-[12px] text-red"
        >
          {submitError}
        </div>
      ) : null}

      {/* ---- Basic information ---- */}
      <Panel id="section-basicinformation">
        <PanelHeader>
          <PanelTitle>Basic information</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name" required>
              Project name
            </Label>
            <Input
              id="name"
              className="mt-1.5"
              aria-invalid={Boolean(errors.name || err("name"))}
              {...register("name", { required: "Project name is required." })}
            />
            <FieldError message={errors.name?.message ?? err("name")} />
          </div>

          <div>
            <Label htmlFor="projectType" required>
              Project type
            </Label>
            <Select id="projectType" className="mt-1.5" {...register("projectType")}>
              {PROJECT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="status" required>
              Status
            </Label>
            <Select id="status" className="mt-1.5" {...register("status")}>
              {PROJECT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={err("status")} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              className="mt-1.5"
              {...register("description")}
            />
          </div>

          <div>
            <Label htmlFor="tagNames" hint="Comma separated. Created if new.">
              Tags
            </Label>
            <Input
              id="tagNames"
              className="mt-1.5"
              placeholder="NVIDIA, liquid cooling, nuclear"
              {...register("tagNames")}
            />
          </div>

          <div>
            <Label htmlFor="slug" hint="Leave blank to generate from the name.">
              URL slug
            </Label>
            <Input id="slug" className="mt-1.5" {...register("slug")} />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Location ---- */}
      <Panel id="section-location">
        <PanelHeader>
          <PanelTitle>Location</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" className="mt-1.5" {...register("city")} />
          </div>
          <div>
            <Label htmlFor="stateRegion">State / region</Label>
            <Input id="stateRegion" className="mt-1.5" {...register("stateRegion")} />
          </div>
          <div>
            <Label htmlFor="country" required>
              Country
            </Label>
            <Input
              id="country"
              className="mt-1.5"
              aria-invalid={Boolean(errors.country || err("country"))}
              {...register("country", { required: "Country is required." })}
            />
            <FieldError message={errors.country?.message ?? err("country")} />
          </div>
          <div>
            <Label htmlFor="latitude" hint="Required for the map. Decimal degrees.">
              Latitude
            </Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              className="mt-1.5"
              {...register("latitude")}
            />
            <FieldError message={err("latitude")} />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              className="mt-1.5"
              {...register("longitude")}
            />
            <FieldError message={err("longitude")} />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Timeline ---- */}
      <Panel id="section-timeline">
        <PanelHeader>
          <PanelTitle>Timeline</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="announcementDate">Announcement date</Label>
            <Input
              id="announcementDate"
              type="date"
              className="mt-1.5"
              {...register("announcementDate")}
            />
          </div>
          <div>
            <Label htmlFor="expectedOpeningDate">Expected opening</Label>
            <Input
              id="expectedOpeningDate"
              type="date"
              className="mt-1.5"
              {...register("expectedOpeningDate")}
            />
            <FieldError message={err("expectedOpeningDate")} />
          </div>
          <div>
            <Label
              htmlFor="actualOpeningDate"
              hint="Only valid once status is Operational or Partially operational."
            >
              Actual opening
            </Label>
            <Input
              id="actualOpeningDate"
              type="date"
              className="mt-1.5"
              {...register("actualOpeningDate")}
            />
            <FieldError message={err("actualOpeningDate")} />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Power ---- */}
      <Panel id="section-power">
        <PanelHeader>
          <PanelTitle>Power</PanelTitle>
          <span className="text-[11px] text-fg-muted">
            Leave a field blank when unknown — never enter 0
          </span>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <EstimatedConfirmedPair
            label="Power (MW)"
            estimatedProps={register("estimatedPowerMw")}
            confirmedProps={register("confirmedPowerMw")}
            estimatedError={err("estimatedPowerMw")}
            confirmedError={err("confirmedPowerMw")}
            idBase="PowerMw"
          />
          <div>
            <Label htmlFor="powerSource">Power source</Label>
            <Input
              id="powerSource"
              className="mt-1.5"
              placeholder="Grid, on-site gas, nuclear PPA…"
              {...register("powerSource")}
            />
          </div>
          <div>
            <Label htmlFor="utilityProvider">Utility provider</Label>
            <Input
              id="utilityProvider"
              className="mt-1.5"
              {...register("utilityProvider")}
            />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Compute ---- */}
      <Panel id="section-compute">
        <PanelHeader>
          <PanelTitle>Compute</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <EstimatedConfirmedPair
            label="Accelerator count"
            estimatedProps={register("estimatedGpuCount")}
            confirmedProps={register("confirmedGpuCount")}
            estimatedError={err("estimatedGpuCount")}
            confirmedError={err("confirmedGpuCount")}
            idBase="GpuCount"
            step="1"
          />
          <div>
            <Label htmlFor="gpuModel">GPU / accelerator model</Label>
            <Input
              id="gpuModel"
              className="mt-1.5"
              placeholder="NVIDIA GB200 NVL72"
              {...register("gpuModel")}
            />
          </div>
          <div>
            <Label htmlFor="computePlatform">Compute platform</Label>
            <Input
              id="computePlatform"
              className="mt-1.5"
              placeholder="NVIDIA Blackwell, AWS Trainium, Google TPU…"
              {...register("computePlatform")}
            />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Capex ---- */}
      <Panel id="section-capitalexpenditure">
        <PanelHeader>
          <PanelTitle>Capital expenditure</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <EstimatedConfirmedPair
            label="Capex (USD)"
            estimatedProps={register("estimatedCapexUsd")}
            confirmedProps={register("confirmedCapexUsd")}
            estimatedError={err("estimatedCapexUsd")}
            confirmedError={err("confirmedCapexUsd")}
            idBase="CapexUsd"
          />
        </PanelBody>
      </Panel>

      {/* ---- Building ---- */}
      <Panel id="section-buildingcooling">
        <PanelHeader>
          <PanelTitle>Building &amp; cooling</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="squareFeet">Floor area (sq ft)</Label>
            <Input
              id="squareFeet"
              type="number"
              step="1"
              className="mt-1.5"
              {...register("squareFeet")}
            />
            <FieldError message={err("squareFeet")} />
          </div>
          <div>
            <Label htmlFor="coolingTechnology">Cooling technology</Label>
            <Input
              id="coolingTechnology"
              className="mt-1.5"
              placeholder="Direct-to-chip liquid, immersion, air…"
              {...register("coolingTechnology")}
            />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Owner & suppliers ---- */}
      <Panel id="section-ownersuppliers">
        <PanelHeader>
          <PanelTitle>Owner &amp; suppliers</PanelTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              suppliers.append({ companyId: "", role: "GPU_SUPPLIER", notes: "" })
            }
          >
            <Plus /> Add supplier
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="max-w-md">
            <Label htmlFor="ownerCompanyId" hint="The company that owns the asset.">
              Owner
            </Label>
            <Select
              id="ownerCompanyId"
              className="mt-1.5"
              {...register("ownerCompanyId")}
            >
              <option value="">Unattributed</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.ticker ? ` (${c.ticker})` : ""}
                </option>
              ))}
            </Select>
          </div>

          {suppliers.fields.length === 0 ? (
            <p className="text-xs text-fg-muted">
              No suppliers linked. Add the GPU, server, cooling, power and construction
              partners you can source.
            </p>
          ) : (
            <ul className="space-y-2">
              {suppliers.fields.map((field, index) => (
                <li
                  key={field.id}
                  className="grid gap-2 rounded border border-line-2 bg-panel-2 p-2 md:grid-cols-[1fr_1fr_2fr_auto]"
                >
                  <Select
                    aria-label={`Supplier ${index + 1} company`}
                    {...register(`suppliers.${index}.companyId`)}
                  >
                    <option value="">Choose company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Supplier ${index + 1} role`}
                    {...register(`suppliers.${index}.role`)}
                  >
                    {PROJECT_COMPANY_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`Supplier ${index + 1} notes`}
                    placeholder="Notes"
                    {...register(`suppliers.${index}.notes`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove supplier ${index + 1}`}
                    onClick={() => suppliers.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {/* ---- Sources ---- */}
      <Panel id="section-sources">
        <PanelHeader>
          <PanelTitle>Sources</PanelTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              sources.append({
                title: "",
                publisher: "",
                url: "",
                publicationDate: "",
                sourceType: "NEWS_ARTICLE",
                excerpt: "",
                archivedUrl: "",
                reliabilityScore: "",
                isPrimarySource: false,
              })
            }
          >
            <Plus /> Add source
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {sources.fields.length === 0 ? (
            <p className="text-xs text-fg-muted">
              No sources. A project with no evidence goes straight into the verification
              queue.
            </p>
          ) : (
            sources.fields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-2 rounded border border-line-2 bg-panel-2 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Source {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove source ${index + 1}`}
                    onClick={() => sources.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    aria-label={`Source ${index + 1} title`}
                    placeholder="Title"
                    {...register(`sources.${index}.title`)}
                  />
                  <Input
                    aria-label={`Source ${index + 1} publisher`}
                    placeholder="Publisher"
                    {...register(`sources.${index}.publisher`)}
                  />
                  <Input
                    aria-label={`Source ${index + 1} URL`}
                    placeholder="https://…"
                    className="md:col-span-2"
                    {...register(`sources.${index}.url`)}
                  />
                  <Select
                    aria-label={`Source ${index + 1} type`}
                    {...register(`sources.${index}.sourceType`)}
                  >
                    {SOURCE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="date"
                    aria-label={`Source ${index + 1} publication date`}
                    {...register(`sources.${index}.publicationDate`)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Reliability 0–100"
                    aria-label={`Source ${index + 1} reliability score`}
                    {...register(`sources.${index}.reliabilityScore`)}
                  />
                  <label className="flex items-center gap-2 text-[12px] text-fg-dim">
                    <input
                      type="checkbox"
                      className="accent-cyan"
                      {...register(`sources.${index}.isPrimarySource`)}
                    />
                    Primary source
                  </label>
                  <Textarea
                    rows={2}
                    className="md:col-span-2"
                    placeholder="Excerpt — quote the sentence that supports the claim"
                    aria-label={`Source ${index + 1} excerpt`}
                    {...register(`sources.${index}.excerpt`)}
                  />
                </div>
                <FieldError message={err(`sources.${index}.url`)} />
              </div>
            ))
          )}
          <p className="text-[11px] text-fg-muted">
            Primary source types are {PRIMARY_SOURCE_TYPES.length} of the available
            options — company statements, filings and permits.
          </p>
        </PanelBody>
      </Panel>

      {/* ---- Claims ---- */}
      <Panel id="section-claimsconfidence">
        <PanelHeader>
          <PanelTitle>Claims &amp; confidence</PanelTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              metrics.append({
                metricType: "POWER_MW",
                numericValue: "",
                textValue: "",
                unit: "MW",
                confidenceLevel: "ESTIMATED",
                methodology: "",
                effectiveDate: "",
                sourceId: "",
              })
            }
          >
            <Plus /> Add claim
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {metrics.fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-2 rounded border border-line-2 bg-panel-2 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="eyebrow">Claim {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove claim ${index + 1}`}
                  onClick={() => metrics.remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <Select
                  aria-label={`Claim ${index + 1} metric type`}
                  {...register(`metrics.${index}.metricType`)}
                >
                  {METRIC_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="any"
                  placeholder="Value"
                  aria-label={`Claim ${index + 1} value`}
                  {...register(`metrics.${index}.numericValue`)}
                />
                <Input
                  placeholder="Unit"
                  aria-label={`Claim ${index + 1} unit`}
                  {...register(`metrics.${index}.unit`)}
                />
                <Select
                  aria-label={`Claim ${index + 1} confidence`}
                  {...register(`metrics.${index}.confidenceLevel`)}
                >
                  {CONFIDENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={`Claim ${index + 1} source`}
                  className="md:col-span-2"
                  {...register(`metrics.${index}.sourceId`)}
                >
                  <option value="">No source (estimate only)</option>
                  {watch("sources").map((s, sourceIndex) => (
                    <option
                      key={s.id ?? `new:${sourceIndex}`}
                      value={s.id ?? `new:${sourceIndex}`}
                    >
                      {s.title || s.url || `Source ${sourceIndex + 1}`}
                    </option>
                  ))}
                </Select>
                <Input
                  type="date"
                  aria-label={`Claim ${index + 1} effective date`}
                  {...register(`metrics.${index}.effectiveDate`)}
                />
                <Input
                  placeholder="Text value (if not numeric)"
                  aria-label={`Claim ${index + 1} text value`}
                  {...register(`metrics.${index}.textValue`)}
                />
                <Textarea
                  rows={2}
                  className="md:col-span-4"
                  placeholder="Methodology — how this number was derived. Required reading for any estimate."
                  aria-label={`Claim ${index + 1} methodology`}
                  {...register(`metrics.${index}.methodology`)}
                />
              </div>
              <FieldError message={err(`metrics.${index}.sourceId`)} />
              <p className="text-[11px] text-fg-muted">
                A claim marked Confirmed must cite a source.{" "}
                {METRIC_TYPE_META[
                  (watch(`metrics.${index}.metricType`) ??
                    "OTHER") as keyof typeof METRIC_TYPE_META
                ]?.defaultUnit
                  ? `Default unit: ${
                      METRIC_TYPE_META[
                        watch(
                          `metrics.${index}.metricType`,
                        ) as keyof typeof METRIC_TYPE_META
                      ].defaultUnit
                    }.`
                  : ""}
              </p>
            </div>
          ))}

          <div className="grid gap-4 border-t border-line pt-3 md:grid-cols-3">
            <div>
              <Label
                htmlFor="confidenceScore"
                hint="0–100. Justify 80+ with two or more sources."
              >
                Project confidence score
              </Label>
              <Input
                id="confidenceScore"
                type="number"
                min={0}
                max={100}
                className="mt-1.5"
                {...register("confidenceScore")}
              />
              <FieldError message={err("confidenceScore")} />
            </div>
            <div>
              <Label htmlFor="lastVerifiedAt">Last verified</Label>
              <Input
                id="lastVerifiedAt"
                type="date"
                className="mt-1.5"
                {...register("lastVerifiedAt")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="analystNotes">Analyst notes</Label>
            <Textarea
              id="analystNotes"
              rows={4}
              className="mt-1.5"
              {...register("analystNotes")}
            />
          </div>
        </PanelBody>
      </Panel>

      {/* ---- Actions ---- */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Button type="submit" variant="primary" disabled={saving}>
          <Save />{" "}
          {saving ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={projectSlug ? `/projects/${projectSlug}` : "/projects"}>
            Cancel
          </Link>
        </Button>
        {draftSavedAt ? (
          <span className="text-[11px] text-fg-muted">
            Draft autosaved locally at {new Date(draftSavedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The estimated/confirmed pair. Presented side by side rather than as one field
 * with a toggle, because a project legitimately has both at once — a confirmed
 * first phase and an estimate for full build — and the detail page shows both.
 */
function EstimatedConfirmedPair({
  label,
  idBase,
  estimatedProps,
  confirmedProps,
  estimatedError,
  confirmedError,
  step = "any",
}: {
  label: string;
  idBase: string;
  estimatedProps: UseFormRegisterReturn;
  confirmedProps: UseFormRegisterReturn;
  estimatedError?: string;
  confirmedError?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`estimated${idBase}`}>{label} — estimated</Label>
        <Input
          id={`estimated${idBase}`}
          type="number"
          step={step}
          min={0}
          className="mt-1.5"
          {...estimatedProps}
        />
        <FieldError message={estimatedError} />
      </div>
      <div>
        <Label htmlFor={`confirmed${idBase}`}>
          <span className="text-green">{label} — confirmed</span>
        </Label>
        <Input
          id={`confirmed${idBase}`}
          type="number"
          step={step}
          min={0}
          className="mt-1.5 border-[#3d5f00]"
          {...confirmedProps}
        />
        <FieldError message={confirmedError} />
      </div>
    </div>
  );
}
