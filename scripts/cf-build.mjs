/**
 * Cloudflare build wrapper.
 *
 * Why this exists rather than a conditional import:
 *
 * The Workers build needs a *different* generated Prisma client. The default one
 * fetches its WASM query compiler as base64 and calls `new WebAssembly.Module`,
 * which Workers refuse outright ("Wasm code generation disallowed by embedder").
 * The `runtime = "workerd"` generator instead emits a static
 * `./query_compiler_fast_bg.wasm?module` import that the platform compiles ahead
 * of time.
 *
 * A package.json conditional subpath import (`workerd` vs `default`) was the
 * obvious mechanism and does not work here: `next build` resolves the import and
 * inlines the Node client into its server output *before* the OpenNext esbuild
 * pass — which is the only step that applies the `workerd` condition — so the
 * condition never gets a chance to fire.
 *
 * So the swap happens on disk instead, around the build, and is always undone.
 *
 * Prisma's workerd generator also does not emit the .wasm file its own import
 * points at, so it is copied from the CLI package. Re-check that on Prisma
 * upgrades; if the generator starts emitting it, this copy becomes redundant
 * rather than wrong.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const nodeClient = path.join(root, "src/generated/prisma");
const workersClient = path.join(root, "src/generated/prisma-workers");
const backup = path.join(root, "src/generated/.prisma-node-backup");
const wasmSource = path.join(
  root,
  "node_modules/prisma/build/query_compiler_fast_bg.postgresql.wasm",
);
const wasmTarget = path.join(workersClient, "query_compiler_fast_bg.wasm");

function log(message) {
  console.log(`[cf-build] ${message}`);
}

function restore() {
  if (!fs.existsSync(backup)) return;
  fs.rmSync(nodeClient, { recursive: true, force: true });
  fs.renameSync(backup, nodeClient);
  log("restored the Node Prisma client");
}

function main() {
  if (!fs.existsSync(workersClient)) {
    throw new Error(
      "src/generated/prisma-workers is missing. Run `npx prisma generate` first.",
    );
  }

  if (!fs.existsSync(wasmTarget)) {
    if (!fs.existsSync(wasmSource)) {
      throw new Error(
        `Cannot find the Postgres query-compiler WASM at ${wasmSource}. ` +
          "Prisma may have changed where it ships it; see the comment at the top of this file.",
      );
    }
    fs.copyFileSync(wasmSource, wasmTarget);
    log("copied the query-compiler WASM into the workerd client");
  }

  // A leftover backup means a previous run died mid-build; the Node client in
  // place is the workerd one, so restore before doing anything else.
  restore();

  fs.renameSync(nodeClient, backup);
  fs.cpSync(workersClient, nodeClient, { recursive: true });
  log("swapped in the workerd Prisma client");

  try {
    execFileSync("npx", ["opennextjs-cloudflare", "build"], {
      cwd: root,
      stdio: "inherit",
    });
  } finally {
    restore();
  }
}

// Restore on interrupt too, so Ctrl-C does not leave a Workers client behind
// for `next dev` to choke on.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
}

try {
  main();
} catch (error) {
  restore();
  console.error(`[cf-build] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
