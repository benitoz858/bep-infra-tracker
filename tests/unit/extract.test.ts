import { describe, expect, it } from "vitest";

import { heuristicExtractor, getExtractor, noopExtractor } from "@/lib/ingest/extract";
import { parseFeed } from "@/lib/ingest/feed";

const item = (title: string, text?: string) => ({ url: "https://example.com/a", title, text });

describe("heuristic claim extractor", () => {
  it("extracts megawatts and normalises gigawatts", async () => {
    const claims = await heuristicExtractor.extract(
      item("Campus announced", "The site will draw 450 megawatts at full build."),
    );
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ metricType: "POWER_MW", numericValue: 450, unit: "MW" });

    const gw = await heuristicExtractor.extract(item("Big site", "A 1.2 GW campus."));
    expect(gw[0]?.numericValue).toBe(1200);
  });

  it("never proposes anything above LOW confidence", async () => {
    const claims = await heuristicExtractor.extract(
      item("Announcement", "A 300 megawatt site with 50,000 GPUs and $2 billion invested."),
    );
    expect(claims.length).toBeGreaterThan(0);
    // The machine may not promote its own guesses; only a reviewer can.
    for (const claim of claims) expect(claim.confidenceLevel).toBe("LOW");
  });

  it("quotes the source sentence so a reviewer can reject at a glance", async () => {
    const claims = await heuristicExtractor.extract(
      item("News", "Unrelated opener. The campus will reach 250 megawatts by 2027."),
    );
    expect(claims[0]?.methodology).toContain("250 megawatts");
    expect(claims[0]?.methodology).toMatch(/unverified/i);
  });

  it("rejects implausible magnitudes rather than inventing a claim", async () => {
    // 0.5 MW is below a trackable datacentre; 999,999 GW is a misparse.
    const tooSmall = await heuristicExtractor.extract(item("x", "A 0.5 MW closet."));
    const tooBig = await heuristicExtractor.extract(item("x", "A 999999 GW facility."));
    expect(tooSmall).toHaveLength(0);
    expect(tooBig).toHaveLength(0);
  });

  it("scales capex suffixes", async () => {
    const claims = await heuristicExtractor.extract(item("x", "A $1.5 billion investment."));
    expect(claims[0]).toMatchObject({ metricType: "CAPEX_USD", numericValue: 1_500_000_000 });
  });

  it("deduplicates repeated figures and caps output", async () => {
    const repeated = Array.from(
      { length: 20 },
      (_, i) => `Phase ${i} needs 100 megawatts.`,
    ).join(" ");
    const claims = await heuristicExtractor.extract(item("x", repeated));
    // The same value repeated collapses to one claim.
    expect(claims.filter((c) => c.metricType === "POWER_MW")).toHaveLength(1);
    expect(claims.length).toBeLessThanOrEqual(6);
  });

  it("returns nothing when there is no number to read", async () => {
    const claims = await heuristicExtractor.extract(
      item("Company opens new campus", "No figures were disclosed."),
    );
    expect(claims).toHaveLength(0);
  });

  it("resolves extractors by key and rejects unknown ones", () => {
    expect(getExtractor("heuristic").key).toBe("heuristic");
    expect(getExtractor(undefined)).toBe(noopExtractor);
    expect(() => getExtractor("gpt-9")).toThrow(/unknown extractor/i);
  });
});

describe("feed parsing", () => {
  it("parses RSS items", () => {
    const items = parseFeed(`
      <rss><channel>
        <item>
          <title>A 200 MW campus</title>
          <link>https://example.com/a</link>
          <description><![CDATA[<p>Some <b>markup</b> &amp; text.</p>]]></description>
          <pubDate>Wed, 01 Jul 2026 10:00:00 GMT</pubDate>
        </item>
      </channel></rss>`);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("A 200 MW campus");
    expect(items[0]?.url).toBe("https://example.com/a");
    // CDATA unwrapped, tags stripped, entities decoded.
    expect(items[0]?.text).toBe("Some markup & text.");
    expect(items[0]?.publicationDate?.getUTCFullYear()).toBe(2026);
  });

  it("parses Atom entries with href links", () => {
    const items = parseFeed(`
      <feed>
        <entry>
          <title>Atom item</title>
          <link rel="alternate" href="https://example.com/b"/>
          <summary>Summary text.</summary>
          <published>2026-07-01T10:00:00Z</published>
        </entry>
      </feed>`);
    expect(items[0]).toMatchObject({ title: "Atom item", url: "https://example.com/b" });
  });

  it("drops entries without an absolute URL", () => {
    const items = parseFeed(`
      <rss><channel>
        <item><title>Relative</title><link>/relative/path</link></item>
        <item><title>No link</title></item>
      </channel></rss>`);
    // A relative link cannot be resolved without guessing a base, and a guessed
    // base produces dead citations.
    expect(items).toHaveLength(0);
  });
});
