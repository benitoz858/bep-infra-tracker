import type { MetadataRoute } from "next";

/**
 * Open by default — being found is the point of publishing this.
 *
 * The disallow list is not a security boundary; those routes are guarded by
 * capability checks in the page and again in the API route. It exists so
 * crawlers do not spend their budget on pages that only ever redirect to a
 * login, and so those redirects never surface in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/import", "/projects/new", "/admin/"],
    },
    sitemap: "https://tracker.bepresearch.com/sitemap.xml",
    host: "https://tracker.bepresearch.com",
  };
}
