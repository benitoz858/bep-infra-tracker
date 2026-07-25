import { prisma } from "@/lib/db";
import type { SearchResult } from "@/lib/search-types";

// Re-exported so server callers have one import site for search.
export type { SearchResult, SearchResultKind } from "@/lib/search-types";
export { SEARCH_KIND_LABEL, SEARCH_KIND_ORDER } from "@/lib/search-types";

/**
 * Global search across projects, companies, locations, GPU models, analyst notes
 * and source titles.
 *
 * Implemented as parallel indexed ILIKE queries rather than Postgres full-text
 * search. Reasons: no tsvector column or trigram extension is needed (so no
 * migration debt), substring matching beats stemming for identifiers like
 * "GB200" and "MI355X", and the result grouping the UI wants is per-entity
 * anyway. If row counts reach the point where this is slow, the replacement is a
 * generated tsvector column plus a GIN index behind this same interface.
 */

export async function globalSearch(term: string, limit = 6): Promise<SearchResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };

  const [projects, companies, locations, gpuModels, sources, notes] = await Promise.all(
    [
      prisma.project.findMany({
        where: {
          OR: [{ name: contains }, { description: contains }],
        },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          country: true,
          city: true,
          isDemoData: true,
          ownerCompany: { select: { name: true } },
        },
        take: limit,
        orderBy: { name: "asc" },
      }),

      prisma.company.findMany({
        where: { OR: [{ name: contains }, { ticker: contains }] },
        select: { id: true, slug: true, name: true, ticker: true, companyType: true },
        take: limit,
        orderBy: { name: "asc" },
      }),

      // Locations are not their own table; distinct city/country pairs stand in.
      prisma.project.findMany({
        where: {
          OR: [{ city: contains }, { stateRegion: contains }, { country: contains }],
        },
        select: { city: true, stateRegion: true, country: true },
        distinct: ["city", "stateRegion", "country"],
        take: limit,
      }),

      prisma.project.findMany({
        where: { OR: [{ gpuModel: contains }, { computePlatform: contains }] },
        select: { gpuModel: true, computePlatform: true },
        distinct: ["gpuModel"],
        take: limit,
      }),

      prisma.source.findMany({
        where: { OR: [{ title: contains }, { publisher: contains }] },
        select: {
          id: true,
          title: true,
          publisher: true,
          project: { select: { slug: true, name: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      }),

      prisma.project.findMany({
        where: { analystNotes: contains },
        select: { id: true, slug: true, name: true, analystNotes: true },
        take: limit,
      }),
    ],
  );

  const results: SearchResult[] = [];

  for (const p of projects) {
    results.push({
      kind: "project",
      id: p.id,
      title: p.name,
      subtitle: [p.ownerCompany?.name, p.city, p.country].filter(Boolean).join(" · "),
      href: `/projects/${p.slug}`,
      badge: p.isDemoData ? "Demo" : p.status,
    });
  }

  for (const c of companies) {
    results.push({
      kind: "company",
      id: c.id,
      title: c.name,
      subtitle: c.companyType.toLowerCase().replace(/_/g, " "),
      href: `/companies/${c.slug}`,
      badge: c.ticker ?? undefined,
    });
  }

  for (const l of locations) {
    const label = [l.city, l.stateRegion, l.country].filter(Boolean).join(", ");
    if (!label) continue;
    results.push({
      kind: "location",
      id: `loc:${label}`,
      title: label,
      subtitle: "Filter the database by this country",
      href: `/projects?country=${encodeURIComponent(l.country)}`,
    });
  }

  for (const g of gpuModels) {
    if (!g.gpuModel) continue;
    results.push({
      kind: "gpuModel",
      id: `gpu:${g.gpuModel}`,
      title: g.gpuModel,
      subtitle: g.computePlatform ?? "Filter the database by this model",
      href: `/projects?gpuModel=${encodeURIComponent(g.gpuModel)}`,
    });
  }

  for (const s of sources) {
    results.push({
      kind: "source",
      id: s.id,
      title: s.title,
      subtitle: [s.publisher, s.project.name].filter(Boolean).join(" · "),
      href: `/projects/${s.project.slug}`,
    });
  }

  for (const n of notes) {
    // Show the matching fragment rather than the first 80 characters, so the
    // reader can see why the note matched.
    const idx = (n.analystNotes ?? "").toLowerCase().indexOf(q.toLowerCase());
    const start = Math.max(0, idx - 40);
    const snippet = (n.analystNotes ?? "").slice(start, start + 120);
    results.push({
      kind: "note",
      id: `note:${n.id}`,
      title: n.name,
      subtitle: `${start > 0 ? "…" : ""}${snippet}…`,
      href: `/projects/${n.slug}`,
    });
  }

  return results;
}
