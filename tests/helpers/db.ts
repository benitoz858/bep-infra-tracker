import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Test database client and reset helper.
 *
 * A dedicated client (rather than lib/db's singleton) so a test file can be run
 * in isolation and so the connection is closed deterministically in afterAll.
 */
export const testDb = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.TEST_DATABASE_URL as string,
  }),
});

/**
 * Truncate every table. TRUNCATE ... CASCADE in one statement is both faster
 * than per-model deleteMany and immune to foreign-key ordering, which otherwise
 * has to be maintained by hand as the schema grows.
 */
export async function resetDatabase(): Promise<void> {
  await testDb.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ProjectRestriction",
      "RestrictionSource",
      "Restriction",
      "IngestionCandidate",
      "IngestionRun",
      "ProjectRevision",
      "ProjectMetric",
      "Source",
      "ProjectCompany",
      "_ProjectTags",
      "Project",
      "Company",
      "Tag",
      "Account",
      "Session",
      "VerificationToken",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function disconnectTestDb(): Promise<void> {
  await testDb.$disconnect();
}
