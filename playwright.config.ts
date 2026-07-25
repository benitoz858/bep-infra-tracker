import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3320);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end config.
 *
 * The suite runs against the development database and the seeded admin user, so
 * `npm run db:seed` must have been run at least once. Each spec creates its own
 * uniquely-named project and cleans up after itself rather than truncating —
 * these tests must never destroy an analyst's real data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "dark",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    // Reuse a dev server that is already up; only CI needs a fresh one.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
