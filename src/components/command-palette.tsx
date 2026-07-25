"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  SEARCH_KIND_LABEL,
  SEARCH_KIND_ORDER,
  type SearchResult,
} from "@/lib/search-types";
import { cn } from "@/lib/utils";

/**
 * Global search, keyboard-first.
 *
 * ⌘K / Ctrl+K opens, ↑/↓ moves, Enter navigates, Esc closes. The flat
 * `results` array is what the arrow keys traverse, so the visual grouping never
 * desyncs from the selection index.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const runSearch = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Guard against out-of-order responses: a slow early request must not
    // overwrite the results of a later, more specific one.
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
      if (!response.ok) return;
      const body = (await response.json()) as { data: { results: SearchResult[] } };
      if (id !== requestId.current) return;
      setResults(body.data.results);
      setSelected(0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onChange(value: string) {
    setTerm(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runSearch(value), 220);
  }

  function go(result: SearchResult) {
    setOpen(false);
    setTerm("");
    setResults([]);
    router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((i) =>
        results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[selected];
      if (hit) go(hit);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-line-2 bg-panel-2 px-2.5 py-1.5 text-[12px] text-fg-muted transition-colors hover:border-fg-muted hover:text-fg-dim"
        aria-label="Open search"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-line-2 px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  // Group for display while keeping the flat index for keyboard traversal.
  let flatIndex = -1;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-line-2 bg-panel shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search projects, companies, locations, GPU models, sources, notes…"
            className="w-full bg-transparent py-3 text-sm text-fg placeholder:text-fg-muted focus:outline-none"
            aria-label="Search query"
            aria-controls="command-results"
            aria-activedescendant={
              results[selected] ? `search-result-${selected}` : undefined
            }
          />
          <kbd className="shrink-0 rounded border border-line-2 px-1 font-mono text-[10px] text-fg-muted">
            esc
          </kbd>
        </div>

        <div
          id="command-results"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto"
        >
          {term.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-fg-muted">
              Type at least two characters. ↑↓ to move, Enter to open.
            </p>
          ) : loading && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-fg-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-fg-muted">
              Nothing matched “{term}”.
            </p>
          ) : (
            SEARCH_KIND_ORDER.map((kind) => {
              const group = results.filter((r) => r.kind === kind);
              if (group.length === 0) return null;
              return (
                <div
                  key={kind}
                  className="border-b border-[#1b1b1b] py-1.5 last:border-0"
                >
                  <p className="eyebrow px-3 py-1">{SEARCH_KIND_LABEL[kind]}</p>
                  {group.map((result) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const active = index === selected;
                    return (
                      <button
                        key={result.id}
                        id={`search-result-${index}`}
                        role="option"
                        aria-selected={active}
                        type="button"
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => go(result)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
                          active ? "bg-cyan/10" : "hover:bg-panel-2",
                        )}
                      >
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block truncate text-[13px]",
                              active ? "text-cyan" : "text-fg",
                            )}
                          >
                            {result.title}
                          </span>
                          <span className="block truncate text-[11px] text-fg-muted">
                            {result.subtitle}
                          </span>
                        </span>
                        {result.badge ? (
                          <Badge tone={result.badge === "Demo" ? "risk" : "neutral"}>
                            {result.badge}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
