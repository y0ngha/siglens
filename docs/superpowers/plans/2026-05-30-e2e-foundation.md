# E2E Foundation (Playwright Harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo policy:** Per `CLAUDE.md`, commits are created by `git-agent`, not by the implementing agent. Where a step says "Commit", stage the listed files and hand the commit message to `git-agent`.

**Goal:** Stand up a Playwright E2E harness that runs the production-built app against local Docker (Postgres 17 + Redis 7 + SRH), with server-side fake-provider injection, and prove it end-to-end with one smoke spec — without touching the 599 existing Vitest tests.

**Architecture:** Hybrid backend. External data/LLM/email/OAuth are replaced by fakes injected at the existing FSD adapter factory boundaries when `E2E_TEST=1`. Auth/session/DB run for real against a local Postgres (via a postgres-js driver swap) and a local Redis fronted by SRH (drop-in for `@upstash/redis`). Playwright runs against `next build && next start` on port 4300.

**Tech Stack:** Playwright, Docker Compose, Postgres 17, Redis 7, `hiett/serverless-redis-http` (SRH), `postgres` + `drizzle-orm/postgres-js` (already installed), `dotenv-cli` (already installed).

---

## Pre-flight (verification gates from the spec — already resolved)

- **`src/proxy.ts` guard direction (spec §7 gate 1): RESOLVED.** `proxy()` does BOTH guards — reverse (logged-in → guest-only pages redirect to `/`) AND **forward (`/account`, `/account/delete` non-logged-in → `/login`)**. So account routes ARE protected; auth-state setup is a prerequisite for account specs (Plan 3). No code change needed here.
- **Analysis render path (spec §7 gate 2): deferred to Plan 2.** Plan 1's smoke avoids the analysis/LLM path entirely, so it does not block this plan. Plan 2 resolves it before writing analysis specs.

---

## File Structure

```
docker-compose.e2e.yml              # CREATE — pg17 + redis7 + SRH
.env.e2e                            # CREATE — E2E env (no external API keys)
playwright.config.ts                # CREATE — chromium + webkit projects, webServer
src/shared/db/clientTest.ts         # CREATE — postgres-js DatabaseClient (E2E only)
src/shared/db/client.ts             # MODIFY — branch to test factory when E2E_TEST=1
src/shared/api/market/FakeMarketProvider.ts   # CREATE — fixture-backed MarketDataProvider
src/shared/api/market/getMarketDataProvider.ts # MODIFY — return fake when E2E_TEST=1
e2e/fixtures/bars.json              # CREATE — deterministic OHLCV bars
e2e/support/fixtures.ts             # CREATE — Playwright test w/ network guard
e2e/support/clock.ts               # CREATE — fixed-time helper
e2e/setup/global-setup.ts          # CREATE — wait for DB, migrate, seed
e2e/specs/smoke.spec.ts            # CREATE — home → search → symbol render
package.json                        # MODIFY — e2e scripts
vitest.config.ts (or vitest config) # MODIFY — exclude e2e/** from Vitest
```

Each file has one responsibility: the two `*.ts` factory edits are the only production-code touches, both gated behind `E2E_TEST` so prod bundles are unaffected.

---

## Task 1: Local backend (Docker Compose) + E2E env file

**Files:**
- Create: `docker-compose.e2e.yml`
- Create: `.env.e2e`

- [ ] **Step 1: Create the compose file**

`docker-compose.e2e.yml`:
```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: siglens
      POSTGRES_PASSWORD: siglens
      POSTGRES_DB: siglens_e2e
    ports: ['5433:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U siglens -d siglens_e2e']
      interval: 2s
      timeout: 3s
      retries: 30
  redis:
    image: redis:7
    ports: ['6380:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 3s
      retries: 30
  srh:
    image: hiett/serverless-redis-http:latest
    environment:
      SRH_MODE: env
      SRH_TOKEN: e2e-token
      SRH_CONNECTION_STRING: 'redis://redis:6379'
    ports: ['8079:80']
    depends_on:
      redis:
        condition: service_healthy
```

