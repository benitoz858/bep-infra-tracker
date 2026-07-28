/**
 * Rotates the production DATABASE_URL everywhere it lives, in one paste.
 *
 * The credential lives in three places and production breaks the moment they
 * disagree: the Cloudflare Worker (runtime), the GitHub Actions secret (the
 * ingest job), and .env (local scripts and migrations).
 *
 * Validate first, write second. An earlier rotation pasted a string that had
 * lost its password and picked up a newline, and because the writes happened
 * before any check, the bad value reached the Worker and took the site down.
 * Nothing here writes until the string has parsed AND opened a real connection.
 *
 *   printf '%s' "$URL" | node scripts/set-database-url.mjs
 *
 * The URL arrives on stdin so it never appears in argv, which is world-readable
 * in `ps`. Nothing in this file prints the credential.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// pg directly rather than Prisma: the generated client is TypeScript and would
// drag tsx into what needs to be a script that runs when the site is down.
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_KEY = "PRODUCTION_DATABASE_URL";

function read(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (data += chunk));
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

function fail(message) {
  console.error(`FAIL — ${message}`);
  console.error("Nothing was changed.");
  process.exit(1);
}

const raw = await read(process.stdin);
// A paste routinely arrives with a trailing newline, surrounding quotes, or a
// `psql ` prefix copied along with the command Neon displays.
const url = raw
  .trim()
  .replace(/^psql\s+/, "")
  .replace(/^['"]|['"]$/g, "")
  .trim();

if (!url) fail("nothing was pasted.");
if (/\s/.test(url)) fail("the string contains a space or newline in the middle.");

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail("that is not a URL. Expected postgresql://user:password@host/database?sslmode=require");
}

if (!/^postgres(ql)?:$/.test(parsed.protocol)) fail(`protocol is "${parsed.protocol}", expected postgresql:`);
if (!parsed.username) fail("no username in the connection string.");
if (!parsed.password) fail("no password in the connection string — check you copied the whole line.");
if (!parsed.hostname) fail("no host in the connection string.");
if (!parsed.pathname.replace(/^\//, "")) fail("no database name in the connection string.");

console.log("Parsed:");
console.log(`  user     ${parsed.username}`);
console.log(`  host     ${parsed.hostname}`);
console.log(`  database ${parsed.pathname.replace(/^\//, "")}`);
console.log(`  password ${parsed.password.length} characters`);

process.stdout.write("Opening a connection… ");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  // Counting a real table proves both the credential and that this is the
  // right database — a valid login to an empty project would otherwise pass.
  const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM "Project"');
  console.log(`ok — ${rows[0].n} projects visible.`);
} catch (error) {
  console.log("");
  fail(`could not connect: ${String(error.message ?? error).slice(0, 160)}`);
} finally {
  await client.end().catch(() => {});
}

// Only now does anything get written.
console.log("Writing:");

execFileSync("npx", ["wrangler", "secret", "put", "DATABASE_URL"], {
  input: url,
  cwd: ROOT,
  stdio: ["pipe", "ignore", "inherit"],
});
console.log("  Cloudflare Worker secret");

execFileSync("gh", ["secret", "set", "DATABASE_URL"], {
  input: url,
  cwd: ROOT,
  stdio: ["pipe", "ignore", "inherit"],
});
console.log("  GitHub Actions secret");

const contents = fs.readFileSync(ENV_FILE, "utf8");
const line = `${ENV_KEY}="${url}"`;
// Replace via a function so nothing in the credential is read as a
// backreference — a `$1` inside a password would otherwise corrupt the write.
const next = new RegExp(`^${ENV_KEY}=.*$`, "m").test(contents)
  ? contents.replace(new RegExp(`^${ENV_KEY}=.*$`, "m"), () => line)
  : `${contents.replace(/\n*$/, "\n")}${line}\n`;
fs.writeFileSync(ENV_FILE, next);
console.log(`  .env ${ENV_KEY}`);

console.log("PASS — all three updated. The Worker picks this up without a redeploy.");
