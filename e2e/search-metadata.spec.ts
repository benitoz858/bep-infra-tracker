import { expect, test } from "@playwright/test";

const origin = "https://tracker.bepresearch.com";

test("distinct public pages declare themselves, not the homepage, as canonical", async ({
  page,
}) => {
  for (const path of [
    "dashboard",
    "projects",
    "siting",
    "submit",
    "methodology",
    "analytics",
    "map",
    "companies",
    "sources",
    "verification",
  ]) {
    await page.goto(`/${path}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${origin}/${path}`,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      `${origin}/${path}`,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      `${origin}/og.png`,
    );
  }
});

test("sitemap detail pages carry their own canonical and sharing identity", async ({
  page,
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).not.toContain(`<loc>${origin}</loc>`);
  for (const kind of ["projects", "companies"]) {
    const match = xml.match(new RegExp(`<loc>${origin}/${kind}/([^<]+)</loc>`));
    expect(match).not.toBeNull();
    const path = `/${kind}/${match![1]}`;
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      origin + path,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      origin + path,
    );
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      "BEP AI Infrastructure Tracker",
    );
  }
});

test("sign-in and registration remain excluded from indexing", async ({ page }) => {
  for (const path of ["login", "register"]) {
    await page.goto(`/${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});
