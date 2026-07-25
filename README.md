# BEP AI Infrastructure Tracker

**Global AI compute, power and supply-chain intelligence.**

A private research application tracking major AI infrastructure projects worldwide —
AI factories, hyperscale campuses, GPU clusters, sovereign AI programmes, neocloud
and colocation build-outs, HPC systems, and the power projects tied to them.

Built for a single analyst, with a schema and permission model that support
multiple users and paid enterprise access later.

---

## What makes this different from a spreadsheet

The product's value is **provenance**, not row count. Three rules are enforced
throughout, in the schema, the services, the API and the UI:

1. **Estimates and confirmed figures never merge.** `Project` carries
   `estimatedPowerMw` _and_ `confirmedPowerMw` as separate columns, and every
   surface labels which one it is showing. A dashboard total that mixes them says
   so.
2. **Unknown is not zero.** A blank field means "not disclosed"; `0` means a
   figure confirmed to be zero. `src/lib/format.ts` is the single enforcement
   point and carries an explicit warning against adding `|| 0` fallbacks.
3. **Every claim can be traced to a source.** `ProjectMetric` holds one row per
   claim, each with its own confidence level, methodology and citation. A metric
   marked `CONFIRMED` cannot be saved without a source that exists.

---

## Quick start

```bash
npm install
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Then open <http://localhost:3000> and sign in with the seeded admin
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env`).

Copy `.env.example` to `.env` first:

```bash
cp .env.example .env
openssl rand -base64 32   # paste into AUTH_SECRET
```

### No Docker? Use a local Postgres instead

The app only needs a Postgres 17 database; nothing else is containerised.

```bash
brew install postgresql@17
brew services start postgresql@17
createdb bep_infra_tracker
createdb bep_infra_tracker_test
```

Then point `DATABASE_URL` / `TEST_DATABASE_URL` at your local user (Homebrew
Postgres trusts it by default):

```
DATABASE_URL="postgresql://$(whoami)@localhost:5432/bep_infra_tracker?schema=public"
TEST_DATABASE_URL="postgresql://$(whoami)@localhost:5432/bep_infra_tracker_test?schema=public"
```

### Leave `AUTH_URL` unset in development

Auth.js derives redirect URLs from the request host when `AUTH_TRUST_HOST=true`.
Setting `AUTH_URL` pins them, which sends post-login redirects to the wrong port
whenever the dev server is not on 3000. Set it only in production.

### Mapbox

`/map` needs `NEXT_PUBLIC_MAPBOX_TOKEN` (a public `pk.*` token). Without it the
page renders a setup empty state and reports how many projects have coordinates;
every other page is unaffected.

---

## Scripts

| Script                            | Purpose                         |
| --------------------------------- | ------------------------------- |
| `npm run dev`                     | Development server              |
| `npm run build` / `start`         | Production build and serve      |
| `npm run typecheck`               | `tsc --noEmit`                  |
| `npm run lint` / `lint:fix`       | ESLint                          |
| `npm run format` / `format:check` | Prettier                        |
| `npm test` / `test:watch`         | Vitest (unit + integration)     |
| `npm run test:e2e`                | Playwright                      |
| `npm run test:e2e:install`        | Download the Playwright browser |
| `npm run check`                   | typecheck + lint + tests        |
| `npm run db:migrate`              | Create and apply a migration    |
| `npm run db:deploy`               | Apply migrations (production)   |
| `npm run db:seed`                 | Seed demo data + admin user     |
| `npm run db:reset`                | Drop, re-migrate, re-seed       |
| `npm run db:studio`               | Prisma Studio                   |

---

## Architecture

```
prisma/
  schema.prisma          9 models, 8 enums
  seed.ts                16 demo projects, all flagged isDemoData
src/
  app/
    (auth)  login/       credentials sign-in
    (app)/               authenticated shell + every page
    api/                 route handlers (thin; no business logic)
  components/            UI primitives (shadcn-style, vendored) + features
  lib/
    services/            ALL business logic lives here
    validations/         Zod schemas shared by forms, API and CSV import
    db.ts                Prisma client (driver-adapter based)
    capabilities.ts      role → capability matrix (pure, no auth imports)
    format.ts            "Not disclosed" / unknown-vs-zero enforcement
    serialize.ts         Decimal → string at the server/client boundary
tests/                   Vitest: unit + integration (real Postgres)
e2e/                     Playwright
```

**Business logic never sits in a component or a route handler.** Route handlers
authorise, parse with Zod, and call a service. Services own transactions,
revision-writing and aggregation, so each one is equally callable from a script,
a test, a server component or an HTTP request.

### Notes worth knowing before changing things

- **Prisma 7 uses a driver adapter.** The connection string is supplied in
  `src/lib/db.ts`, not in `schema.prisma`, and the generated client lands in
  `src/generated/prisma` (not `@prisma/client`).
- **Decimals are serialised to strings, not numbers**, before crossing to a
  client component. Prisma `Decimal` instances cannot be passed through the RSC
  boundary, and a double cannot represent every `Decimal(18,2)` capex exactly.
