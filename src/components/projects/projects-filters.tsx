"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/domain";
import { buildQuery, readList, toggleInList } from "@/lib/url-state";
import { cn } from "@/lib/utils";

export type Facets = {
  countries: string[];
  gpuModels: string[];
  owners: { id: string; name: string }[];
  tags: { slug: string; name: string }[];
};

export function ProjectsFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = new URLSearchParams(searchParams.toString());

  function push(patch: Parameters<typeof buildQuery>[1]) {
    startTransition(() => {
      router.push(`${pathname}${buildQuery(searchParams.toString(), patch)}`);
    });
  }

  // Debounced, uncontrolled search box. `key={urlQuery}` remounts it when the
  // URL changes from elsewhere (back button, "clear filters"), so URL state is
  // never mirrored into React state — mirroring would mean a setState inside an
  // effect and the cascading renders that come with it.
  const urlQuery = params.get("q") ?? "";
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => push({ q: value || null }), 350);
  }

  const activeStatuses = readList(params, "status");
  const activeTypes = readList(params, "projectType");
  const activeTags = readList(params, "tag");
  const filterCount = [
    ...activeStatuses,
    ...activeTypes,
    ...activeTags,
    params.get("country"),
    params.get("ownerId"),
    params.get("gpuModel"),
    params.get("minPowerMw"),
    params.get("openingYear"),
    params.get("needsVerification"),
    params.get("q"),
  ].filter(Boolean).length;

  const openingYears = Array.from({ length: 12 }, (_, i) => 2023 + i);

  return (
    <div className={cn("space-y-3", isPending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
          <Input
            key={urlQuery}
            defaultValue={urlQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, owners, locations, GPU models, notes…"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>

        <Select
          aria-label="Filter by country"
          value={params.get("country") ?? ""}
          onChange={(e) => push({ country: e.target.value || null })}
          className="w-auto min-w-[150px]"
        >
          <option value="">All countries</option>
          {facets.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by owner"
          value={params.get("ownerId") ?? ""}
          onChange={(e) => push({ ownerId: e.target.value || null })}
          className="w-auto min-w-[150px]"
        >
          <option value="">All owners</option>
          {facets.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by GPU model"
          value={params.get("gpuModel") ?? ""}
          onChange={(e) => push({ gpuModel: e.target.value || null })}
          className="w-auto min-w-[150px]"
        >
          <option value="">All GPU models</option>
          {facets.gpuModels.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by opening year"
          value={params.get("openingYear") ?? ""}
          onChange={(e) => push({ openingYear: e.target.value || null })}
          className="w-auto"
        >
          <option value="">Any opening year</option>
          {openingYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>

        <Input
          type="number"
          min={0}
          step={10}
          aria-label="Minimum power in MW"
          placeholder="Min MW"
          defaultValue={params.get("minPowerMw") ?? ""}
          onBlur={(e) => push({ minPowerMw: e.target.value || null })}
          className="w-[100px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="eyebrow mr-1">Status</span>
        {PROJECT_STATUS_ORDER.map((status) => {
          const on = activeStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={on}
              onClick={() => push(toggleInList(params, "status", status))}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                on
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-line-2 text-fg-muted hover:border-fg-muted hover:text-fg-dim",
              )}
            >
              {PROJECT_STATUS_META[status].label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="eyebrow mr-1">Type</span>
        {PROJECT_TYPE_OPTIONS.map(({ value, label }) => {
          const on = activeTypes.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => push(toggleInList(params, "projectType", value))}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                on
                  ? "border-purple bg-purple/10 text-purple"
                  : "border-line-2 text-fg-muted hover:border-fg-muted hover:text-fg-dim",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {facets.tags.length > 0 ? (
          <>
            <span className="eyebrow mr-1">Tag</span>
            {facets.tags.map((t) => {
              const on = activeTags.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => push(toggleInList(params, "tag", t.slug))}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[11px] transition-colors",
                    on
                      ? "border-green bg-green/10 text-green"
                      : "border-line-2 text-fg-muted hover:text-fg-dim",
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </>
        ) : null}

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-dim">
          <input
            type="checkbox"
            checked={params.get("needsVerification") === "1"}
            onChange={(e) => push({ needsVerification: e.target.checked ? "1" : null })}
            className="accent-cyan"
          />
          Needs verification only
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-dim">
          <input
            type="checkbox"
            checked={params.get("includeDemo") === "0"}
            onChange={(e) => push({ includeDemo: e.target.checked ? "0" : null })}
            className="accent-cyan"
          />
          Hide demo data
        </label>

        {filterCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push(pathname))}
          >
            <X /> Clear {filterCount} filter{filterCount === 1 ? "" : "s"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
