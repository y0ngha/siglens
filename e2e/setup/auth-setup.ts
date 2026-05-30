import { test as setup, expect } from '@playwright/test';
import {
    AUTH_USER_EMAIL,
    AUTH_USER_PASSWORD,
    AUTH_STORAGE_STATE,
} from '../support/authUser';

/**
 * Playwright SETUP project — runs once before the authed account specs and
 * produces the storageState they reuse via `dependencies: ['setup']`.
 *
 * Why UI login (not a DB-minted cookie):
 * --------------------------------------
 * Logging in through the real /login form exercises the full session-creation
 * path (loginAction → loginUser → bcryptPasswordVerifier → createAuthSession →
 * Set-Cookie). Whatever cookie attributes the production server emits — in
 * particular `Secure` (isSecureCookieEnv() is true because `next start` runs
 * with NODE_ENV=production) — are captured verbatim into storageState, so the
 * authed specs carry exactly the cookie the server would have set for a real
 * user. A hand-minted cookie would have to re-derive those attributes and would
 * drift if the session/cookie logic changed. localhost is a secure context, so
 * the Secure cookie is accepted over http://localhost:4300.
 *
 * Uses the bare @playwright/test fixtures (NOT e2e/support/fixtures), so the
 * external-request network guard does not apply here — login is entirely
 * same-origin against localhost:4300 anyway, and the setup is infrastructure,
 * not an assertion of app behavior.
 *
 * The seeded user (e2e/setup/seed.ts upserts it into `users`) is the account we
 * log in as; credentials are shared via e2e/support/authUser.ts.
 */
setup('authenticate via /login UI', async ({ page }) => {
    await page.goto('/login');

    // Selectors verified against features/auth-login/ui/LoginForm.tsx:
    //   이메일 / 비밀번호 labels, 로그인 submit button.
    await page.getByLabel('이메일').fill(AUTH_USER_EMAIL);
    // `exact` so the password input is not confused with the adjacent
    // "비밀번호 보이기" show-password toggle button (substring "비밀번호").
    await page.getByLabel('비밀번호', { exact: true }).fill(AUTH_USER_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();

    // loginAction redirects to the sanitized `next` (default '/') on success.
    // proxy.ts also reverse-guards /login for an authenticated request, so the
    // post-login navigation lands off /login regardless.
    await page.waitForURL(url => !url.pathname.startsWith('/login'));
    await expect(page).toHaveURL(/localhost:4300\/$/);

    await page.context().storageState({ path: AUTH_STORAGE_STATE });
});
