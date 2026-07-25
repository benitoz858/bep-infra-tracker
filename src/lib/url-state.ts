/**
 * URL query-string helpers.
 *
 * Table state (filters, sort, page, column visibility) lives in the URL so a
 * view is shareable, bookmarkable and survives a reload — and so the CSV export
 * endpoint can be handed the same query string and return exactly the rows the
 * analyst is looking at.
 */

export type QueryValue = string | number | boolean | string[] | null | undefined;

/**
 * Apply patches to a query string. `null` removes a key. Any change to a
 * filter resets `page`, since staying on page 7 of a newly narrowed result set
 * shows an empty table.
 */
export function buildQuery(
  current: URLSearchParams | string,
  patch: Record<string, QueryValue>,
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current.toString(),
  );

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "" || value === false) {
      params.delete(key);
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) params.delete(key);
      else params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }

  const changedAFilter = Object.keys(patch).some((k) => k !== "page");
  if (changedAFilter && !("page" in patch)) params.delete("page");

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Read a comma-separated multi-value param. */
export function readList(params: URLSearchParams | undefined, key: string): string[] {
  const raw = params?.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Toggle one value inside a comma-separated param. */
export function toggleInList(
  params: URLSearchParams,
  key: string,
  value: string,
): Record<string, QueryValue> {
  const current = readList(params, key);
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { [key]: next };
}

/** Next sort state for a column header click: asc → desc → asc. */
export function nextSort(currentSort: string | null, field: string): string {
  const [currentField, currentDir] = (currentSort ?? "").split(".");
  if (currentField !== field) {
    // Text sorts read better ascending; numbers and dates descending.
    const descFirst = [
      "powerMw",
      "gpuCount",
      "confidenceScore",
      "expectedOpeningDate",
      "createdAt",
      "updatedAt",
    ];
    return `${field}.${descFirst.includes(field) ? "desc" : "asc"}`;
  }
  return `${field}.${currentDir === "asc" ? "desc" : "asc"}`;
}

/** Turn a plain object into a query string, dropping empties. */
export function toQueryString(input: Record<string, QueryValue>): string {
  return buildQuery("", input);
}
