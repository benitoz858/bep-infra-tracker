import { prisma } from "@/lib/db";

/**
 * Duplicate-project detection.
 *
 * The same campus gets written up as "Mount Pleasant AI Campus Phase 2",
 * "Mt. Pleasant AI campus (phase 2)" and "MOUNT PLEASANT PHASE II" by three
 * different outlets, so matching is done on a normalised key rather than the raw
 * string. Detection is advisory: it warns, and the analyst can override, because
 * two genuinely distinct phases on one site are a legitimate pair of records.
 */

/** Strip case, punctuation, accents, and the noise words that vary by outlet. */
export function normalizeName(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(mt|mount)\b/g, "mount")
      .replace(/\bst\b/g, "saint")
      .replace(/\bphase\s*(one|1|i)\b/g, "phase1")
      .replace(/\bphase\s*(two|2|ii)\b/g, "phase2")
      .replace(/\bphase\s*(three|3|iii)\b/g, "phase3")
      // Words that carry no distinguishing information in this domain.
      .replace(
        /\b(the|a|an|data ?cent(er|re)|datacent(er|re)|campus|site|project|facility|facilities|factory|factories|cluster|region|expansion|ai)\b/g,
        " ",
      )
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
  );
}

export function normalizePlace(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type DuplicateCandidate = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  stateRegion: string | null;
  country: string;
  ownerName: string | null;
  /** 0–100. 100 means every compared field matched. */
  score: number;
  matchedOn: string[];
};

export type DuplicateCheckInput = {
  name: string;
  ownerCompanyId?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country: string;
  /** Excluded from results, so editing a project never flags itself. */
  excludeProjectId?: string | null;
};

/** Token overlap (Jaccard) between two normalised names, 0–1. */
function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

const SCORE_THRESHOLD = 45;

/**
 * Returns possible duplicates, most likely first.
 *
 * Candidates are narrowed in SQL by country (a cheap, safe filter — the same
 * project is not in two countries) and scored in memory. That keeps the query
 * index-friendly while allowing fuzzy name comparison Postgres would need a
 * trigram extension to do.
 */
export async function findDuplicateProjects(
  input: DuplicateCheckInput,
): Promise<DuplicateCandidate[]> {
  const candidates = await prisma.project.findMany({
    where: {
      country: { equals: input.country.trim(), mode: "insensitive" },
      ...(input.excludeProjectId ? { id: { not: input.excludeProjectId } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      stateRegion: true,
      country: true,
      ownerCompanyId: true,
      ownerCompany: { select: { name: true } },
    },
    // Bounded so a country with thousands of projects cannot stall a form save.
    take: 500,
  });

  const targetName = normalizeName(input.name);
  const targetCity = normalizePlace(input.city);
  const targetRegion = normalizePlace(input.stateRegion);

  return (
    candidates
      .map((c) => {
        const matchedOn: string[] = [];
        let score = 0;

        const similarity = nameSimilarity(targetName, normalizeName(c.name));
        if (similarity >= 0.99) {
          score += 55;
          matchedOn.push("name");
        } else if (similarity >= 0.6) {
          score += Math.round(55 * similarity);
          matchedOn.push("similar name");
        }

        // Country already matched by the query.
        score += 10;
        matchedOn.push("country");

        const candidateCity = normalizePlace(c.city);
        if (targetCity && candidateCity && targetCity === candidateCity) {
          score += 20;
          matchedOn.push("city");
        }

        const candidateRegion = normalizePlace(c.stateRegion);
        if (targetRegion && candidateRegion && targetRegion === candidateRegion) {
          score += 10;
          matchedOn.push("region");
        }

        if (
          input.ownerCompanyId &&
          c.ownerCompanyId &&
          input.ownerCompanyId === c.ownerCompanyId
        ) {
          score += 15;
          matchedOn.push("owner");
        }

        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          city: c.city,
          stateRegion: c.stateRegion,
          country: c.country,
          ownerName: c.ownerCompany?.name ?? null,
          score: Math.min(100, score),
          matchedOn,
        };
      })
      // Country + nothing else scores 10 and is not a duplicate signal; require a
      // name or location match to clear the threshold.
      .filter((c) => c.score >= SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  );
}

/** Unique slug from a name, suffixing -2, -3 … on collision. */
export async function uniqueProjectSlug(
  base: string,
  excludeProjectId?: string | null,
): Promise<string> {
  const { slugify } = await import("@/lib/format");
  const root = slugify(base) || "project";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const existing = await prisma.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeProjectId) return candidate;
  }
  // Practically unreachable; keeps the function total rather than looping.
  return `${root}-${Date.now()}`;
}
