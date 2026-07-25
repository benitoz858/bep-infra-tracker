/**
 * Search result shapes and display metadata.
 *
 * Deliberately separate from lib/services/search.ts: that module imports the
 * Prisma client, and the command palette is a client component. Importing a
 * *value* (not just a type) from the service pulled `pg` into the browser bundle
 * and failed the build on `Can't resolve 'dns'`. Anything a client component
 * needs at runtime lives here, with no database imports.
 */

export type SearchResultKind =
  "project" | "company" | "location" | "gpuModel" | "source" | "note";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

export const SEARCH_KIND_LABEL: Record<SearchResultKind, string> = {
  project: "Projects",
  company: "Companies",
  location: "Locations",
  gpuModel: "GPU models",
  source: "Sources",
  note: "Analyst notes",
};

/** Order groups appear in the palette. */
export const SEARCH_KIND_ORDER: SearchResultKind[] = [
  "project",
  "company",
  "location",
  "gpuModel",
  "source",
  "note",
];
