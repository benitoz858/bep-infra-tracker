/**
 * Watcher runner. Invoked by `npm run ingest` and by the scheduled workflow.
 *
 *   npm run ingest                          # all watchers, last 7 days
 *   npm run ingest -- --watcher rss:aws-news
 *   npm run ingest -- --since 2026-01-01 --extractor heuristic
 *   npm run ingest -- --list
 *
 * Writes only to the ingestion staging tables. Nothing it produces appears in
 * any dashboard total until a human accepts it at /ingest.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { WATCHERS, getWatcher } from "../src/lib/ingest/watchers";
import { runWatcher } from "../src/lib/services/ingestion";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  if (has("list")) {
    console.log("Available watchers:\n");
    for (const w of WATCHERS) console.log(`  ${w.key.padEnd(32)} ${w.label}`);
    return;
  }

  const key = arg("watcher");
  const watchers = key ? [getWatcher(key)] : WATCHERS;
  if (key && !watchers[0]) {
    console.error(`Unknown watcher "${key}". Run with --list to see the options.`);
    process.exitCode = 1;
    return;
  }

  const sinceArg = arg("since");
  const since = sinceArg
    ? new Date(sinceArg)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Default to the heuristic extractor: it is conservative, and its output is
  // capped at LOW confidence and staged for review either way.
  const extractorKey = arg("extractor") ?? "heuristic";
  const limit = Number(arg("limit") ?? 40);

  console.log(
    `Ingest: ${watchers.length} watcher(s), since ${since.toISOString().slice(0, 10)}, extractor "${extractorKey}"\n`,
  );

  let totalNew = 0;
  let failures = 0;

  for (const watcher of watchers) {
    if (!watcher) continue;
    process.stdout.write(`  ${watcher.key.padEnd(32)} `);

    const summary = await runWatcher(watcher, { since, limit, extractorKey });

    if (summary.failed) {
      failures += 1;
      console.log(`FAILED — ${summary.error}`);
    } else {
      totalNew += summary.itemsNew;
      console.log(`${summary.itemsSeen} seen, ${summary.itemsNew} new`);
    }
  }

  const pending = await prisma.ingestionCandidate.count({ where: { status: "PENDING" } });
  console.log(`\n${totalNew} new candidate(s). ${pending} awaiting review at /ingest.`);

  if (failures > 0) {
    console.log(`${failures} watcher(s) failed — see the runs table on /ingest.`);
    // Non-zero so a scheduled run surfaces as a failed job rather than passing
    // quietly with no results.
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
