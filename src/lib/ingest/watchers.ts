import type { SourceType } from "@/generated/prisma/enums";
import { fetchText, parseFeed } from "@/lib/ingest/feed";
import type { WatchedItem, Watcher } from "@/lib/ingest/types";

/**
 * The watcher registry.
 *
 * Every entry points at a feed the publisher operates and offers for machine
 * consumption. Two consequences worth stating:
 *
 *  - Coverage is honest but narrow. A newsroom feed carries announcements, not
 *    the permit dockets and interconnection queues where the confirmable
 *    numbers live. Those are the higher-value watchers to add next, and most of
 *    them need per-jurisdiction work rather than one generic crawler.
 *  - No general web scraping. If a publisher has not published a feed, we do
 *    not go and take the HTML.
 */

/** A watcher built from a single RSS/Atom endpoint. */
function feedWatcher(config: {
  key: string;
  label: string;
  url: string;
  publisher: string;
  sourceType: SourceType;
}): Watcher {
  return {
    key: config.key,
    label: config.label,
    publisher: config.publisher,
    defaultSourceType: config.sourceType,
    async run({ since, limit = 40 }) {
      const xml = await fetchText(config.url);
      let items = parseFeed(xml);

      if (since) {
        // Items with no date are kept: dropping them would silently lose
        // anything from a feed that omits timestamps.
        items = items.filter((i) => !i.publicationDate || i.publicationDate >= since);
      }

      return items.slice(0, limit).map((item) => ({
        ...item,
        publisher: item.publisher ?? config.publisher,
        sourceType: item.sourceType ?? config.sourceType,
      }));
    },
  };
}

/**
 * SEC EDGAR full-text search.
 *
 * Filings are the highest-value automated source in this product: unlike a
 * press release, a 10-K figure is one an issuer is legally accountable for. The
 * endpoint is EDGAR's public JSON search API.
 */
function edgarWatcher(config: {
  key: string;
  label: string;
  query: string;
  forms?: string[];
}): Watcher {
  return {
    key: config.key,
    label: config.label,
    publisher: "SEC EDGAR",
    defaultSourceType: "SEC_FILING",
    async run({ since, limit = 25 }) {
      const params = new URLSearchParams({ q: config.query });
      if (config.forms?.length) params.set("forms", config.forms.join(","));
      if (since) params.set("dateRange", "custom");
      if (since) params.set("startdt", since.toISOString().slice(0, 10));

      const raw = await fetchText(
        `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(config.query)}&${params.toString()}`,
      );

      let parsed: {
        hits?: { hits?: { _id?: string; _source?: Record<string, unknown> }[] };
      };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        // EDGAR occasionally serves an HTML error page with a 200. Treating
        // that as "no results" would look identical to a quiet week, so fail
        // loudly and let the run be marked FAILED.
        throw new Error("EDGAR returned a non-JSON response");
      }

      const hits = parsed.hits?.hits ?? [];
      return hits.slice(0, limit).flatMap((hit): WatchedItem[] => {
        const src = hit._source ?? {};
        const adsh = String(src.adsh ?? "").replace(/-/g, "");
        const cik = Array.isArray(src.ciks) ? String(src.ciks[0]) : "";
        const fileName = String(src.file_name ?? "");
        if (!adsh || !cik) return [];

        const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh}/${fileName}`;
        const display = Array.isArray(src.display_names)
          ? String(src.display_names[0])
          : "Filer";

        return [
          {
            url,
            title: `${String(src.form ?? "Filing")} — ${display}`,
            publisher: "SEC EDGAR",
            publicationDate: src.file_date ? new Date(String(src.file_date)) : undefined,
            sourceType: "SEC_FILING",
            text: undefined,
          },
        ];
      });
    },
  };
}

export const WATCHERS: Watcher[] = [
  feedWatcher({
    key: "rss:aws-news",
    label: "AWS news blog",
    url: "https://aws.amazon.com/blogs/aws/feed/",
    publisher: "Amazon Web Services",
    sourceType: "COMPANY_ANNOUNCEMENT",
  }),
  feedWatcher({
    key: "rss:google-cloud",
    label: "Google Cloud blog — infrastructure",
    url: "https://cloudblog.withgoogle.com/rss/",
    publisher: "Google",
    sourceType: "COMPANY_ANNOUNCEMENT",
  }),
  feedWatcher({
    key: "rss:nvidia-blog",
    label: "NVIDIA blog",
    url: "https://blogs.nvidia.com/feed/",
    publisher: "NVIDIA",
    sourceType: "COMPANY_ANNOUNCEMENT",
  }),
  feedWatcher({
    key: "rss:datacenterdynamics",
    label: "DataCenterDynamics",
    url: "https://www.datacenterdynamics.com/en/rss/",
    publisher: "DataCenterDynamics",
    sourceType: "NEWS_ARTICLE",
  }),
  edgarWatcher({
    key: "edgar:datacenter-capex",
    label: "SEC filings mentioning data center capacity",
    query: '"data center" "megawatts"',
    forms: ["10-K", "10-Q", "8-K"],
  }),
];

export function getWatcher(key: string): Watcher | undefined {
  return WATCHERS.find((w) => w.key === key);
}
