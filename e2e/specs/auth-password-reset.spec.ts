import { test, expect } from '../support/fixtures';
import { getEmailDebug } from '../support/emailHelper';
import { srhCommand } from '../support/srhClient';

/**
 * Anonymous Tier 2 spec — exercises the full password-reset flow end to end:
 *   request (/forgot-password) → token captured to Redis by the fake email
 *   dispatcher → confirm (/reset-password?email&token) → redirect to
 *   /login?password_reset=1.
 *
 * Isolation choice (THROWAWAY user, NOT the seeded auth user):
 * -----------------------------------------------------------
 * The plan offered (b) "reset to the same password" so the seeded user's
 * credentials survive — but the reset use case
 * (entities/user/lib/confirmPasswordReset.ts) rejects an unchanged password
 * with a `same_password` error, so (b) cannot exercise the success path.
 * Per the plan's fallback, this spec instead registers a fresh throwaway user
 * via the real signup flow (unique email per run) and resets THAT user. The
 * seeded e2e-auth-user is never touched, so the storageState auth-setup and the
 * auth-login / account-auth-smoke specs keep working with the original creds.
 *
 * Reset token exposure: the real token store keeps only a hash, so the new
 * password's reset token is read from the debug Redis key the fake dispatcher
 * writes (email_debug:{email}) via getEmailDebug, which polls for the async send.
 */
test.describe('auth password reset', () => {
    // This is the heaviest auth flow: it registers a throwaway user via the
    // full signup flow (bcrypt hash) AND then runs the reset flow (more bcrypt:
    // same-password verify + rehash), so under parallel load it needs headroom
    // over the 30s default.
    test.describe.configure({ timeout: 90_000 });

    test('request → token → confirm redirects to /login?password_reset=1', async ({
        page,
    }) => {
        const email = `e2e-reset-${Date.now()}@test.com`;
        const initialPassword = 'E2eReset1!';
        const newPassword = 'E2eReset2New!';

        // --- Register a throwaway user via the real signup flow. ---
        await page.goto('/signup');
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '인증 코드 받기' }).click();

        const signupCodeField = page.getByLabel('인증 코드');
        // Phase 1→2 waits on the request-verification server action; allow extra
        // time over the 5s assertion default under parallel load.
        await expect(signupCodeField).toBeVisible({ timeout: 15_000 });
        const signupDebug = await getEmailDebug(email);
        expect(
            signupDebug?.code,
            'signup verification email should expose a 6-digit code'
        ).toMatch(/^\d{6}$/);

        await signupCodeField.fill(signupDebug!.code!);
        await page.getByRole('button', { name: '코드 확인' }).click();

        const signupPassword = page.getByLabel('비밀번호', { exact: true });
        // Phase 2→3 waits on the verify-code server action.
        await expect(signupPassword).toBeVisible({ timeout: 15_000 });
        await signupPassword.fill(initialPassword);
        await page.getByLabel('모두 동의').check();
        await page.getByRole('button', { name: '회원가입' }).click();
        await page.waitForURL(url => !url.pathname.startsWith('/signup'));

        // Signup auto-authenticates, but /forgot-password is a GUEST_ONLY path
        // in proxy.ts — a logged-in request is reverse-guarded to '/'. Clear the
        // session cookies so the forgot-password form actually renders. (The
        // reset flow is meant to be used by a signed-out user anyway.)
        await page.context().clearCookies();

        // Clear the debug key the SIGNUP email left behind: it holds a record
        // with `code` (no token) for this same recipient. getEmailDebug returns
        // the first non-null record it polls, so without clearing it could
        // return the stale signup record before the reset email's record lands.
        await srhCommand(['DEL', `email_debug:${email}`]);

        // --- Request a password reset for the throwaway user. ---
        await page.goto('/forgot-password');
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '재설정 링크 보내기' }).click();

        // ForgotPasswordForm renders a role=status success panel on submit
        // (the same generic message whether or not the account exists).
        await expect(page.getByText('메일을 확인해 주세요')).toBeVisible({
            timeout: 15_000,
        });

        // Read the reset token the fake dispatcher captured (the key was
        // cleared above, so this is the reset email's record, carrying `token`).
        const resetDebug = await getEmailDebug(email);
        expect(
            resetDebug?.token,
            'reset email should expose a password-reset token'
        ).toBeTruthy();

        // --- Confirm the reset with a NEW (different) password. ---
        await page.goto(
            `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(resetDebug!.token!)}`
        );

        await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
        await page.getByLabel('새 비밀번호 확인').fill(newPassword);
        await page.getByRole('button', { name: '비밀번호 변경' }).click();

        // confirmPasswordResetAction redirects here on success.
        await page.waitForURL(/\/login\?password_reset=1/);
        await expect(page).toHaveURL(/\/login\?password_reset=1/);

        // The new password now logs in (proves the reset actually took effect).
        await page.getByLabel('이메일').fill(email);
        await page.getByLabel('비밀번호', { exact: true }).fill(newPassword);
        await page.getByRole('button', { name: '로그인' }).click();
        await page.waitForURL(url => !url.pathname.startsWith('/login'));
        await expect(page).toHaveURL(/localhost:4300\/$/);
    });
});
