import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

/**
 * Generated per request rather than at build time.
 *
 * A sitemap baked at build time would freeze the project list at whatever the
 * build machine's database happened to hold, and would then go stale the moment
 * a maintainer accepts a correction — which happens far more often than a
 * deploy. `revalidate` is not the answer either: open-next.config.ts leaves the
 * incremental cache at its in-memory default, so a revalidating route would
 * simply re-run on every cold isolate anyway. One query per crawler hit is
 * cheap and always correct.
 */
export const dynamic = "force-dynamic";

/**
 * Public read surface only.
 *
 * The write pages (new, edit, import, admin) redirect anonymous visitors to
 * /login, so listing them would advertise URLs that can never render for a
 * crawler. robots.ts disallows the same set.
 */
const PUBLIC_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/dashboard", priority: 0.9 },
  { path: "/projects", priority: 0.9 },
  { path: "/map", priority: 0.8 },
  { path: "/siting", priority: 0.8 },
  { path: "/companies", priority: 0.7 },
  { path: "/analytics", priority: 0.7 },
  { path: "/sources", priority: 0.6 },
  { path: "/verification", priority: 0.6 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let projects: { slug: string; updatedAt: Date }[] = [];
  let companies: { slug: string; updatedAt: Date }[] = [];

  try {
    [projects, companies] = await Promise.all([
      prisma.project.findMany({
        // Seeded demo rows exist to make a fresh clone usable; they are not
        // claims about the world, so they must never be offered to a crawler.
        where: { isDemoData: false },
        select: { slug: true, updatedAt: true },
      }),
      prisma.company.findMany({ select: { slug: true, updatedAt: true } }),
    ]);
  } catch (error) {
    // A sitemap that 500s teaches a crawler the whole file is broken, which is
    // worse than one that is temporarily short. Log loudly (Worker observability
    // is on) and still serve the routes that do not depend on the database.
    console.error("[sitemap] could not load slugs from the database", error);
  }

  // The aggregate pages are views over the project set, so the newest project
  // edit is genuinely their last-modified time. Claiming `new Date()` here would
  // tell crawlers every page changes on every fetch, which trains them to ignore
  // the field.
  const lastEdit = [...projects, ...companies]
    .map((row) => row.updatedAt)
    .reduce<Date | undefined>(
      (latest, at) => (latest && latest >= at ? latest : at),
      undefined,
    );

  return [
    ...PUBLIC_ROUTES.map(({ path, priority }) => ({
      url: absoluteUrl(path),
      lastModified: lastEdit,
      changeFrequency: "daily" as const,
      priority,
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      lastModified: project.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...companies.map((company) => ({
      url: absoluteUrl(`/companies/${company.slug}`),
      lastModified: company.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
