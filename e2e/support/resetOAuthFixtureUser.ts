/**
 * Delete the fixture OAuth user from the E2E Postgres so the OAuth signup spec
 * always starts from the "new user" branch.
 *
 * WHY this exists: the fake OAuth adapter (E2eFakeOAuthAdapter) returns a FIXED
 * fixture profile (email e2e.oauth@test.com / providerAccountId e2e-google-user)
 * for every code — unlike the email-signup spec, it cannot use a Date.now()
 * unique identity. The Task 1 containers persist Postgres across runs, so once
 * the signup test provisions that user, a later run (or a re-run, or the
 * existing-account test) would find it already present and the callback would
 * take the existing-account login branch instead of redirecting to consent.
 * Deleting the user before the new-user test makes the branch deterministic.
 *
 * Cascade: `users` is the parent of `oauth_accounts` and `sessions` via
 * `onDelete: 'cascade'` (schema.ts), so deleting the user row also clears its
 * linked OAuth account + any sessions. We delete by email (the unique key on
 * users) which is the same value the fixture profile carries.
 *
 * Transport: the container's own psql via docker compose exec — the SAME
 * mechanism global-setup.ts uses to bootstrap migrations. This is deliberate:
 * `playwright test` does NOT load .env.e2e into the worker process (global-setup
 * shells out to `dotenv -e .env.e2e` for migrate/seed), so the worker has no
 * local DATABASE_URL — importing @/shared/db/client here would throw or, worse,
 * resolve a non-e2e DATABASE_URL. Going through the container sidesteps env
 * entirely and targets the e2e DB unambiguously, exactly like global-setup.
 */

import { execSync } from 'node:child_process';
// Single source of truth lives on the adapter; re-exported below so existing
// importers of this support module keep working. The spec asserts this exact
// email is shown on the consent page.
import { OAUTH_FIXTURE_EMAIL } from '@/features/auth-oauth/lib/E2eFakeOAuthAdapter';

export { OAUTH_FIXTURE_EMAIL };

const COMPOSE = 'docker compose -f docker-compose.e2e.yml';

/**
 * Removes the fixture OAuth user (cascading to oauth_accounts + sessions).
 * Synchronous: `execSync` blocks until psql exits, so there is nothing to await.
 */
export function resetOAuthFixtureUser(): void {
    // Single-quoted SQL literal; the fixture email is a fixed constant with no
    // quote characters, so no escaping is needed. ON_ERROR_STOP surfaces any
    // failure as a non-zero exit (thrown by execSync) rather than a silent no-op.
    execSync(
        `${COMPOSE} exec -T postgres psql -U siglens -d siglens_e2e ` +
            `-v ON_ERROR_STOP=1 ` +
            `-c "DELETE FROM users WHERE email = '${OAUTH_FIXTURE_EMAIL}';"`,
        { stdio: 'ignore' }
    );
}
