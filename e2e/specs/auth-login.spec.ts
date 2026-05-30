import { test, expect } from '../support/fixtures';
import { AUTH_USER_EMAIL, AUTH_USER_PASSWORD } from '../support/authUser';

/**
 * Anonymous Tier 2 spec — runs on the no-storageState chromium project (NOT the
 * `authed` project; the filename is deliberately not `account-*` so it does not
 * match the storageState routing in playwright.config.ts).
 *
 * Exercises the real /login form (features/auth-login/ui/LoginForm.tsx):
 *   - 이메일 / 비밀번호 labels, 로그인 submit button.
 *   - The 비밀번호 input is fetched with { exact: true } so it is not confused
 *     with the adjacent "비밀번호 보이기" show-password toggle button, whose
 *     aria-label also contains the substring "비밀번호".
 *
 * Uses the SEEDED auth user (e2e/support/authUser.ts) for the happy path; this
 * spec only reads (logs in as) the user and never mutates its credentials, so
 * the storageState auth-setup that logs in with the same password stays valid.
 */
test.describe('auth login', () => {
    // The login server action (bcrypt verify) and the authenticated /account
    // page (Suspense + getCurrentUser + provider lookup) can take several
    // seconds when all the Tier 2 auth specs hit one `next start` server in
    // parallel, so give each test extra headroom over the 30s default.
    test.describe.configure({ timeout: 60_000 });

    test('valid credentials log in and authenticate the session', async ({
        page,
    }) => {
        await page.goto('/login');

        await page.getByLabel('이메일').fill(AUTH_USER_EMAIL);
        await page
            .getByLabel('비밀번호', { exact: true })
            .fill(AUTH_USER_PASSWORD);
        await page.getByRole('button', { name: '로그인' }).click();

        // loginAction redirects to the sanitized `next` (default '/') on
        // success; proxy.ts also reverse-guards /login for an authed request.
        await page.waitForURL(url => !url.pathname.startsWith('/login'));
        await expect(page).toHaveURL(/localhost:4300\/$/);

        // Concrete post-login outcome #1: the header now renders the
        // authenticated user-menu trigger (HeaderUserMenu.tsx, aria-label
        // "사용자 메뉴 (<tier>)") in place of the anonymous 로그인/회원가입
        // links — a server-rendered, immediate signal that the session
        // cookie resolves to a real user.
        await expect(
            page.getByRole('button', { name: /사용자 메뉴/ })
        ).toBeVisible({ timeout: 15_000 });

        // Concrete post-login outcome #2: the protected /account route is now
        // reachable without proxy.ts forward-guarding back to /login.
        await page.goto('/account');
        await expect(page).toHaveURL(/\/account$/);
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: 15_000 });
    });

    test('invalid credentials show an error and stay on /login', async ({
        page,
    }) => {
        await page.goto('/login');

        await page.getByLabel('이메일').fill(AUTH_USER_EMAIL);
        await page
            .getByLabel('비밀번호', { exact: true })
            .fill('WrongPassword999!');
        await page.getByRole('button', { name: '로그인' }).click();

        // invalid_credentials → INVALID_CREDENTIALS_MESSAGE in LoginForm.tsx.
        // Extra timeout: the action round-trips through bcrypt verify, which is
        // slow under parallel load before the error state renders.
        await expect(
            page.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')
        ).toBeVisible({ timeout: 15_000 });
        await expect(page).toHaveURL(/\/login/);
    });

    test('reverse guard: a logged-in user visiting /login is sent to /', async ({
        page,
    }) => {
        // Log in first to obtain the session cookie.
        await page.goto('/login');
        await page.getByLabel('이메일').fill(AUTH_USER_EMAIL);
        await page
            .getByLabel('비밀번호', { exact: true })
            .fill(AUTH_USER_PASSWORD);
        await page.getByRole('button', { name: '로그인' }).click();
        await page.waitForURL(/localhost:4300\/$/);

        // proxy.ts GUEST_ONLY_PATHS reverse-guard: an authed request to /login
        // is redirected to '/'.
        await page.goto('/login');
        await expect(page).toHaveURL(/localhost:4300\/$/);
    });
});
