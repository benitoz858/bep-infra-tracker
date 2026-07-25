import "dotenv/config";

/**
 * Vitest setup.
 *
 * `NODE_ENV === "test"` is what makes lib/db.ts pick TEST_DATABASE_URL. Vitest
 * sets it, so this asserts rather than assigns — NODE_ENV is typed readonly, and
 * an assignment that silently failed would point the services at the development
 * database while assertions read the test one. These checks exist because the
 * suite truncates every table it touches.
 */
if (process.env.NODE_ENV !== "test") {
  throw new Error(
    `Expected NODE_ENV=test, got "${process.env.NODE_ENV}". The suite would ` +
      "otherwise run the services against DATABASE_URL.",
  );
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy .env.example to .env — the integration " +
      "suite refuses to run against DATABASE_URL.",
  );
}

if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL. The suite truncates every " +
      "table between tests.",
  );
}
