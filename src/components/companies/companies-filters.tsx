"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

import { Input, Select } from "@/components/ui/input";
import { COMPANY_TYPE_OPTIONS } from "@/lib/domain";
import { buildQuery } from "@/lib/url-state";
import { cn } from "@/lib/utils";

export function CompaniesFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function push(patch: Parameters<typeof buildQuery>[1]) {
    startTransition(() => {
      router.push(`${pathname}${buildQuery(searchParams.toString(), patch)}`);
    });
  }

  // The search box is uncontrolled and debounced. `key={urlQuery}` remounts it
  // when the URL changes from elsewhere (back button, cleared filters), which
  // avoids mirroring URL state into React state and the cascading renders that
  // a sync-in-effect would cause.
  const urlQuery = searchParams.get("q") ?? "";
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => push({ q: value || null }), 350);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", isPending && "opacity-70")}>
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
        <Input
          key={urlQuery}
          defaultValue={urlQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search companies, tickers, descriptions…"
          className="pl-8"
          aria-label="Search companies"
        />
      </div>

      <Select
        aria-label="Filter by company type"
        value={searchParams.get("companyType") ?? ""}
        onChange={(e) => push({ companyType: e.target.value || null })}
        className="w-auto min-w-[170px]"
      >
        <option value="">All types</option>
        {COMPANY_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Sort companies"
        value={searchParams.get("sort") ?? "name.asc"}
        onChange={(e) => push({ sort: e.target.value })}
        className="w-auto"
      >
        <option value="name.asc">Name A–Z</option>
        <option value="projectCount.desc">Most projects</option>
        <option value="companyType.asc">Type</option>
        <option value="ticker.asc">Ticker</option>
      </Select>

      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-dim">
        <input
          type="checkbox"
          checked={searchParams.get("hasTicker") === "1"}
          onChange={(e) => push({ hasTicker: e.target.checked ? "1" : null })}
          className="accent-cyan"
        />
        Public companies only
      </label>
    </div>
  );
}
