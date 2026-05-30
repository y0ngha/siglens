import { test, expect } from '../support/fixtures';
import { getEmailDebug } from '../support/emailHelper';
import { execSync } from 'node:child_process';

/**
 * Authed-by-filename Tier 2 spec — exercises the account-deletion flow
 * (features/account-delete/ui/DeleteAccountConfirm.tsx → deleteAccountAction)
 * end to end against the real local Postgres.
 *
 * ISOLATION (critical): the file matches the `authed` project's account-*
 * routing, so it would default to the SHARED storageState (the seeded
 * e2e-auth-user). Deleting that user would break account-api-key,
 * account-auth-smoke, AND the storageState the `setup` project produced. So
 * this file OVERRIDES storageState to anonymous (test.use empty state) and
 * REGISTERS its own throwaway user inside the test via the real 3-phase signup
 * flow — the same proven steps as auth-signup.spec.ts — giving an authenticated
 * session for a user that is safe to permanently delete. The unique
 * Date.now()-suffixed email guarantees no collision across runs/workers, and
 * because the context is anonymous (not the shared user) deleting it cannot
 * affect any other spec.
 *
 * DOM contract (verified against DeleteAccountConfirm.tsx): an email-match input
 * under the "본인 이메일" label; the 계정 영구 삭제 submit stays disabled until the
 * typed email equals the account email (case-insensitive, trimmed); a mismatch
 * shows the HINT_MISMATCH text. On a matching submit, deleteAccountAction
 * clears the session cookies and redirects to /?account_deleted=1.
 */
const COMPOSE = 'docker compose -f docker-compose.e2e.yml';

/** Count users with this email in the e2e Postgres (via the container's psql). */
function userCount(email: string): number {
    // Same container-psql transport as resetOAuthFixtureUser.ts: the Playwright
    // worker has no .env.e2e DATABASE_URL, so we go through the compose sidecar.
    // The email is a fixed-shape e2e address (no quotes), so the single-quoted
    // SQL literal needs no escaping. -tA strips headers/alignment to a bare int.
    const out = execSync(
        `${COMPOSE} exec -T postgres psql -U siglens -d siglens_e2e ` +
            `-v ON_ERROR_STOP=1 -tA ` +
            `-c "SELECT count(*) FROM users WHERE email = '${email}';"`,
        { encoding: 'utf8' }
    );
    return Number(out.trim());
}

/**
 * Register a throwaway user through the real /login-adjacent /signup UI and
 * leave the page authenticated as that user. Mirrors auth-signup.spec.ts.
 */
async function signupThrowawayUser(
    page: import('@playwright/test').Page,
    email: string,
    password: string
): Promise<void> {
    await page.goto('/signup');

    // Phase 1: request the verification code.
    await page.getByLabel('이메일').fill(email);
    await page.getByRole('button', { name: '인증 코드 받기' }).click();

    const codeField = page.getByLabel('인증 코드');
    await expect(codeField).toBeVisible({ timeout: 15_000 });

    const debug = await getEmailDebug(email);
    expect(
        debug,
        'verification email should be captured in Redis'
    ).not.toBeNull();
    expect(debug?.code, 'captured email should contain a 6-digit code').toMatch(
        /^\d{6}$/
    );

    // Phase 2: confirm the code → advances to phase 3.
    await codeField.fill(debug!.code!);
    await page.getByRole('button', { name: '코드 확인' }).click();

    const passwordField = page.getByLabel('비밀번호', { exact: true });
    await expect(passwordField).toBeVisible({ timeout: 15_000 });

    // Phase 3: password + consents + 회원가입.
    await passwordField.fill(password);
    await page.getByLabel('모두 동의').check();
    await page.getByRole('button', { name: '회원가입' }).click();

    // Registered + authenticated → off /signup.
    await page.waitForURL(url => !url.pathname.startsWith('/signup'));
    await expect(page.getByRole('button', { name: /사용자 메뉴/ })).toBeVisible(
        { timeout: 15_000 }
    );
}

test.describe('account delete (isolated throwaway user)', () => {
    // Override the shared storageState → anonymous, so we authenticate as the
    // freshly-signed-up throwaway user instead of the seeded shared user.
    test.use({ storageState: { cookies: [], origins: [] } });

    // Full signup round-trip (3 server actions) + the delete action; give ample
    // headroom over 30s under parallel load on one `next start` server.
    test.describe.configure({ timeout: 90_000 });

    test('wrong email keeps delete disabled; correct email deletes the account', async ({
        page,
    }) => {
        const email = `e2e-delete-${Date.now()}@test.com`;
        const password = 'E2eDelete1!';

        await signupThrowawayUser(page, email, password);
        expect(
            userCount(email),
            'throwaway user should exist after signup'
        ).toBe(1);

        // Drive the deletion confirm page.
        await page.goto('/account/delete');
        const emailInput = page.getByLabel(/본인 이메일/);
        await expect(emailInput).toBeVisible({ timeout: 15_000 });

        const deleteButton = page.getByRole('button', {
            name: '계정 영구 삭제',
        });

        // Empty input → disabled (default hint).
        await expect(deleteButton).toBeDisabled();

        // Wrong email → still disabled + mismatch hint.
        await emailInput.fill('not-my-email@test.com');
        await expect(
            page.getByText('입력한 이메일이 본인 이메일과 일치하지 않습니다.')
        ).toBeVisible();
        await expect(deleteButton).toBeDisabled();

        // Correct email → enabled.
        await emailInput.fill(email);
        await expect(deleteButton).toBeEnabled();

        // Delete → deleteAccountAction clears cookies and redirects to
        // /?account_deleted=1.
        await deleteButton.click();
        await page.waitForURL(/\/\?account_deleted=1$/, { timeout: 15_000 });

        // The user row is gone from the real DB (cascades cleared its session).
        expect(
            userCount(email),
            'throwaway user should be deleted from Postgres'
        ).toBe(0);

        // Session is no longer authed: the header shows anonymous links, not the
        // 사용자 메뉴 trigger (the auth cookies were cleared on delete).
        await expect(
            page.getByRole('button', { name: /사용자 메뉴/ })
        ).toHaveCount(0);
    });
});
