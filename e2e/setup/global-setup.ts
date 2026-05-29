import { execSync } from 'node:child_process';

/**
 * Playwright global setup — runs ONCE before the whole suite.
 *
 * Responsibility: prepare the LOCAL e2e Postgres (migrate + seed). The Docker
 * backend (Postgres on 5433, Redis, SRH) is assumed already up — both locally
 * and in CI via docker compose (`yarn e2e:up`). This file does NOT start
 * containers. Playwright's `webServer` builds & starts the Next app afterward.
 *
 * Three gotchas (discovered in Task 3) are handled here:
 *
 * 1. NEVER `yarn db:migrate`. That script wraps migrate.ts in
 *    `dotenv -e .env.local`, and `.env.local` carries a real
 *    `DIRECT_DATABASE_URL` (production Neon). `migrate.ts` prefers
 *    `DIRECT_DATABASE_URL || DATABASE_URL`, so the yarn script would migrate
 *    PRODUCTION. We invoke migrate.ts directly under `.env.e2e` only — there
 *    `DIRECT_DATABASE_URL` is unset, so the local `DATABASE_URL`
 *    (postgres://siglens:siglens@localhost:5433/siglens_e2e) is used.
 *
 * 2. `migrate.ts` does `SELECT ... FROM drizzle.__drizzle_migrations` up front
 *    and fails with 42P01 (undefined_table) on a fresh container. We bootstrap
 *    that table first via the container's own psql. Idempotent
 *    (CREATE ... IF NOT EXISTS), so it's a no-op on an already-migrated DB.
 *
 * 3. The seed must run with the e2e tsconfig (`--tsconfig e2e/tsconfig.json`);
 *    without it tsx fails resolving `server-only`.
 */

const COMPOSE = 'docker compose -f docker-compose.e2e.yml';

/** Path to the local dotenv binary; avoids relying on `dotenv` being on PATH. */
const DOTENV = 'node_modules/.bin/dotenv';

/** Inherit stdio so migrate/seed logs surface in the Playwright run output. */
function run(cmd: string): void {
    execSync(cmd, { stdio: 'inherit', env: { ...process.env } });
}

/**
 * Wait for Postgres to accept connections. Robust against `e2e:up` having just
 * been issued (container reported up but Postgres still booting). Uses the
 * container's bundled `pg_isready` so no host-side client is required.
 */
async function waitForPostgres(retries = 30, delayMs = 1000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            execSync(
                `${COMPOSE} exec -T postgres pg_isready -U siglens -d siglens_e2e`,
                {
                    stdio: 'ignore',
                }
            );
            return;
        } catch {
            if (attempt === retries) {
                throw new Error(
                    `Postgres not ready after ${retries} attempts. Is the e2e backend up (yarn e2e:up)?`
                );
            }
            // globalSetup is async, so await a timer Promise instead of spawning
            // a Node process per retry (avoids process-creation overhead).
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

export default async function globalSetup(): Promise<void> {
    // 0. Ensure Postgres is actually accepting connections.
    await waitForPostgres();

    // 1. Bootstrap the drizzle migrations table (gotcha #2). Idempotent.
    run(
        `${COMPOSE} exec -T postgres psql -U siglens -d siglens_e2e -v ON_ERROR_STOP=1 ` +
            `-c "CREATE SCHEMA IF NOT EXISTS drizzle;" ` +
            `-c "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations ` +
            `(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);"`
    );

    // 2. Apply migrations to the LOCAL e2e DB only (gotcha #1 — never yarn db:migrate).
    run(`${DOTENV} -e .env.e2e -- node_modules/.bin/tsx db/scripts/migrate.ts`);

    // 3. Seed the minimal AAPL row (gotcha #3 — tsconfig required for server-only).
    run(
        `${DOTENV} -e .env.e2e -- node_modules/.bin/tsx --tsconfig e2e/tsconfig.json e2e/setup/seed.ts`
    );
}
