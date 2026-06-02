import { test, expect } from '../support/fixtures';
import { signupThrowawayUser } from '../support/signupThrowawayUser';

/**
 * Logout reverts the header to the guest state — axis-0 auth regression guard.
 *
 * The root-layout header is a client island (AuthSessionHeaderClient) precisely
 * so the layout stays static for ISR; that island must still reflect a logout.
 * useLogout optimistically clears the cached currentUser, so the header flips to
 * the guest nav (login / signup) without a full navigation. This guards the
 * #547 regression where redirect-based auth flows left the header stale.
 *
 * ISOLATION (critical): the filename matches the `authed` project's account-*
 * routing, so it would default to the SHARED storageState (the seeded
 * e2e-auth-user). Logging that session out calls deleteSession, which would
 * invalidate the storageState the `setup` project minted and break the sibling
 * account-* specs (account-auth-smoke, account-api-key). So — exactly like
 * account-delete.spec.ts — this file OVERRIDES storageState to anonymous and
 * provisions its own disposable user, whose session is safe to log out.
 */
test.describe('account logout (isolated throwaway user)', () => {
    // Anonymous override: authenticate as a freshly-signed-up throwaway user,
    // never the shared seeded session.
    test.use({ storageState: { cookies: [], origins: [] } });

    // Full 3-action signup round-trip before the logout; headroom over 30s
    // under parallel load on one `next start` server.
    test.describe.configure({ timeout: 90_000 });

    test('logging out flips the header from the user menu to the guest nav', async ({
        page,
    }) => {
        const email = `e2e-logout-${Date.now()}@test.com`;
        await signupThrowawayUser(page, email, 'E2eLogout1!');

        // Land on a stable route; signup leaves us authenticated.
        await page.goto('/');

        const banner = page.getByRole('banner');
        const userMenu = banner.getByRole('button', { name: /사용자 메뉴/ });

        await expect(userMenu).toBeVisible();
        await userMenu.click();

        await banner.getByRole('menuitem', { name: '로그아웃' }).click();

        // 회원가입 belongs to the guest header nav, so its presence (and the
        // user-menu button's absence) is the post-logout guest-state proof.
        await expect(
            banner.getByRole('link', { name: '회원가입' })
        ).toBeVisible();
        await expect(userMenu).toHaveCount(0);
    });
});