- [ ] **Step 2: Create the E2E env file**

`.env.e2e` (external API keys intentionally omitted — fakes are injected; auth secrets such as the OAuth HMAC and the API-key encryption key are added in Plan 3 when their specs land):
```
E2E_TEST=1
DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=e2e-token
```

- [ ] **Step 3: Boot and verify containers are healthy**

Run: `docker compose -f docker-compose.e2e.yml up -d && sleep 5 && docker compose -f docker-compose.e2e.yml ps`
Expected: all three services listed; `postgres` and `redis` show `(healthy)`.

- [ ] **Step 4: Verify SRH speaks the Upstash REST protocol**

Run:
```bash
curl -s -H "Authorization: Bearer e2e-token" http://localhost:8079/set/e2e-probe/ok
curl -s -H "Authorization: Bearer e2e-token" http://localhost:8079/get/e2e-probe
```
Expected: first returns `{"result":"OK"}`, second returns `{"result":"ok"}`.

- [ ] **Step 5: Commit** — stage `docker-compose.e2e.yml`, `.env.e2e`; message: `chore(e2e): local postgres/redis/srh compose + env`.

---

## Task 2: Postgres driver swap (postgres-js, E2E only)

**Files:**
- Create: `src/shared/db/clientTest.ts`
- Modify: `src/shared/db/client.ts`

Context: `DatabaseClient` (`src/shared/db/types.ts`) is typed to `drizzle-orm/neon-http`. The raw `sql` member is unused by app code (only `db` is used), so a postgres-js-backed client satisfies callers at runtime; a single localized cast bridges the driver-specific TS types.

- [ ] **Step 1: Create the test-only client factory**

`src/shared/db/clientTest.ts`:
```ts
import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import type { DatabaseClient, DatabaseConfig } from './types';

/**
 * E2E-only DatabaseClient backed by node `postgres` + drizzle postgres-js.
 *
 * Production uses Neon serverless (see client.ts). The drizzle query API is
 * runtime-compatible across both adapters; the cast bridges the driver-specific
 * TS types (NeonHttpDatabase vs PostgresJsDatabase) at this single boundary.
 * Reached only when E2E_TEST=1 so postgres-js never enters the prod bundle.
 */
export function createTestDatabaseClient(
    config: DatabaseConfig
): DatabaseClient {
    const sql = postgres(config.databaseUrl, { max: 4 });
    const db = drizzle(sql, { schema });
    return { db, sql } as unknown as DatabaseClient;
}
```

- [ ] **Step 2: Branch the getters in `client.ts`**

In `src/shared/db/client.ts`, replace the bodies of `getDatabaseClient` and `tryGetDatabaseClient` so they delegate to the test factory under `E2E_TEST`:
```ts
const isE2E = (): boolean => process.env.E2E_TEST === '1';

function buildClient(config: DatabaseConfig): DatabaseClient {
    if (isE2E()) {
        // require (not import) keeps postgres-js out of the production bundle.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createTestDatabaseClient } =
            require('./clientTest') as typeof import('./clientTest');
        return createTestDatabaseClient(config);
    }
    return createDatabaseClient(config);
}

export function getDatabaseClient(): DatabaseClient {
    cachedClient ??= buildClient(readDatabaseConfig());
    return cachedClient;
}

export function tryGetDatabaseClient(): DatabaseClient | null {
    const config = tryReadDatabaseConfig();
    if (config === null) return null;
    cachedClient ??= buildClient(config);
    return cachedClient;
}
```
Leave `createDatabaseClient` (neon) and `resetDatabaseClientForTests` unchanged.

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: PASS (no type errors introduced).

- [ ] **Step 4: Existing unit tests still green**

Run: `yarn test src/shared/db/__tests__/client.test.ts`
Expected: PASS (prod path unchanged when `E2E_TEST` unset).

