import { getEmailDebug } from '../support/emailHelper';
import { test, expect } from '../support/fixtures';

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

    test('step 3 from a browser without the verification cookie is refused', async ({
        page,
        context,
    }) => {
        const email = `e2e-signup-binding-${Date.now()}@test.com`;

        await page.goto('/signup');
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '인증 코드 받기' }).click();

        const codeField = page.getByLabel('인증 코드');
        await expect(codeField).toBeVisible({ timeout: 15_000 });
        const debug = await getEmailDebug(email);
        expect(debug?.code).toMatch(/^\d{6}$/);
        await codeField.fill(debug?.code ?? '');
        await page.getByRole('button', { name: '코드 확인' }).click();

        const passwordField = page.getByLabel('비밀번호', { exact: true });
        await expect(passwordField).toBeVisible({ timeout: 15_000 });

        // The verifying browser holds an HttpOnly Strict cookie; removing it
        // makes this submit look like a stranger who only knows the address
        // (a fresh browser context cannot reach step 3 of the same form).
        const cookieName = 'siglens_signup_verify';
        const issued = (await context.cookies()).find(
            cookie => cookie.name === cookieName
        );
        expect(issued?.httpOnly).toBe(true);
        expect(issued?.sameSite).toBe('Strict');
        await context.clearCookies({ name: cookieName });

        await passwordField.fill('E2eSignup1!');
        await page.getByLabel('모두 동의').check();
        await page.getByRole('button', { name: '회원가입' }).click();

        // The page also renders Next's empty route announcer (role="alert"), so match the
        // banner by its text instead of the first alert on the page.
        await expect(
            page.getByRole('alert').filter({
                hasText: '이메일 인증을 완료해야 회원가입이 가능합니다.',
            })
        ).toBeVisible({ timeout: 15_000 });
        await expect(page).toHaveURL(/\/signup/);
    });

    test('signup page: benefits in the server HTML, Google above the email field', async ({
        page,
        request,
    }) => {
        // The benefits list is a server component outside Suspense, so its
        // heading is in the HTML a crawler or a no-JS client receives.
        const response = await request.get('/signup');
        expect(response.ok()).toBe(true);
        // Strip <script> payloads (RSC flight data) so only rendered markup counts.
        const html = (await response.text()).replace(
            /<script[\s\S]*?<\/script>/g,
            ''
        );
        expect(html).toMatch(
            /<h2[^>]*id="signup-benefits-heading"[^>]*>\s*회원 혜택/
        );

        await page.goto('/signup');
        const google = page.getByRole('link', { name: 'Google로 계속하기' });
        const email = page.getByLabel('이메일');
        await expect(google).toBeVisible({ timeout: 15_000 });
        await expect(email).toBeVisible();

        const googleBox = await google.boundingBox();
        const emailBox = await email.boundingBox();
        expect(googleBox, 'Google link should be laid out').not.toBeNull();
        expect(emailBox, 'email field should be laid out').not.toBeNull();
        expect(googleBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
            emailBox?.y ?? Number.NEGATIVE_INFINITY
        );
    });

    test('mail report opt-in: unchecked by default, not ticked by 모두 동의, saved when chosen', async ({
        page,
    }) => {
        const email = `e2e-signup-optin-${Date.now()}@test.com`;
        const password = 'E2eSignup1!';

        await page.goto('/signup');
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '인증 코드 받기' }).click();

        const codeField = page.getByLabel('인증 코드');
        await expect(codeField).toBeVisible({ timeout: 15_000 });
        const debug = await getEmailDebug(email);
        expect(debug?.code).toMatch(/^\d{6}$/);
        await codeField.fill(debug?.code ?? '');
        await page.getByRole('button', { name: '코드 확인' }).click();

        const passwordField = page.getByLabel('비밀번호', { exact: true });
        await expect(passwordField).toBeVisible({ timeout: 15_000 });
        await passwordField.fill(password);

        const optIn = page.getByRole('checkbox', { name: /메일 리포트 받기/ });
        await expect(optIn).not.toBeChecked();
        // The master only toggles the two required consents.
        await page.getByLabel('모두 동의').check();
        await expect(optIn).not.toBeChecked();

        await optIn.check();
        await page.getByRole('button', { name: '회원가입' }).click();
        await page.waitForURL(url => !url.pathname.startsWith('/signup'));

        // The choice was stored as an enabled subscription with the default
        // Monday schedule, visible on the settings page.
        await page.goto('/email-report');
        await expect(page.getByRole('switch')).toBeChecked({
            timeout: 15_000,
        });
        await expect(page.getByRole('checkbox', { name: '월' })).toBeChecked();
    });
});
