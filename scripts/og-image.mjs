/**
 * Regenerates the social share card at src/app/opengraph-image.png.
 *
 * Run with `npm run og:image` after changing the wording. The output is
 * committed, so this is a maintainer task rather than a build step — which is
 * deliberate:
 *
 * `next/og`'s ImageResponse would render the card at request time instead, and
 * that is the usual answer. It is the wrong one here. ImageResponse compiles
 * Satori and resvg as WebAssembly, and this app already deploys to Workers
 * through a careful WASM arrangement (see scripts/cf-build.mjs) that exists
 * because Workers refuse to compile WASM from bytes at runtime. A static PNG
 * keeps the share card entirely out of that problem, and the card has no
 * per-page content to justify the risk — it is one image for the whole site.
 *
 * The card deliberately states no figures. A number baked into a PNG cannot be
 * corrected the way the tracker's own data can, and a stale megawatt total on a
 * card advertising provenance would be its own refutation.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outFile = path.join(root, "src/app/opengraph-image.png");

const FONTS = {
  inter400: "Inter:wght@400",
  inter600: "Inter:wght@600",
  inter800: "Inter:wght@800",
  mono500: "JetBrains+Mono:wght@500",
};

/**
 * Fetches one weight as a base64 data URI.
 *
 * Google varies the stylesheet by client: a browser user-agent gets one
 * @font-face per unicode subset, while a plain fetch gets a single block
 * pointing at the full TTF. Both shapes have to work, and the subset case needs
 * the *latin* block specifically — taking the first one yields a 1 KB cyrillic
 * subset that silently renders the whole card in a fallback face.
 */
async function loadFont(family) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family}&display=swap`,
    {
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36",
      },
    },
  ).then((response) => response.text());

  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const chosen =
    blocks.find((block) => block.includes("U+0000-00FF")) ??
    (blocks.length === 1 ? blocks[0] : undefined);

  const url = chosen?.match(/url\((https:\/\/[^)]+)\)/)?.[1];
  if (!url) throw new Error(`No usable latin face found for ${family}`);

  const bytes = Buffer.from(
    await fetch(url).then((response) => response.arrayBuffer()),
  );
  const mime = url.endsWith(".woff2") ? "font/woff2" : "font/ttf";
  return {
    src: `data:${mime};base64,${bytes.toString("base64")}`,
    format: mime === "font/woff2" ? "woff2" : "truetype",
  };
}

const card = (fonts) => `
<meta charset="utf-8" />
<style>
  @font-face { font-family: "Inter"; font-weight: 400; src: url("${fonts.inter400.src}") format("${fonts.inter400.format}"); }
  @font-face { font-family: "Inter"; font-weight: 600; src: url("${fonts.inter600.src}") format("${fonts.inter600.format}"); }
  @font-face { font-family: "Inter"; font-weight: 800; src: url("${fonts.inter800.src}") format("${fonts.inter800.format}"); }
  @font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url("${fonts.mono500.src}") format("${fonts.mono500.format}"); }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }

  /* Palette is lifted from globals.css so the card and the app cannot drift. */
  body {
    background: #0a0a0a; color: #e8e8e8;
    font-family: "Inter", sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative; overflow: hidden;
  }

  /* The app is a terminal for reading numbers off charts, so the card carries
     the same plot substrate rather than a flat marketing slab. */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, #ffffff08 1px, transparent 1px),
      linear-gradient(to bottom, #ffffff08 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; left: 0; right: 0; bottom: 0; height: 340px;
    background: radial-gradient(120% 100% at 12% 100%, #00d4ff1f 0%, transparent 62%);
  }
  .rule-top { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #00d4ff; }

  .frame { position: relative; height: 100%; padding: 64px 72px 56px; display: flex; flex-direction: column; }

  .brand { display: flex; align-items: center; gap: 16px; }
  .mark {
    font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 20px;
    letter-spacing: 0.14em; color: #0a0a0a; background: #00d4ff;
    padding: 7px 12px 6px; border-radius: 4px;
  }
  .wordmark {
    font-size: 17px; font-weight: 600; letter-spacing: 0.26em;
    text-transform: uppercase; color: #9a9a9a;
  }

  .headline {
    margin-top: auto; font-size: 78px; font-weight: 800;
    line-height: 1.02; letter-spacing: -0.032em; max-width: 20ch;
  }
  .headline .accent { color: #00d4ff; }

  .sub { margin-top: 26px; font-size: 27px; line-height: 1.36; color: #9a9a9a; max-width: 44ch; }

  .rules { margin-top: 40px; display: flex; gap: 12px; }
  .chip {
    font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 16px;
    color: #c8c8c8; border: 1px solid #333333; background: #1111119c;
    border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; gap: 9px;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #76b900; }
  .dot.cyan { background: #00d4ff; }
  .dot.amber { background: #ffb800; }

  .footer {
    margin-top: auto; padding-top: 34px; border-top: 1px solid #262626;
    display: flex; align-items: baseline; justify-content: space-between;
    font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 19px;
  }
  .url { color: #00d4ff; letter-spacing: -0.01em; }
  .meta { color: #6b6b6b; font-size: 16px; letter-spacing: 0.02em; }
</style>

<div class="grid"></div>
<div class="glow"></div>
<div class="rule-top"></div>

<div class="frame">
  <div class="brand">
    <div class="mark">BEP</div>
    <div class="wordmark">AI Infrastructure Tracker</div>
  </div>

  <h1 class="headline">Confirmed capacity,<br /><span class="accent">not announcements.</span></h1>

  <p class="sub">Open data on global AI compute, power and supply chain — with a source behind every figure.</p>

  <div class="rules">
    <div class="chip"><span class="dot cyan"></span>Estimates never merge with confirmed</div>
    <div class="chip"><span class="dot amber"></span>Unknown is never zero</div>
    <div class="chip"><span class="dot"></span>Every claim carries its source</div>
  </div>

  <div class="footer">
    <span class="url">tracker.bepresearch.com</span>
    <span class="meta">OPEN DATA · CC BY 4.0</span>
  </div>
</div>
`;

const fonts = Object.fromEntries(
  await Promise.all(
    Object.entries(FONTS).map(async ([key, family]) => [key, await loadFont(family)]),
  ),
);

const browser = await chromium.launch(
  // Set this when the sandbox ships a Chromium that Playwright did not install
  // itself; a normal `npx playwright install chromium` needs no override.
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);

const page = await browser.newPage({
  // 1200x630 is the Open Graph and Twitter summary_large_image size.
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.setContent(card(fonts), { waitUntil: "load" });
// Fonts are inlined as data URIs, but the face still has to be parsed and
// applied before the shot or the card renders in a fallback.
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: outFile });
await browser.close();

const { size } = await fs.stat(outFile);
console.log(
  `[og-image] wrote ${path.relative(root, outFile)} (${Math.round(size / 1024)} KB)`,
);