- [ ] **Step 5: Commit** — stage `src/shared/db/clientTest.ts`, `src/shared/db/client.ts`; message: `feat(e2e): postgres-js DatabaseClient swap behind E2E_TEST`.

---

## Task 3: Migrate + minimal seed against local Postgres

**Files:**
- Create: `e2e/setup/seed.ts`

Context: Redis needs no code change — SRH + `.env.e2e` make `getRedisClient()` connect to the local instance. The existing `db:migrate` script (`db/scripts/migrate.ts`) runs drizzle migrations; we point it at the local DB via `.env.e2e`.

- [ ] **Step 1: Run migrations against local Postgres**

Run: `dotenv -e .env.e2e -- yarn db:migrate`
Expected: migrations apply cleanly; no error.

- [ ] **Step 2: Inspect the ticker table shape, then write the seed**

Run: `grep -nA25 "export const tickers" src/shared/db/schema.ts` (find the exact table export name and required columns).

Create `e2e/setup/seed.ts` inserting one ticker (AAPL) needed for symbol-page asset lookup, matching the columns printed above. Skeleton (replace column names with the inspected ones):
```ts
import 'dotenv/config';
import { getDatabaseClient } from '@/shared/db/client';
import { tickers } from '@/shared/db/schema';

async function seed(): Promise<void> {
    const { db } = getDatabaseClient();
    await db
        .insert(tickers)
        .values({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            // ...remaining NOT NULL columns from the inspected schema
        })
        .onConflictDoNothing();
    // eslint-disable-next-line no-console
    console.log('e2e seed: ok');
}

seed().then(
    () => process.exit(0),
    (e) => {
        console.error(e);
        process.exit(1);
    }
);
```

- [ ] **Step 3: Run the seed and verify the row exists**

Run:
```bash
dotenv -e .env.e2e -- node_modules/.bin/tsx e2e/setup/seed.ts
docker compose -f docker-compose.e2e.yml exec -T postgres \
  psql -U siglens -d siglens_e2e -c "select symbol from tickers where symbol='AAPL';"
```
Expected: seed prints `e2e seed: ok`; psql returns one `AAPL` row.

- [ ] **Step 4: Commit** — stage `e2e/setup/seed.ts`; message: `feat(e2e): migrate + minimal AAPL ticker seed`.

---

## Task 4: Fixture-backed fake market data provider

**Files:**
- Create: `e2e/fixtures/bars.json`
- Create: `src/shared/api/market/FakeMarketProvider.ts`
- Modify: `src/shared/api/market/getMarketDataProvider.ts`

- [ ] **Step 1: Create deterministic bars fixture**

