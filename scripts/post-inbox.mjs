/**
 * Forwards research-inbox files into the tracker's submission queue.
 *
 *   node scripts/post-inbox.mjs [dir]
 *
 * Why this exists: the daily cloud research agent cannot always POST to the
 * tracker directly (its sandbox may restrict outbound network), but it can
 * always push to this repo. So it writes findings to research/inbox/*.json on
 * an agent/** branch, and the agent-inbox workflow runs this script from a
 * GitHub runner, which demonstrably can reach the API.
 *
 * Each file holds {"submissions":[<POST /api/submissions payloads>]}. This is
 * a dumb pipe on purpose — validation, URL dedup (409), rate limits and the
 * confidence cap all live in the API, and the queue is still reviewed by a
 * human. A 409 means the tracker already knows the URL: success, not failure.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] ?? "research/inbox";
const API = "https://tracker.bepresearch.com/api/submissions";

if (!fs.existsSync(DIR)) {
  console.log(`no ${DIR} directory — nothing to forward`);
  process.exit(0);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
let posted = 0;
let known = 0;
let failed = 0;

for (const file of files) {
  let payloads;
  try {
    payloads = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")).submissions;
  } catch (error) {
    console.log(`SKIP ${file}: unparseable (${error.message})`);
    failed += 1;
    continue;
  }
  for (const p of payloads ?? []) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.ok) {
      posted += 1;
      console.log(`queued   ${String(p.title).slice(0, 70)}`);
    } else if (res.status === 409) {
      known += 1;
      console.log(`known    ${String(p.title).slice(0, 70)}`);
    } else if (res.status === 429) {
      console.log("rate limited — stopping; the rest will forward on a later run");
      break;
    } else {
      failed += 1;
      const body = await res.text().catch(() => "");
      console.log(`FAILED ${res.status} ${String(p.title).slice(0, 60)} ${body.slice(0, 120)}`);
    }
  }
}

console.log(`\n${posted} queued, ${known} already known, ${failed} failed`);
// Failures should be visible in the Actions UI, but a partial forward is still
// a success — the API rejected those items for a reason a human should read.
process.exit(failed > 0 ? 1 : 0);
