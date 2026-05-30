import { test, expect } from '../support/fixtures';
import { AUTH_USER_EMAIL } from '../support/authUser';

/**
 * Proof that the authed storageState pipeline works end to end.
 *
 * This spec runs in the `authed` Playwright project (storageState
 * .auth/user.json, produced by the `setup` project's UI login as the seeded
 * e2e-auth-user). It exists to validate that a request to /account is NOT
 * forward-guarded to /login — i.e. the captured session cookie authenticates
 * the request all the way through proxy.ts AND the page-level getCurrentUser
 * re-check (account/page.tsx redirects to /login?next=/account when the cookie
 * does not resolve to a real user).
 *
 * Task 5/6 will add the real account-*.spec.ts files; this smoke can stay as a
 * standing guard on the storageState plumbing, or be superseded by them.
 */
test.describe('account auth smoke (authed storageState)', () => {
    test('/account renders authenticated, not redirected to /login', async ({
        page,
    }) => {
        await page.goto('/account');

        // Stayed on /account (no proxy.ts or page-level redirect to /login).
        await expect(page).toHaveURL(/\/account$/);

        // Authenticated content: the page heading and the seeded user's email
        // (only rendered once getCurrentUser resolves the session to a user).
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible();
        await expect(page.getByText(AUTH_USER_EMAIL)).toBeVisible();
    });
});