`e2e/fixtures/bars.json` (3 daily bars; `time` is Unix seconds, matching core's `Bar`):
```json
[
  { "time": 1733356800, "open": 190.0, "high": 193.5, "low": 189.2, "close": 192.8, "volume": 51200000 },
  { "time": 1733443200, "open": 192.8, "high": 195.1, "low": 191.6, "close": 194.4, "volume": 48800000 },
  { "time": 1733529600, "open": 194.4, "high": 196.0, "low": 193.0, "close": 195.7, "volume": 50100000 }
]
```

- [ ] **Step 2: Create the fake provider**

`src/shared/api/market/FakeMarketProvider.ts`:
```ts
import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketQuote,
} from '@y0ngha/siglens-core';
import bars from '../../../../e2e/fixtures/bars.json';

/**
 * E2E-only MarketDataProvider returning deterministic fixture data instead of
 * calling FMP. Reached only when E2E_TEST=1 (see getMarketDataProvider).
 */
export class FakeMarketProvider implements MarketDataProvider {
    async getBars(_options: GetBarsOptions): Promise<Bar[]> {
        return bars as Bar[];
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        const last = (bars as Bar[]).at(-1);
        if (last === undefined) return null;
        return {
            symbol,
            price: last.close,
            changesPercentage: 1.23,
            name: symbol,
        };
    }
}
```

- [ ] **Step 3: Branch the factory**

In `src/shared/api/market/getMarketDataProvider.ts`:
```ts
import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

let cached: MarketDataProvider | null = null;

/** Returns the app's market data provider (FMP in prod, fake under E2E_TEST). */
export function getMarketDataProvider(): MarketDataProvider {
    if (cached !== null) return cached;
    if (process.env.E2E_TEST === '1') {
        // require keeps the fake + fixture out of the production bundle.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FakeMarketProvider } =
            require('./FakeMarketProvider') as typeof import('./FakeMarketProvider');
        cached = new FakeMarketProvider();
        return cached;
    }
    cached = new FmpMarketProvider();
    return cached;
}
```

- [ ] **Step 4: Typecheck + existing tests**

Run: `yarn typecheck && yarn test src/shared/api/market`
Expected: PASS.

- [ ] **Step 5: Commit** — stage the three files; message: `feat(e2e): fixture-backed FakeMarketProvider behind E2E_TEST`.

---

## Task 5: Playwright install + config

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright + browsers**

Run: `yarn add -D @playwright/test && yarn playwright install chromium webkit`
Expected: dependency added; chromium + webkit downloaded.

- [ ] **Step 2: Create the config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/specs',
    globalSetup: './e2e/setup/global-setup.ts',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:4300',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        {
            name: 'webkit',
            grep: /@webkit/,
            use: { ...devices['iPhone 14'] },
        },
    ],
    webServer: {
        command:
            "dotenv -e .env.e2e -- sh -c 'yarn build && yarn start -p 4300'",
        url: 'http://localhost:4300',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
```
Note: `serviceWorkers: 'block'` neutralizes the PWA SW. The webkit project runs only `@webkit`-tagged specs (mobile Safari layout). Analytics beacons are same-origin under Next and pass the guard.

- [ ] **Step 3: Verify the binary runs**

Run: `yarn playwright --version`
Expected: prints the installed version.

- [ ] **Step 4: Commit** — stage `package.json`, `yarn.lock`, `playwright.config.ts`; message: `chore(e2e): add playwright config (chromium + webkit, prod webServer)`.

---

## Task 6: Network guard + clock helpers

**Files:**
- Create: `e2e/support/fixtures.ts`
- Create: `e2e/support/clock.ts`

- [ ] **Step 1: Network guard fixture**

`e2e/support/fixtures.ts`:
```ts
import { test as base, expect } from '@playwright/test';

const ALLOWED_HOSTS = new Set(['localhost:4300', '127.0.0.1:4300']);

/**
 * Wraps the page so any browser request to a non-app host fails the test.
 * Catches stubbing drift and prevents accidental real external API calls.
 * Server-side fetches (FMP/LLM/etc.) are not visible here — those are handled
 * by E2E_TEST fake-provider injection.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        const violations: string[] = [];
        await page.route('**/*', (route) => {
            const url = new URL(route.request().url());
            const isAppOrLocalScheme =
                !url.protocol.startsWith('http') || ALLOWED_HOSTS.has(url.host);
            if (isAppOrLocalScheme) return route.continue();
            violations.push(url.href);
            return route.abort();
        });
        await use(page);
        expect(
            violations,
            `Unstubbed external requests: ${violations.join(', ')}`
        ).toEqual([]);
    },
});

export { expect };
```

- [ ] **Step 2: Clock helper**

`e2e/support/clock.ts`:
```ts
import type { Page } from '@playwright/test';

/**
 * Pins the browser clock to a fixed instant so time-dependent UI
 * (e.g. options stale banner, React Query staleTime) is deterministic.
 * Pass an ISO string; defaults to a US-market-closed weekend instant.
 */
