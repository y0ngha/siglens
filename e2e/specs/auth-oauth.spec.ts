import { test, expect } from '../support/fixtures';
import {
    OAUTH_FIXTURE_EMAIL,
    resetOAuthFixtureUser,
} from '../support/resetOAuthFixtureUser';

/**
 * Anonymous Tier 2 spec — exercises the Google OAuth signup/login flow end to
 * end against the real local Postgres + Redis, with the hermetic fake OAuth
 * adapter injected under E2E_TEST=1 (features/auth-oauth/lib/providers.ts →
 * e2eFakeOAuthAdapter). The fake returns a FIXED fixture profile for any code
 * and contacts no real Google, but the HMAC state round-trip (state.ts) is NOT
 * gated — it runs for real, so the spec must issue + replay a genuine signed
 * `state` cookie + query pair.
 *
 * THE STATE ROUND-TRIP (the tricky part)
 * The fake adapter's authorizeUrl points at `http://localhost/e2e/oauth/...`
 * (port 80, NOT the app's :4300), and it does NOT auto-redirect back to the
 * callback. So:
 *   1. We hit `/api/auth/google/start?next=/account` via `page.request` with
 *      maxRedirects:0. The 302 Location is the fake authorizeUrl carrying the
 *      issued `state`; its Set-Cookie (siglens_oauth_state) lands in the SAME
 *      browser context (page.request shares the context cookie jar).
 *   2. We parse `state` out of that Location and drive the callback ourselves.
 *
 * AVOIDING THE NETWORK GUARD (support/fixtures.ts)
 * The guard only allows browser requests to localhost:4300 / 127.0.0.1:4300.
 * The fake authorizeUrl is `http://localhost/...` (port 80) → it would trip the
 * guard if the BROWSER navigated to it. We never do: `page.request` is an
 * APIRequestContext, not subject to `page.route`, and we read the 302 Location
 * WITHOUT following it (maxRedirects:0). The only real browser navigation is
 * `page.goto('/api/auth/callback/google?...')` — an app-host (:4300) request the
 * guard permits — which the app then 302-redirects (in-app) to the consent page.
 */
test.describe('auth oauth (google, fake adapter)', () => {
    // start API call + callback (state verify + Drizzle user/oauth-account
    // provision + Redis pending store) + consent finalize (session create) +
    // the authed /account check — headroom over 30s under parallel Tier 2 load.
    // mode:'serial' so the existing-account test runs AFTER (and depends on) the
    // signup test provisioning the fixture user — fullyParallel would otherwise
    // race them onto separate workers and break that ordering.
    test.describe.configure({ mode: 'serial', timeout: 60_000 });

    // The fake adapter's fixture identity is FIXED (cannot be uniquified per run
    // like the email-signup spec), and the e2e Postgres persists across runs. So
    // clear the fixture user up front: the first test then reliably hits the
    // "new user → consent" branch, and the second test re-provisions + exercises
    // the existing-account login branch within this serial block.
    test.beforeAll(() => {
        resetOAuthFixtureUser();
    });

    /**
     * Hit the start route WITHOUT following the redirect to the fake provider,
     * returning the issued `state`. Side effect: the siglens_oauth_state cookie
     * is set on the page's browser context (page.request shares its cookie jar),
     * so the subsequent in-browser callback navigation sends it back.
     */
    async function issueState(
        page: import('@playwright/test').Page,
        next: string
    ): Promise<string> {
        const startUrl = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
        const res = await page.request.get(startUrl, { maxRedirects: 0 });
        // NextResponse.redirect defaults to a 307 (temporary) redirect — assert
        // the exact deterministic status rather than the whole 3xx range.
        expect(
            res.status(),
            'start route should redirect to the (fake) authorize URL'
        ).toBe(307);
        const location = res.headers()['location'];
        expect(
            location,
            'start route must emit a Location header'
        ).toBeTruthy();
        // The fake authorizeUrl is http://localhost/e2e/oauth/authorize?...&state=...
        const state = new URL(location).searchParams.get('state');
        expect(state, 'authorize URL must carry the issued state').toBeTruthy();
        return state as string;
    }

    test('new oauth user → consent → finalize → authenticated', async ({
        page,
    }) => {
        // --- Phase 1: issue a real signed state + state cookie. ---
        const state = await issueState(page, '/account');

        // --- Phase 2: drive the callback in the SAME context. The state cookie
        // (set on the context by issueState) is sent automatically. The fake
        // adapter returns the new-email fixture profile (e2e.oauth@test.com),
        // so the callback stores a pending signup and 302s (in-app) to consent.
        await page.goto(
            `/api/auth/callback/google?code=e2e_code&state=${encodeURIComponent(state)}`
        );

        // Landed on the consent page with a pending-signup token.
        await page.waitForURL(/\/signup\/oauth\/consent\?token=/, {
            timeout: 15_000,
        });

        // The consent form shows the fixture profile pulled from the pending
        // store (OAuthConsentForm.tsx) — proves the callback persisted it.
        await expect(page.getByText(OAUTH_FIXTURE_EMAIL)).toBeVisible({
            timeout: 15_000,
        });

        // --- Phase 3: consent + finalize. The 모두 동의 master checkbox toggles
        // both required consents (개인정보 + 이용약관) into the hidden
        // agreed_privacy / agreed_tos inputs; 가입 완료 runs
        // finalizeOAuthSignupAction → creates the user + session.
        await page.getByLabel('모두 동의').check();
        await page.getByRole('button', { name: '가입 완료' }).click();

        // Success: redirected to the `next` target (/account), authenticated.
        await page.waitForURL(/\/account$/, { timeout: 15_000 });
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: 15_000 });
        // The authenticated header user-menu trigger confirms the new session
        // resolves to a real user (HeaderUserMenu, aria-label "사용자 메뉴 (<tier>)").
        await expect(
            page.getByRole('button', { name: /사용자 메뉴/ })
        ).toBeVisible({ timeout: 15_000 });
    });

    test('existing oauth account → callback logs in directly (no consent)', async ({
        page,
    }) => {
        // This relies on the FIRST test having provisioned the fixture user
        // (providerAccountId 'e2e-google-user'); tests in a file run serially in
        // declaration order, so by here findByOAuthAccount resolves and the
        // callback takes the existing-account branch — straight to `next`, no
        // consent page. The fixture profile is deterministic across runs and the
        // provisioned user persists in the shared local Postgres.
        const state = await issueState(page, '/account');

        await page.goto(
            `/api/auth/callback/google?code=e2e_code&state=${encodeURIComponent(state)}`
        );

        // No consent detour: straight to the authenticated `next` target.
        await page.waitForURL(/\/account$/, { timeout: 15_000 });
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: 15_000 });
        await expect(
            page.getByRole('button', { name: /사용자 메뉴/ })
        ).toBeVisible({ timeout: 15_000 });
    });
});
