/**
 * Production-safe seed: creates (or updates) the admin user and nothing else.
 *
 * `npm run db:seed` writes 16 demo projects, 8 demo restrictions and their
 * evidence. Those exist to develop the UI against and are flagged `isDemoData`,
 * but a live tracker whose headline reads "1.9 GW at risk" from invented figures
 * is a liability even behind a login — so production gets this script instead.
 *
 *   npm run db:seed:admin                    # uses DATABASE_URL
 *   npm run db:seed:admin:production         # uses PRODUCTION_DATABASE_URL
 *
 * Idempotent: re-running resets the password to the current env value rather
 * than failing or creating a second account.
 */
import "dotenv/config";

import { hash } from "bcryptjs";

import { prisma } from "../src/lib/db";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "BEP Admin";

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set before seeding an admin.",
    );
  }
  if (password.length < 12) {
    // Matches the policy the user-management form enforces; a weak password on
    // the one account that can manage every other account is the worst place
    // to make an exception.
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", name, passwordHash },
    create: { email, name, role: "ADMIN", passwordHash },
    select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
  });

  const created = user.createdAt.getTime() === user.updatedAt.getTime();
  console.log(`${created ? "Created" : "Updated"} admin: ${user.email}`);

  // State the shape of the database it just wrote to, so running this against
  // the wrong URL is obvious immediately rather than three steps later.
  const [users, projects, restrictions] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.restriction.count(),
  ]);
  console.log(
    `Database now holds ${users} user(s), ${projects} project(s), ${restrictions} restriction(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
