import { bcryptPasswordHasher } from '@/entities/session';
import { getDatabaseClient } from '@/shared/db/client';
import { assetTranslations, terms, users } from '@/shared/db/schema';
import {
    AUTH_USER_EMAIL,
    AUTH_USER_NAME,
    AUTH_USER_PASSWORD,
} from '../support/authUser';

/**
 * Minimal E2E seed: inserts a single AAPL row into `asset_translations`, plus
 * one active row each for the `privacy` and `tos` legal documents into `terms`.
 *
 * AAPL / asset_translations
 * --------------------------
 * The `[symbol]` page resolves a ticker through getAssetInfo → cache → the
 * `asset_translations` DB table → FMP. Under E2E (network-guarded, no real FMP),
 * the page calls `notFound()` when getAssetInfo returns null, so this row is the
 * thing that lets `/AAPL` render. There is no `tickers` table in this repo; the
 * authoritative lookup table for asset info is `asset_translations`.
 *
 * Columns set match every NOT-NULL column without a default:
 *   symbol (PK), name, koreanName, fmpSymbol. `updatedAt` has a defaultNow().
 * For US equities the canonical symbol equals the FMP symbol, so fmpSymbol='AAPL'.
 *
 * terms (privacy + tos)
 * ---------------------
 * `/privacy` and `/terms` are statically prerendered at build time. Each page
 * runs findActive('privacy') / findActive('tos') against the `terms` table
 * (WHERE kind = ? AND effective_date <= NOW() ORDER BY effective_date DESC).
 * In CI the prod build runs cold against the e2e Postgres, so the table must
 * not only exist (migrate) but contain an active row — otherwise the prerender
 * renders null / errors and fails the build. We seed one past-dated row each.
 *
 * Columns set match every NOT-NULL column without a default:
 *   kind, version (integer), effectiveDate (past so it is "active"), body.
 * `id` defaults to a random uuid; `createdAt` has a defaultNow().
 *
 * users (authenticated E2E account)
 * ----------------------------------
 * `/account` and `/account/delete` require a session — proxy.ts forward-guards
 * unauthenticated requests to /login, and the page itself re-checks via
 * getCurrentUser. So the authed Playwright project (storageState) needs a real
 * user to log in as. We upsert one known account (credentials live in
 * `e2e/support/authUser.ts`, shared with the auth-setup project) and store a
 * bcrypt hash via the repo's own `bcryptPasswordHasher` so the real loginUser
 * → bcryptPasswordVerifier path accepts it.
 *
 * Columns set match every NOT-NULL column without a default:
 *   email (unique, NOT NULL). passwordHash/name are nullable but required for
 *   login to succeed and for /account to show a display name. emailVerified is
 *   set true (login does not require it, but it mirrors a real account).
 *   id/tier/createdAt/updatedAt all have defaults.
 *
 * Idempotency
 * -----------
 * The Task 1 containers persist data across runs, so every insert uses
 * `onConflictDoNothing` (asset_translations on its PK; terms on the
 * (kind, version) unique index; users on the email unique index) to stay
 * safely re-runnable.
 *
 * Runs with E2E_TEST=1 + the .env.e2e DATABASE_URL so the postgres-js swap
 * (Task 2) writes to the local Postgres.
 */

/** Past-dated so `effective_date <= NOW()` always holds → row is "active". */
const TERMS_EFFECTIVE_DATE = new Date('2020-01-01T00:00:00Z');

async function seed(): Promise<void> {
    const { db } = getDatabaseClient();
    await db
        .insert(assetTranslations)
        .values({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        })
        .onConflictDoNothing();

    await db
        .insert(terms)
        .values([
            {
                kind: 'privacy',
                version: 1,
                effectiveDate: TERMS_EFFECTIVE_DATE,
                body: 'E2E 테스트 개인정보처리방침 본문',
            },
            {
                kind: 'tos',
                version: 1,
                effectiveDate: TERMS_EFFECTIVE_DATE,
                body: 'E2E 테스트 이용약관 본문',
            },
        ])
        .onConflictDoNothing({ target: [terms.kind, terms.version] });

    const passwordHash =
        await bcryptPasswordHasher.hashPassword(AUTH_USER_PASSWORD);
    await db
        .insert(users)
        .values({
            email: AUTH_USER_EMAIL,
            passwordHash,
            name: AUTH_USER_NAME,
            emailVerified: true,
        })
        .onConflictDoNothing({ target: users.email });

    console.log('e2e seed: ok');
}

seed().then(
    () => process.exit(0),
    e => {
        console.error(e);
        process.exit(1);
    }
);
