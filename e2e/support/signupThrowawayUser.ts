import { expect, type Page } from '@playwright/test';
import { getEmailDebug } from './emailHelper';

/**
 * Register a throwaway user through the real 3-phase /signup UI and leave the
 * page authenticated as that user. Mirrors auth-signup.spec.ts's proven steps.
 *
 * Shared by the authed-by-filename specs that must NOT touch the seeded shared
 * session (account-delete, account-logout): they override storageState to
 * anonymous and provision their own disposable session here, so deleting or
 * logging out cannot invalidate the storageState the `setup` project minted for
 * the sibling account-* specs. Use a unique (Date.now()-suffixed) email so
 * there is no collision across runs/workers.
 */
export async function signupThrowawayUser(
    page: Page,
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
        {
            timeout: 15_000,
        }
    );
}