export async function freezeClock(
    page: Page,
    isoTime = '2026-05-30T20:00:00Z'
): Promise<void> {
    await page.clock.install({ time: new Date(isoTime) });
}
```

- [ ] **Step 3: Commit** — stage both files; message: `feat(e2e): network guard fixture + clock helper`.

---

## Task 7: Global setup (containers ready → migrate → seed)

**Files:**
- Create: `e2e/setup/global-setup.ts`

- [ ] **Step 1: Write global setup**

`e2e/setup/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';

/**
 * Runs once before the suite: assumes `yarn e2e:up` already started the
 * containers, then applies migrations + seed against the local DB.
 * Playwright's webServer builds & starts the app afterward.
 */
export default async function globalSetup(): Promise<void> {
    const run = (cmd: string): void => {
        execSync(cmd, { stdio: 'inherit', env: { ...process.env } });
    };
    run('dotenv -e .env.e2e -- yarn db:migrate');
    run('dotenv -e .env.e2e -- node_modules/.bin/tsx e2e/setup/seed.ts');
}
```
Note: storageState (logged-in session reuse) is added in Plan 3 when auth specs need it; Plan 1 specs are anonymous.

- [ ] **Step 2: Commit** — stage `e2e/setup/global-setup.ts`; message: `feat(e2e): global setup runs migrate + seed`.

---

## Task 8: package.json scripts + Vitest exclusion

**Files:**
- Modify: `package.json`
- Modify: Vitest config (`vitest.config.ts` or the `test` block in the build config)

- [ ] **Step 1: Add E2E scripts**

Add to `package.json` `scripts`:
```json
"e2e:up": "docker compose -f docker-compose.e2e.yml up -d",
"e2e:down": "docker compose -f docker-compose.e2e.yml down -v",
"e2e:db": "dotenv -e .env.e2e -- yarn db:migrate && dotenv -e .env.e2e -- node_modules/.bin/tsx e2e/setup/seed.ts",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 2: Exclude `e2e/**` from Vitest**

Run: `grep -rn "include\|exclude\|projects" vitest.config.ts` (locate the Vitest config; it may live in a `vite`/`vitest` config file). Add `'e2e/**'` to Vitest's `exclude` (and ensure `include` targets `src/**`) so Playwright specs never run under Vitest.

- [ ] **Step 3: Verify Vitest ignores e2e and still passes**

Run: `yarn test --run` (or `yarn test`)
Expected: existing suite runs; no `e2e/specs/*.spec.ts` collected; all green.

- [ ] **Step 4: Commit** — stage `package.json`, the Vitest config; message: `chore(e2e): e2e scripts + exclude e2e/ from vitest`.

---

## Task 9: Smoke spec (home → search → symbol render)

**Files:**
- Create: `e2e/specs/smoke.spec.ts`

This proves the full rig: prod build boots against local Docker, routing works, and the fake market provider feeds a real render — with zero external network.

- [ ] **Step 1: Ensure containers are up**

Run: `yarn e2e:up && sleep 5`
Expected: containers healthy (see Task 1 Step 3).

- [ ] **Step 2: Write the smoke spec**

`e2e/specs/smoke.spec.ts`:
```ts
import { test, expect } from '../support/fixtures';

test.describe('smoke: harness boots and renders', () => {
    test('home loads with the ticker search', async ({ page }) => {
        await page.goto('/');
        await expect(
            page.getByRole('searchbox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });

    test('search navigates to the symbol page and it renders', async ({
        page,
    }) => {
        await page.goto('/');
        const search = page.getByRole('searchbox', { name: '종목 티커 검색' });
        await search.fill('aapl');
        await search.press('Enter');
        await page.waitForURL('**/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible();
    });
});
```
Note: the exact search accessible name comes from `tickerSearchNavigation.test.tsx` (`aria-label="종목 티커 검색"`). If the H1 role/name differs, adjust to the symbol page's actual heading; the assertion's intent is "the symbol page rendered its header from injected data."

- [ ] **Step 3: Run the smoke spec — expect it to FAIL first if the H1 selector is wrong, then fix the selector**

