/**
 * Writes a public CC BY 4.0 snapshot of the live database into data/.
 *
 * The point is that "open data" should not require running the application.
 * A committed CSV is curl-able and rendered by GitHub in the browser, so a
 * reader can check a figure without trusting the site.
 *
 * These files are output, never input: this script overwrites all of them,
 * including data/README.md. A correction has to reach the database — see
 * CONTRIBUTING.md.
 *
 * Run: npm run snapshot   (refreshed by .github/workflows/snapshot.yml)
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SNAPSHOT_BASE_URL ?? "https://tracker.bepresearch.com";
const OUT = path.resolve(import.meta.dirname, "..", "data");

const FILES = [
  ["projects.csv", "/api/projects/export?format=csv"],
  ["projects.json", "/api/projects/export?format=json"],
  ["companies.csv", "/api/companies/export?format=csv"],
  ["sources.csv", "/api/sources/export"],
  ["metrics.csv", "/api/sources/export?kind=metrics"],
];

fs.mkdirSync(OUT, { recursive: true });

/**
 * Retry on 5xx, and on the two status codes that mean "the edge did not like
 * the look of you" rather than "this resource is unavailable".
 *
 * 5xx: a cold Cloudflare Worker has to compile Prisma's WASM query compiler
 * before it can answer, and the first request after an idle period or a deploy
 * can exceed that budget.
 *
 * 403/429: Cloudflare bot protection challenges requests from datacenter
 * addresses, which is exactly where CI runs from. This job has already failed
 * that way once while the same request from a residential connection succeeded.
 * Retrying is a mitigation, not a fix — if it recurs, the real answer is a WAF
 * skip rule for /api/*, because the same block hits any researcher scripting
 * against a supposedly open API.
 */
const RETRYABLE = new Set([403, 408, 425, 429]);

async function fetchWithRetry(url, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, {
      // Identify the caller. A bot filter treats an anonymous datacenter
      // request far more harshly than a named one, and it is good manners.
      headers: {
        "user-agent":
          "bep-infra-tracker-snapshot/1.0 (+https://github.com/benitoz858/bep-infra-tracker)",
        accept: "text/csv, application/json;q=0.9, */*;q=0.5",
      },
    });
    if (res.ok) return res;
    last = `${res.status} ${res.statusText}`;
    if (!RETRYABLE.has(res.status) && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw new Error(`${url} -> ${last}`);
}

for (const [name, route] of FILES) {
  const res = await fetchWithRetry(`${BASE}${route}`);
  const body = await res.text();
  fs.writeFileSync(path.join(OUT, name), body);
  console.log(`${name.padEnd(16)} ${body.split("\n").length - 1} lines`);
}

fs.writeFileSync(
  path.join(OUT, "README.md"),
  `# Data snapshot

Machine-readable export of the live tracker, refreshed automatically.

> **Generated — do not edit.** Every file in this directory, including this
> README, is rebuilt from the database nightly and force-committed, so a change
> made here is overwritten within a day. To correct a figure,
> [open an issue](https://github.com/benitoz858/bep-infra-tracker/issues/new?labels=data)
> with a source; see [CONTRIBUTING.md](../CONTRIBUTING.md).

| File | Contents |
| --- | --- |
| \`projects.csv\` / \`projects.json\` | One row per project. Estimated and confirmed figures are **separate columns** — \`power_mw_basis\` tells you which one to trust for that row. |
| \`companies.csv\` | Owners, operators and vendors, with tickers where listed. |
| \`sources.csv\` | Every source cited, with publisher and reliability score. |
| \`metrics.csv\` | One row per individual claim, with its confidence level, methodology and the source backing it. This is the provenance trail. |

## Reading it honestly

- **A blank cell means "not disclosed", never zero.** Do not fill blanks with 0
  before summing — you will invent capacity that nobody announced.
- **Announced is not confirmed.** Most capacity in this dataset is announced and
  not yet energised. Use \`power_mw_basis\`, and check \`metrics.csv\` for the
  confidence level behind any figure you intend to cite.
- **Rows with \`is_demo_data=TRUE\` are illustrative** and must not be used in
  analysis. Production should contain none; the column exists so that promise is
  checkable rather than merely stated.

Licensed **CC BY 4.0**. Credit: BEP AI Infrastructure Tracker (BEP Research),
https://tracker.bepresearch.com
`,
);
console.log("snapshot written to data/");
