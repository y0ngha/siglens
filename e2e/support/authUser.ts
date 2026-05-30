/**
 * Single source of truth for the seeded authenticated E2E user.
 *
 * Both the seed script (`e2e/setup/seed.ts`, which upserts this user into the
 * `users` table) and the Playwright auth setup project
 * (`e2e/setup/auth-setup.ts`, which logs in through the real /login UI) read
 * these constants, so the credentials can never drift between the two.
 *
 * The password is plain text here on purpose: the seed hashes it with the
 * repo's `bcryptPasswordHasher` before persisting, while auth-setup types the
 * plain value into the login form. Account specs that run under the `authed`
 * project (storageState `.auth/user.json`) render logged in as this user, so
 * `AUTH_USER_EMAIL` is also the value shown on `/account`'s 이메일 field.
 */
export const AUTH_USER_EMAIL = 'e2e-auth-user@test.com';

/** Plain-text password — seed hashes it; auth-setup types it into /login. */
export const AUTH_USER_PASSWORD = 'E2eAuthUser1!';

/** Display name persisted to `users.name`; surfaces on /account 표시 이름. */
export const AUTH_USER_NAME = 'E2E Auth User';

/** Relative path to the storageState produced by the auth setup project. */
export const AUTH_STORAGE_STATE = '.auth/user.json';