- **`lib/capabilities.ts` and `lib/search-types.ts` exist to stay import-clean.**
  Client components need the capability matrix and the search labels; importing
  them from `lib/permissions.ts` or `lib/services/search.ts` would pull
  `next-auth` and the Postgres driver into the browser bundle. (The latter
  actually happened — it fails at runtime only, with typecheck and lint green.)
- **Three verification rules are raw SQL by necessity.** Prisma's `where` cannot
  express "fewer than two related rows" or compare two columns to each other, so
  `evidenceFlaggedProjectIds()` resolves them and is OR-ed into the predicate.
  Omitting it silently drops three of the six queue rules.
- **Recharts animation is disabled everywhere.** Its mount animation starts bars
  at zero height and does not reliably complete under React 19, and this UI wants
  minimal animation regardless.

---

## Data-quality rules

Enforced in `lib/validations/*` (shared) and re-checked in the services:

- Power MW and GPU counts cannot be negative; `0` is valid and preserved.
- Confidence score must be 0–100.
- A `CONFIRMED` metric must cite a source that exists (re-checked after sources
  are persisted, since a metric may cite a source created in the same request).
- An expected opening before the announcement date raises a **warning**, not an
  error — it is odd but can be legitimate.
- An actual opening date requires status `OPERATIONAL` or `PARTIALLY_OPERATIONAL`.
- Latitude and longitude must both be present or both absent.
- Material edits write a `ProjectRevision` with a field-level diff. Re-saving an
  unchanged form writes nothing.
- Source URLs are unique per project unless explicitly overridden (enforced in
  the service, not by a DB constraint, so the override remains possible).
  Comparison ignores trailing slashes, case and tracking parameters.
- Unknown values render as **"Not disclosed"** everywhere and export as an empty
  CSV cell — never `0`, which a spreadsheet `SUM` would treat as real.

## Verification queue

A project needs review when any of these hold:

1. Not verified in 90 days, or never verified
2. Expected opening date has passed while not operational
3. Fewer than two sources
4. No source at or above the reliability threshold (60)
5. A confirmed figure exceeds its own estimate
6. Status is `RUMORED`, `DELAYED` or `PERMITTING`

Marking a project verified clears (1) only — it stamps a timestamp and writes a
revision. It does not change any figure, so a stale number stays stale.

## Roles

|               | ADMIN | ANALYST | VIEWER |
| ------------- | ----- | ------- | ------ |
| Read          | ✅    | ✅      | ✅     |
| Export        | ✅    | ✅      | ✅     |
| Create / edit | ✅    | ✅      | —      |
| Import        | ✅    | ✅      | —      |
| Delete        | ✅    | —       | —      |
| Manage users  | ✅    | —       | —      |

---

## Demo data

`npm run db:seed` writes 16 illustrative projects across 7 countries. **Every
figure is invented.** Each row is stored with `isDemoData: true`, which makes the
UI render a "Demo data — not verified" badge, shows a banner on the dashboard and
on each affected project, and marks the rows in every CSV/JSON export.

Clear them with `npm run db:reset` (or delete the rows and keep your own).

## Testing

```bash
npm test                  # unit + integration
npm run test:e2e          # Playwright (needs a seeded dev database)
```

Integration tests run against `TEST_DATABASE_URL` and truncate it between tests.
`tests/setup.ts` refuses to run if that variable is unset or equal to
`DATABASE_URL`. Apply migrations to it once:

```bash
npx dotenv -e .env -- sh -c 'DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy'
```

Current suite: 142 unit + integration tests, 2 Playwright specs.

---

## Known limitations

- **The map is not verified end-to-end.** Without a Mapbox token the render path
  has never been exercised. Its data layer (`lib/map-data.ts` — GeoJSON
  construction, area-proportional marker scaling, coordinate ordering) is unit
  tested instead. Do one manual pass on `/map` after adding a token.
- **Search is `ILIKE`, not Postgres full-text.** Accurate and fast enough at this
  row count, and better for identifiers like `GB200`. The replacement (a
  generated `tsvector` column plus a GIN index) fits behind the existing
  `globalSearch` interface.
- **No source scraping or AI extraction**, by design. Every figure is typed by
  the analyst who read the source, which is what makes `CONFIRMED` mean
  something. `SourceMetadataFetcher` in `lib/services/sources.ts` is the seam for
  adding it later.
- **`npm audit` reports transitive advisories** through `next`, `eslint` and
  `sharp`. `npm audit fix --force` would downgrade the framework; they are left
  as-is deliberately and should be reviewed when upstream releases land.
- **Two lint warnings remain**: React Compiler cannot memoize components that use
  `react-hook-form`'s `watch()`, so `project-form` and `source-inbox-form` opt out
  of compiler memoization. Harmless at this scale.
- **No user-management UI yet.** The `ADMIN` `user:manage` capability exists and
  is enforced, but users are currently created by the seed script.
