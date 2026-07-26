import type { WatchedItem } from "@/lib/ingest/types";

/**
 * Minimal RSS/Atom parsing.
 *
 * Deliberately regex-based over a dependency: feeds are a small, stable subset
 * of XML, and the alternative is pulling a parser into a codebase that
 * otherwise has no XML surface. This is not a general XML parser and must not
 * be used as one.
 *
 * Watchers only ever point at publisher-operated feeds — a newsroom's own
 * RSS, an SEC EDGAR Atom endpoint. Nothing here scrapes arbitrary HTML, which
 * keeps the ingestion honest (structured, intentional, machine-readable
 * publication) and avoids fetching pages the publisher did not offer for
 * automated consumption.
 */

/** Unwrap CDATA. Must run before tag-stripping, or the closing ]]> survives. */
function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Ampersand last, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, "&");
}

function stripTags(input: string): string {
  // Order matters: unwrap CDATA, then strip tags, then decode entities. Decoding
  // first would turn "&lt;script&gt;" into a real tag that the stripper removes,
  // silently deleting text the source actually printed.
  return decodeEntities(unwrapCdata(input).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(block: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const m = pattern.exec(block);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parse an RSS 2.0 or Atom document into items. */
export function parseFeed(xml: string): WatchedItem[] {
  // <item> is RSS, <entry> is Atom.
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const items: WatchedItem[] = [];

  for (const block of blocks) {
    const title = firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]);

    // Atom puts the URL in an attribute; RSS in element text.
    const link =
      firstMatch(block, [/<link[^>]*\shref=["']([^"']+)["']/i]) ??
      firstMatch(block, [/<link[^>]*>([\s\S]*?)<\/link>/i]);

    if (!title || !link) continue;

    const url = decodeEntities(unwrapCdata(link)).trim();
    // Skip anything that is not an absolute http(s) URL: a relative link cannot
    // be resolved without guessing a base, and guessing produces dead citations.
    if (!/^https?:\/\//i.test(url)) continue;

    const summary = firstMatch(block, [
      /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i,
      /<description[^>]*>([\s\S]*?)<\/description>/i,
      /<summary[^>]*>([\s\S]*?)<\/summary>/i,
      /<content[^>]*>([\s\S]*?)<\/content>/i,
    ]);

    const dateRaw = firstMatch(block, [
      /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<published[^>]*>([\s\S]*?)<\/published>/i,
      /<updated[^>]*>([\s\S]*?)<\/updated>/i,
      /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
    ]);

    items.push({
      url,
      title: stripTags(title).slice(0, 300),
      publicationDate: parseDate(dateRaw ? stripTags(dateRaw) : undefined),
      text: summary ? stripTags(summary).slice(0, 4000) : undefined,
    });
  }

  return items;
}

/** Fetch with a timeout and an honest User-Agent. */
export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Identifying the client is the minimum courtesy when polling someone
        // else's feed, and lets a publisher block us if they object.
        "User-Agent":
          "BEP-AI-Infrastructure-Tracker/1.0 (research; +https://bepresearch.com)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
