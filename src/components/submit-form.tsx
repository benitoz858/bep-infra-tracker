"use client";

import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/misc";
import { METRIC_TYPE_META, SOURCE_TYPE_LABEL } from "@/lib/domain";

type Claim = {
  metricType: string;
  numericValue: string;
  unit: string;
  confidenceLevel: string;
  methodology: string;
};

const EMPTY_CLAIM: Claim = {
  metricType: "POWER_MW",
  numericValue: "",
  unit: "MW",
  confidenceLevel: "MEDIUM",
  methodology: "",
};

export function SubmitForm({
  projects,
}: {
  projects: { id: string; name: string; country: string }[];
}) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = String(form.get(key) ?? "").trim();
      return value === "" ? undefined : value;
    };

    const payload = {
      url: String(form.get("url") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      publisher: text("publisher"),
      publicationDate: text("publicationDate"),
      sourceType: String(form.get("sourceType") ?? "NEWS_ARTICLE"),
      excerpt: text("excerpt"),
      projectId: text("projectId"),
      suggestedProjectName: text("suggestedProjectName"),
      note: text("note"),
      submitterName: text("submitterName"),
      submitterEmail: text("submitterEmail"),
      website: String(form.get("website") ?? ""),
      claims: claims
        .filter((c) => c.numericValue.trim() !== "")
        .map((c) => ({
          metricType: c.metricType,
          numericValue: Number(c.numericValue),
          unit: c.unit || undefined,
          confidenceLevel: c.confidenceLevel,
          methodology: c.methodology || undefined,
        })),
    };

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }

    setDone(true);
    setPending(false);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-line bg-panel p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-7 text-green" />
        <h2 className="mb-2 text-base font-semibold text-fg">Submission received</h2>
        <p className="mx-auto mb-5 max-w-md text-[13px] leading-relaxed text-fg-dim">
          It is in the review queue. A maintainer reads the source and either records
          the claim with a confidence level or explains why not — nothing reaches the
          published figures until someone has checked it.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Browse the database</Link>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setDone(false)}>
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-[13px] font-semibold text-fg">The source</h2>
        <p className="mb-4 text-[11px] leading-relaxed text-fg-muted">
          A primary source is best: the owner&apos;s own announcement, an SEC filing, a
          permit docket, an interconnection queue entry. A news article that cites one
          is fine.
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="url" required>
              URL
            </Label>
            <Input id="url" name="url" type="url" required placeholder="https://…" />
          </div>

          <div>
            <Label htmlFor="title" required>
              Title
            </Label>
            <Input id="title" name="title" required maxLength={300} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="publisher">Publisher</Label>
              <Input id="publisher" name="publisher" placeholder="Reuters, ERCOT…" />
            </div>
            <div>
              <Label htmlFor="publicationDate">Published</Label>
              <Input id="publicationDate" name="publicationDate" type="date" />
            </div>
            <div>
              <Label htmlFor="sourceType">Type</Label>
              <Select id="sourceType" name="sourceType" defaultValue="NEWS_ARTICLE">
                {Object.entries(SOURCE_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="excerpt">Quote the sentence the figure comes from</Label>
            <Textarea id="excerpt" name="excerpt" rows={3} maxLength={4000} />
            <p className="mt-1 text-[11px] text-fg-muted">
              The single most useful thing you can include. It saves the reviewer
              re-reading the source, and it is what a later reader checks against.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-[13px] font-semibold text-fg">Which project</h2>
        <p className="mb-4 text-[11px] leading-relaxed text-fg-muted">
          Leave blank if you are not sure — &quot;I don&apos;t know&quot; is a real
          answer and the reviewer will work it out.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="projectId">Existing project</Label>
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">Not sure / not listed</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.country}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="suggestedProjectName">Or name a new one</Label>
            <Input
              id="suggestedProjectName"
              name="suggestedProjectName"
              placeholder="Not yet in the tracker"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-fg">
            What it says <span className="font-normal text-fg-muted">— optional</span>
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setClaims((c) => [...c, { ...EMPTY_CLAIM }])}
          >
            <Plus /> Add a figure
          </Button>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-fg-muted">
          Leave unknowns blank rather than entering 0 — a blank means &quot;not
          disclosed&quot;, while 0 is a claim that the value is zero, and the tracker
          treats those as genuinely different. Confidence is your read of the evidence;
          a reviewer sets the final level.
        </p>

        {claims.length === 0 ? (
          <p className="rounded border border-dashed border-line-2 px-3 py-4 text-center text-[12px] text-fg-muted">
            No figures yet. A source with no numbers is still worth submitting.
          </p>
        ) : (
          <div className="space-y-3">
            {claims.map((claim, index) => (
              <div
                key={index}
                className="grid gap-2 rounded border border-line-2 p-3 sm:grid-cols-[1.4fr_1fr_0.7fr_1fr_auto]"
              >
                <Select
                  aria-label="Metric"
                  value={claim.metricType}
                  onChange={(e) =>
                    setClaims((all) =>
                      all.map((c, i) =>
                        i === index
                          ? {
                              ...c,
                              metricType: e.target.value,
                              // Follow the metric's own unit, so nobody submits
                              // a GPU count labelled MW by leaving the default.
                              unit:
                                METRIC_TYPE_META[
                                  e.target.value as keyof typeof METRIC_TYPE_META
                                ]?.defaultUnit ?? "",
                            }
                          : c,
                      ),
                    )
                  }
                >
                  {Object.entries(METRIC_TYPE_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Value"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Value"
                  value={claim.numericValue}
                  onChange={(e) =>
                    setClaims((all) =>
                      all.map((c, i) =>
                        i === index ? { ...c, numericValue: e.target.value } : c,
                      ),
                    )
                  }
                />
                <Input
                  aria-label="Unit"
                  placeholder="MW"
                  value={claim.unit}
                  onChange={(e) =>
                    setClaims((all) =>
                      all.map((c, i) => (i === index ? { ...c, unit: e.target.value } : c)),
                    )
                  }
                />
                <Select
                  aria-label="Confidence"
                  value={claim.confidenceLevel}
                  onChange={(e) =>
                    setClaims((all) =>
                      all.map((c, i) =>
                        i === index ? { ...c, confidenceLevel: e.target.value } : c,
                      ),
                    )
                  }
                >
                  <option value="LOW">Low — inferred</option>
                  <option value="MEDIUM">Medium — reported</option>
                  <option value="HIGH">High — stated by the owner</option>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove figure ${index + 1}`}
                  onClick={() => setClaims((all) => all.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-4 text-[13px] font-semibold text-fg">
          You <span className="font-normal text-fg-muted">— optional</span>
        </h2>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="submitterName">Name or handle</Label>
              <Input id="submitterName" name="submitterName" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="submitterEmail">Email</Label>
              <Input id="submitterEmail" name="submitterEmail" type="email" />
              <p className="mt-1 text-[11px] text-fg-muted">
                Only used to reply about this submission.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="note">Anything the reviewer should know</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              maxLength={2000}
              placeholder="Why this matters, what to look at, what you are unsure of…"
            />
          </div>
        </div>

        {/* Honeypot: off-screen rather than display:none, and hidden from
            assistive technology, so a screen-reader user never meets it. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </section>

      <FieldError message={error ?? undefined} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
        <p className="text-[11px] text-fg-muted">
          By submitting you agree your contribution may be published under CC BY 4.0.
        </p>
      </div>
    </form>
  );
}
