import { test, expect } from '../support/fixtures';
import { getEmailDebug } from '../support/emailHelper';

/**
 * Anonymous Tier 2 spec — exercises the 3-phase signup flow
 * (features/auth-signup/ui/SignupForm.tsx) end to end against the real local
 * Postgres + Redis, with the hermetic fake email dispatcher.
 *
 * Phases (derived in SignupFormFlow from useActionState results):
 *   1. email   — 이메일 field + "인증 코드 받기" submit.
 *   2. code    — 인증 코드 field + "코드 확인" submit (advances once verified).
 *   3. details — 비밀번호 field + 표시 이름 (선택) + the 모두 동의 consent
 *                master checkbox (sets both required consents) + 회원가입.
 *
 * The verification code never lives in plaintext in the real token store (only
 * a hash), so we read it back from the debug Redis key the fake dispatcher
 * writes (email_debug:{email}) via getEmailDebug, which polls for the async
 * server-action send to land.
 *
 * A UNIQUE email per run (Date.now()) avoids the "이미 가입된 이메일" branch on
 * repeated local runs; the throwaway account is created fresh each time.
 */
test.describe('auth signup (3-phase)', () => {
    // 3 server-action round-trips (request code, verify code, register w/ bcrypt
    // hash) plus the authenticated /account check — needs headroom over 30s when
    // the Tier 2 auth specs run concurrently against one `next start` server.
    test.describe.configure({ timeout: 60_000 });

    test('email → code → details registers and authenticates', async ({
        page,
    }) => {
        const email = `e2e-signup-${Date.now()}@test.com`;
        const password = 'E2eSignup1!';

        await page.goto('/signup');

        // --- Phase 1: request the verification code. ---
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '인증 코드 받기' }).click();

        // Phase 2 form renders (code field) once the request action resolves;
        // allow extra time over the 5s assertion default under parallel load.
        const codeField = page.getByLabel('인증 코드');
        await expect(codeField).toBeVisible({ timeout: 15_000 });

        // Read the 6-digit code the fake dispatcher captured to Redis.
        const debug = await getEmailDebug(email);
        expect(
            debug,
            'verification email should be captured in Redis'
        ).not.toBeNull();
        expect(
            debug?.code,
            'captured email should contain a 6-digit code'
        ).toMatch(/^\d{6}$/);

        // --- Phase 2: confirm the code → advances to phase 3. ---
        await codeField.fill(debug!.code!);
        await page.getByRole('button', { name: '코드 확인' }).click();

        // Phase 3 form renders: the 인증 완료 confirmation and the password
        // field, once the verify-code server action resolves.
        const passwordField = page.getByLabel('비밀번호', { exact: true });
        await expect(passwordField).toBeVisible({ timeout: 15_000 });

        // --- Phase 3: fill details, consent, and submit. ---
        await passwordField.fill(password);
        await page.getByLabel('표시 이름 (선택)').fill('E2E Signup User');
        // The 모두 동의 master checkbox toggles BOTH required consents
        // (개인정보 + 이용약관) in one click; the form serializes them into the
        // hidden agreed_privacy / agreed_tos inputs.
        await page.getByLabel('모두 동의').check();
        await page.getByRole('button', { name: '회원가입' }).click();

        // Success outcome: registered + authenticated → redirected off /signup.
        await page.waitForURL(url => !url.pathname.startsWith('/signup'));

        // Confirm the new session is authenticated via the header's
        // authenticated user-menu trigger (HeaderUserMenu.tsx, aria-label
        // "사용자 메뉴 (<tier>)") — a fast, server-rendered signal that the
        // freshly-created session resolves to the new user.
        await expect(
            page.getByRole('button', { name: /사용자 메뉴/ })
        ).toBeVisible({ timeout: 15_000 });

        // And the protected /account route is reachable without proxy.ts
        // forward-guarding the new session back to /login.
        await page.goto('/account');
        await expect(page).toHaveURL(/\/account$/);
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: 15_000 });
    });
});
