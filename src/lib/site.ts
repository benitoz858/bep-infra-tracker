/**
 * The canonical public origin.
 *
 * Four separate places need to agree on this — `metadataBase`, the Open Graph
 * URL, robots.txt's sitemap pointer and every entry in the sitemap itself — and
 * a mismatch between any two of them is the kind of thing nobody notices until
 * a crawler indexes the workers.dev hostname instead. So it is stated once.
 *
 * Not read from an env var deliberately: this is one fixed public address, and
 * a missing variable at build time would silently produce a sitemap full of
 * `undefined` URLs rather than failing.
 */
export const SITE_URL = "https://tracker.bepresearch.com";

/** Absolute URL for a path, for the places that require one (sitemaps, OG tags). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
