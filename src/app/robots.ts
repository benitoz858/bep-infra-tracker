import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Reading the tracker needs no account, so the read surface is fully open to
 * crawlers — being found is the point of publishing the data.
 *
 * The disallow list is not a security boundary. Every one of these paths is
 * already gated server-side (the page redirects and the API route re-checks the
 * capability); listing them here just keeps crawlers from burning requests on
 * routes that will only ever redirect them to /login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/login",
        "/admin/",
        "/import",
        "/ingest",
        "/projects/new",
        "/sources/new",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
