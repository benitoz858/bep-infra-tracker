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

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString() }),
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
