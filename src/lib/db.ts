import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

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
 * Cloudflare Workers identify themselves through navigator.userAgent. Checking
 * the runtime rather than the URL is deliberate: a Neon URL is still best served
 * by the pooled pg driver when running under Node, which is exactly what the
 * seed and migration scripts do.
 */
function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as { userAgent?: string }).userAgent === "Cloudflare-Workers"
  );
}

/**
 * Two drivers, chosen at runtime.
 *
 * node-postgres needs a persistent pooled TCP connection — right for dev,
 * scripts, tests and CI. A Worker has nowhere to keep a pool between requests
 * and would leak a connection per invocation until Neon refused new ones, so it
 * uses Neon's HTTP/WebSocket driver instead.
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

// Next.js dev mode re-evaluates modules on every hot reload; without the global
// cache each reload would open a new pool and exhaust Postgres connections.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