Run: `yarn test:e2e e2e/specs/smoke.spec.ts --project=chromium`
Expected first run: home test PASSES; if the symbol-page assertion fails, read the rendered page (`--debug` or the HTML report) and correct the heading selector to match the real DOM, then re-run.

- [ ] **Step 4: Run until green**

Run: `yarn test:e2e e2e/specs/smoke.spec.ts --project=chromium`
Expected: both tests PASS; the network-guard assertion reports zero unstubbed external requests.

- [ ] **Step 5: Commit** — stage `e2e/specs/smoke.spec.ts`; message: `test(e2e): smoke — home + search + symbol render`.

---

## Task 10: CI workflow (services + sharded run)

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/e2e.yml`:
```yaml
name: e2e
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: siglens
          POSTGRES_PASSWORD: siglens
          POSTGRES_DB: siglens_e2e
        ports: ['5433:5432']
        options: >-
          --health-cmd "pg_isready -U siglens -d siglens_e2e"
          --health-interval 2s --health-timeout 3s --health-retries 30
      redis:
        image: redis:7
        ports: ['6380:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 2s
          --health-timeout 3s --health-retries 30
      srh:
        image: hiett/serverless-redis-http:latest
        env:
          SRH_MODE: env
          SRH_TOKEN: e2e-token
          SRH_CONNECTION_STRING: 'redis://redis:6379'
        ports: ['8079:80']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: yarn }
      - run: yarn install --immutable
      - run: yarn playwright install --with-deps chromium webkit
      - run: yarn test:e2e
        env:
          CI: '1'
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```
Note: `webServer` builds/starts the app inside `yarn test:e2e`; `.env.e2e` is read via the config's `dotenv -e .env.e2e` webServer command. Sharding (`--shard`) can be added across a matrix once spec count grows in Plans 2–4.

- [ ] **Step 2: Commit** — stage `.github/workflows/e2e.yml`; message: `ci(e2e): playwright workflow with pg/redis/srh services`.

---

## Self-Review

- **Spec coverage (foundation portions of the design):** §1.2 fake injection → Tasks 2/4 (pattern established for market+DB; LLM/Resend/OAuth follow same pattern in Plans 2/3). §1.4 driver swap → Task 2. §1.4 SRH Redis → Tasks 1/3 (env-only). §2 directory/webServer/projects → Tasks 5/8. §3 network guard → Task 6. §4 Docker/migrate/seed/isolation → Tasks 1/3/7 (per-worker isolation lands with auth in Plan 3). §6 flaky-prevention: clock → Task 6, SW block + analytics → Task 5, CI → Task 10. ✅
- **Placeholder scan:** Two inspect-then-implement steps (Task 3 Step 2 ticker columns; Task 8 Step 2 Vitest config location) are concrete commands + skeletons, not vague TODOs — acceptable because exact column/config shape is environment-specific and must be read at the point of edit.
- **Type consistency:** `DatabaseClient`/`DatabaseConfig`, `MarketDataProvider`/`Bar`/`MarketQuote`, `getMarketDataProvider`, `getDatabaseClient`/`tryGetDatabaseClient`, `E2E_TEST` flag — all match across tasks and the real source read during design.

---

## Out of scope (separate plans, authored when reached)

- **Plan 2 — Tier 1 specs (6):** `symbol-search`, `symbol-analysis`, `analysis-jobs` (re-analysis/cooldown/cancel + bot-block), `symbol-tabs` (@webkit, options stale via clock), `symbol-chat` (@webkit), `model-gate`. Resolves gate 2 (analysis render path) + adds the **fake LLM provider** injection. 
- **Plan 3 — Tier 2 auth/account specs (6):** adds **fake Resend + OAuth** providers, the auth secrets in `.env.e2e`, per-worker data isolation, and storageState reuse in global-setup.
- **Plan 4 — Tier 3/4 specs:** `home`, `market`, `backtesting`, `contact`, `legal`, `pwa-install` (@webkit), `resilience`, `not-found`, `seo-smoke`.
