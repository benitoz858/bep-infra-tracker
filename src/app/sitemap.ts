import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";

const BASE = "https://tracker.bepresearch.com";

/**
 * Only pages a stranger can actually read belong here. Anything behind a
 * capability check (/import, /projects/new, /admin/*) is deliberately absent:
 * listing a page that redirects to a login wastes crawl budget and reads as a
 * broken link to anyone who follows it from a search result.
 *
 * Generated per request rather than at build time so a project added today is
 * discoverable today, without a redeploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = (
    [
      { url: BASE, changeFrequency: "daily", priority: 1 },
      { url: `${BASE}/dashboard`, changeFrequency: "daily", priority: 0.9 },
      { url: `${BASE}/projects`, changeFrequency: "daily", priority: 0.9 },
      { url: `${BASE}/siting`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${BASE}/submit`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${BASE}/analytics`, changeFrequency: "daily", priority: 0.7 },
      { url: `${BASE}/map`, changeFrequency: "weekly", priority: 0.6 },
      { url: `${BASE}/companies`, changeFrequency: "weekly", priority: 0.6 },
      { url: `${BASE}/sources`, changeFrequency: "daily", priority: 0.5 },
      { url: `${BASE}/verification`, changeFrequency: "daily", priority: 0.5 },
    ] as const
  ).map((page) => ({ ...page, lastModified: now }));

  // A sitemap that 500s is worse than a thin one: search engines back off the
  // whole file. If the database is unreachable, still serve the static pages.
  try {
    const [projects, companies] = await Promise.all([
      prisma.project.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.company.findMany({ select: { slug: true, updatedAt: true } }),
    ]);

    return [
      ...staticPages,
      ...projects.map((p) => ({
        url: `${BASE}/projects/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...companies.map((c) => ({
        url: `${BASE}/companies/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    return staticPages;
  }
}
