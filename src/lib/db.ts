import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { cache } from "react";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 talks to Postgres through a driver adapter rather than the bundled
// Rust engine, so the connection string is supplied here rather than in
// schema.prisma. TEST_DATABASE_URL wins under Vitest so an integration run can
// never truncate the development database.
function connectionString(): string {
  const url =
    process.env.NODE_ENV === "test"
      ? (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)
      : process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
    );
  }
  return url;
}

/**
 * Declared, not detected.
 *
 * This used to read `navigator.userAgent === "Cloudflare-Workers"`. That check
 * is not reliable inside a Next bundle running under `nodejs_compat`: unenv
 * installs its own `navigator` polyfill, so the Worker can fail its own
 * identity test and fall through to the pooled TCP driver — which a Worker is
 * not allowed to keep between requests. `RUNTIME` is set in wrangler.jsonc, so
 * the answer comes from configuration rather than from inference.
 */
function isWorkersRuntime(): boolean {
  return process.env.RUNTIME === "workers";
}

/**
 * Two drivers, chosen by runtime.
 *
 * node-postgres needs a persistent pooled TCP connection — right for dev,
 * scripts, tests and CI. A Worker has nowhere to keep a pool between requests,
 * so it uses Neon's serverless driver instead.
 *
 * The matching *client* swap (the Workers build needs a different generated
 * client entirely, because of WASM) happens on disk in scripts/cf-build.mjs —
 * see that file for why it cannot be done with a conditional import.
 */
function createPrismaClient() {
  const url = connectionString();

  return new PrismaClient({
    adapter: isWorkersRuntime()
      ? new PrismaNeon({ connectionString: url })
      : new PrismaPg({ connectionString: url }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type Client = ReturnType<typeof createPrismaClient>;

/**
 * On Workers a client must not outlive the request that opened it.
 *
 * Its connection is request-scoped I/O, and touching it from a later request
 * fails with "Cannot perform I/O on behalf of a different request". That does
 * not surface as a clean error: the request hangs, the runtime kills the Worker
 * for never producing a response, and the caller receives a truncated HTML
 * stream — a page permanently stuck on its loading skeleton, with nothing in
 * the browser console to explain it. Roughly one page load in three failed this
 * way before the client was made per-request.
 *
 * React's `cache` scopes a value to a single server request, which is exactly
 * the lifetime a Worker's socket is allowed to have. Every Workers entry point
 * here (server components, server actions, route handlers) runs inside that
 * request context.
 */
const requestClient = cache(createPrismaClient);

// Under Node the opposite is true: a pool is the point, and re-creating it per
// request would exhaust Postgres connections. Dev additionally re-evaluates
// modules on every hot reload, so the singleton is parked on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function nodeClient(): Client {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/**
 * Resolved per property access so call sites can keep importing `prisma` as a
 * value. Creation stays lazy, which also means a missing DATABASE_URL now
 * fails on first query rather than at module load — the difference between a
 * readable error and a Worker that dies during startup.
 */
export const prisma: Client = new Proxy({} as Client, {
  get(_target, property) {
    const client = isWorkersRuntime() ? requestClient() : nodeClient();
    const value = Reflect.get(client, property, client) as unknown;
    // Prisma's own methods ($transaction, $queryRaw) rely on `this`; model
    // delegates are plain objects and pass through untouched.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
