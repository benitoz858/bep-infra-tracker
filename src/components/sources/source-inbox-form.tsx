"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/misc";
import {
  CONFIDENCE_OPTIONS,
  METRIC_TYPE_META,
  METRIC_TYPE_OPTIONS,
  PRIMARY_SOURCE_TYPES,
  SOURCE_TYPE_OPTIONS,
} from "@/lib/domain";

type ProjectOption = { id: string; name: string; country: string };

type FormValues = {
  projectId: string;
  url: string;
  title: string;
  publisher: string;
  publicationDate: string;
  sourceType: string;
  excerpt: string;
  archivedUrl: string;
  reliabilityScore: string;
  isPrimarySource: boolean;
  claims: {
    metricType: string;
    numericValue: string;
    textValue: string;
    unit: string;
    confidenceLevel: string;
    methodology: string;
    effectiveDate: string;
  }[];
};

/**
 * The source-inbox workflow: paste a URL, describe the source, attach it to a
 * project, then enter the claims it supports. Each claim becomes a
 * ProjectMetric citing this source.
 *
 * There is no auto-extraction. Every number is typed by the analyst who read
 * the source, which is what makes a CONFIRMED confidence level meaningful.
 */
export function SourceInboxForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [allowDuplicateUrl, setAllowDuplicateUrl] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      projectId: defaultProjectId ?? "",
      url: "",
      title: "",
      publisher: "",
      publicationDate: "",
      sourceType: "NEWS_ARTICLE",
      excerpt: "",
      archivedUrl: "",
      reliabilityScore: "",
      isPrimarySource: false,
      claims: [],
    },
  });

  const claims = useFieldArray({ control, name: "claims" });
  const sourceType = watch("sourceType");

  // Primary-source types are primary by definition; tick the box for the analyst
  // rather than making them remember which types qualify.
  function onSourceTypeChange(value: string) {
    setValue("sourceType", value);
    setValue(
      "isPrimarySource",
      PRIMARY_SOURCE_TYPES.includes(value as (typeof PRIMARY_SOURCE_TYPES)[number]),
    );
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSubmitError(null);
    setServerErrors({});

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          allowDuplicateUrl,
          claims: values.claims.filter(
            (c) => c.numericValue !== "" || c.textValue !== "",
          ),
        }),
      });

      const body = (await response.json()) as {
        data?: { project: { slug: string }; claimCount: number };
        error?: {
          code: string;
          message: string;
          details?: { issues?: { path: string; message: string }[] };
        };
      };

      if (!response.ok || !body.data) {
        if (body.error?.code === "conflict") setDuplicatePrompt(true);
        const issues = body.error?.details?.issues;
        if (issues?.length) {
          setServerErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        }
        setSubmitError(body.error?.message ?? "Could not save the source.");
        return;
      }

      router.push(`/projects/${body.data.project.slug}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  const err = (path: string) => serverErrors[path];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-16">
      {submitError ? (
        <div
          role="alert"
          className="rounded-lg border border-[#5a1a1a] bg-[#2b0e0e] px-4 py-2.5 text-[12px] text-red"
        >
          {submitError}
          {duplicatePrompt ? (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-amber">
              <input
                type="checkbox"
                checked={allowDuplicateUrl}
                onChange={(e) => setAllowDuplicateUrl(e.target.checked)}
                className="accent-amber"
              />
              Add it anyway — this URL genuinely supports a separate claim
            </label>
          ) : null}
        </div>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>1 · The source</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="url" required>
              URL
            </Label>
            <Input
              id="url"
              className="mt-1.5"
              placeholder="https://…"
              autoFocus
              {...register("url", { required: true })}
            />
            <FieldError message={err("url")} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="title" required>
              Title
            </Label>
            <Input
              id="title"
              className="mt-1.5"
              {...register("title", { required: true })}
            />
            <FieldError message={err("title")} />
          </div>

          <div>
            <Label htmlFor="publisher">Publisher</Label>
            <Input id="publisher" className="mt-1.5" {...register("publisher")} />
          </div>

          <div>
            <Label htmlFor="publicationDate">Publication date</Label>
            <Input
              id="publicationDate"
              type="date"
              className="mt-1.5"
              {...register("publicationDate")}
            />
          </div>

          <div>
            <Label htmlFor="sourceType" required>
              Source type
            </Label>
            <Select
              id="sourceType"
              className="mt-1.5"
              value={sourceType}
              onChange={(e) => onSourceTypeChange(e.target.value)}
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label
              htmlFor="reliabilityScore"
              hint="0–100. A filing is near 100; an unattributed blog is low."
            >
              Reliability score
            </Label>
            <Input
              id="reliabilityScore"
              type="number"
              min={0}
              max={100}
              className="mt-1.5"
              {...register("reliabilityScore")}
            />
            <FieldError message={err("reliabilityScore")} />
          </div>

          <div className="md:col-span-2">
            <Label
              htmlFor="excerpt"
              hint="Quote the sentence that supports the claim, so a later reader need not re-open the source."
            >
              Excerpt
            </Label>
            <Textarea
              id="excerpt"
              rows={3}
              className="mt-1.5"
              {...register("excerpt")}
            />
          </div>

          <div>
            <Label
              htmlFor="archivedUrl"
              hint="Wayback or similar, in case the original moves."
            >
              Archived URL
            </Label>
            <Input id="archivedUrl" className="mt-1.5" {...register("archivedUrl")} />
          </div>

          <label className="flex items-center gap-2 self-end text-[12px] text-fg-dim">
            <input
              type="checkbox"
              className="accent-cyan"
              {...register("isPrimarySource")}
            />
            Primary source (the owner&apos;s own statement or a regulatory document)
          </label>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>2 · Attach to a project</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <div className="max-w-xl">
            <Label htmlFor="projectId" required>
              Project
            </Label>
            <Select
              id="projectId"
              className="mt-1.5"
              {...register("projectId", { required: true })}
            >
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.country}
                </option>
              ))}
            </Select>
            <FieldError message={err("projectId")} />
            <p className="mt-2 text-[11px] text-fg-muted">
              Not in the list?{" "}
              <Link href="/projects/new" className="text-cyan hover:underline">
                Create the project first
              </Link>
              , then come back and attach this source.
            </p>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>3 · Candidate claims</PanelTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              claims.append({
                metricType: "POWER_MW",
                numericValue: "",
                textValue: "",
                unit: "MW",
                confidenceLevel: "HIGH",
                methodology: "",
                effectiveDate: "",
              })
            }
          >
            <Plus /> Add claim
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {claims.fields.length === 0 ? (
            <p className="text-xs text-fg-muted">
              No claims yet. A source with no claims is still worth recording — it
              becomes evidence the project exists — but the value is in the numbers it
              supports.
            </p>
          ) : (
            claims.fields.map((field, index) => {
              const type = watch(`claims.${index}.metricType`);
              const meta = METRIC_TYPE_META[type as keyof typeof METRIC_TYPE_META];
              return (
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
                      onClick={() => claims.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Select
                      aria-label={`Claim ${index + 1} metric`}
                      {...register(`claims.${index}.metricType`)}
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
                      min={0}
                      placeholder="Value"
                      aria-label={`Claim ${index + 1} value`}
                      {...register(`claims.${index}.numericValue`)}
                    />
                    <Input
                      placeholder={meta?.defaultUnit ?? "Unit"}
                      aria-label={`Claim ${index + 1} unit`}
                      {...register(`claims.${index}.unit`)}
                    />
                    <Select
                      aria-label={`Claim ${index + 1} confidence`}
                      {...register(`claims.${index}.confidenceLevel`)}
                    >
                      {CONFIDENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      aria-label={`Claim ${index + 1} effective date`}
                      {...register(`claims.${index}.effectiveDate`)}
                    />
                    <Input
                      placeholder="Text value (non-numeric claims)"
                      aria-label={`Claim ${index + 1} text value`}
                      className="md:col-span-3"
                      {...register(`claims.${index}.textValue`)}
                    />
                    <Textarea
                      rows={2}
                      className="md:col-span-4"
                      placeholder="Methodology — what the source actually says, and any arithmetic you applied."
                      aria-label={`Claim ${index + 1} methodology`}
                      {...register(`claims.${index}.methodology`)}
                    />
                  </div>
                  <p className="text-[11px] text-fg-muted">
                    Every claim here is cited to the source above, so Confirmed is a
                    valid level if the source states the figure outright.
                  </p>
                </div>
              );
            })
          )}
        </PanelBody>
      </Panel>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Button type="submit" variant="primary" disabled={saving}>
          <Save /> {saving ? "Saving…" : "Save source and claims"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/sources">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
