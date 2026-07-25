import { expect, test } from "@playwright/test";

/**
 * The lifecycle the spec asks for, end to end against a real database:
 * log in → create a project → add a source → add a power metric → save →
 * open the detail page → confirm the metric and source are displayed.
 *
 * The project name is unique per run so repeated runs never collide, and the
 * record is deleted at the end so the dev database is left as it was found.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@bepresearch.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "changeme-in-dev";

const RUN_ID = String(Date.now()).slice(-8);
const PROJECT_NAME = `E2E Verification Campus ${RUN_ID}`;
const SOURCE_TITLE = `E2E utility filing ${RUN_ID}`;
const SOURCE_URL = `https://example.com/e2e/${RUN_ID}`;
const POWER_MW = "275";

test("log in, create a project with a sourced power metric, and see it on the detail page", async ({
  page,
}) => {
  // ---- 1. Log in ---------------------------------------------------------
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // ---- 2. Create a project ----------------------------------------------
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Add project" })).toBeVisible();

  await page.locator("#name").fill(PROJECT_NAME);
  await page.locator("#country").fill("United States");
  await page.locator("#city").fill("Ashburn");
  await page.locator("#projectType").selectOption("DATA_CENTER");
  await page.locator("#status").selectOption("UNDER_CONSTRUCTION");
  await page.locator("#estimatedPowerMw").fill(POWER_MW);

  // ---- 3. Add a source ---------------------------------------------------
  await page.getByRole("button", { name: "Add source" }).click();

  await page.getByLabel("Source 1 title").fill(SOURCE_TITLE);
  await page.getByLabel("Source 1 publisher").fill("Example Utility");
  await page.getByLabel("Source 1 URL").fill(SOURCE_URL);
  await page.getByLabel("Source 1 type").selectOption("UTILITY_FILING");
  await page.getByLabel("Source 1 reliability score").fill("96");

  // ---- 4. Add a power metric citing that source --------------------------
  await page.getByRole("button", { name: "Add claim" }).click();

  await page.getByLabel("Claim 1 metric type").selectOption("POWER_MW");
  await page.getByLabel("Claim 1 value").fill(POWER_MW);
  await page.getByLabel("Claim 1 unit").fill("MW");
  await page.getByLabel("Claim 1 confidence").selectOption("CONFIRMED");
  await page
    .getByLabel("Claim 1 methodology")
    .fill("Stated load in the interconnection filing.");

  // A CONFIRMED claim must cite a source; the unsaved source is offered as
  // "new:0" and resolved server-side after it is persisted.
  await page.getByLabel("Claim 1 source").selectOption({ label: SOURCE_TITLE });

  // ---- 5. Save -----------------------------------------------------------
  await page.getByRole("button", { name: "Create project" }).click();

  // ---- 6. Land on the detail page ---------------------------------------
  await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();

  // ---- 7. Confirm the metric and the source are displayed ---------------
  const evidence = page.locator("table").filter({ hasText: "Basis / methodology" });
  await expect(evidence).toContainText("Power");
  await expect(evidence).toContainText("275 MW");
  await expect(evidence).toContainText("Confirmed");
  await expect(evidence).toContainText("Stated load in the interconnection filing.");
  // The metric renders its source's publisher, proving the citation resolved.
  await expect(evidence).toContainText("Example Utility");

  // The source itself is listed, with its type and reliability.
  await expect(page.getByRole("link", { name: SOURCE_TITLE })).toBeVisible();
  await expect(page.getByText("Utility filing").first()).toBeVisible();
  await expect(page.getByText("96/100")).toBeVisible();

  // The key-metrics panel shows the estimate and labels it as such.
  await expect(page.getByText("275 MW").first()).toBeVisible();

  // Confidence breakdown: exactly one claim, and it is cited.
  await expect(page.getByText("1/1")).toBeVisible();

  // A hand-entered project must not be flagged as demo data.
  await expect(page.getByText("Demo data — not verified")).toHaveCount(0);

  // ---- Cleanup -----------------------------------------------------------
  const projectId = await page.evaluate(async (slugSource) => {
    const response = await fetch(
      `/api/projects?q=${encodeURIComponent(slugSource)}&perPage=5`,
    );
    const body = (await response.json()) as { data: { rows: { id: string }[] } };
    return body.data.rows[0]?.id ?? null;
  }, PROJECT_NAME);

  expect(projectId).not.toBeNull();

  const deleted = await page.evaluate(async (id) => {
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    return response.ok;
  }, projectId as string);

  expect(deleted).toBe(true);
});

test("rejects a confirmed metric that cites no source", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/projects/new");
  await page.locator("#name").fill(`E2E Uncited ${RUN_ID}`);
  await page.locator("#country").fill("United States");

  await page.getByRole("button", { name: "Add claim" }).click();
  await page.getByLabel("Claim 1 value").fill("100");
  await page.getByLabel("Claim 1 confidence").selectOption("CONFIRMED");
  // Deliberately leave the source as "No source (estimate only)".

  await page.getByRole("button", { name: "Create project" }).click();

  // The data-quality rule must block the save and say why.
  await expect(page.getByText("A confirmed metric must cite a source.")).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/new$/);
});
