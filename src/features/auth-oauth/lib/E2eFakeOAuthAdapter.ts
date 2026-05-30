import type { OAuthProviderAdapter, OAuthProfileResult } from './types';

/**
 * Deterministic fixture profile returned by the fake adapter for any
 * authorization code. An E2E spec drives the OAuth callback with an arbitrary
 * dummy code (the fake ignores the code value) and can assert that a user with
 * this email / providerAccountId was provisioned.
 */
const FIXTURE_PROFILE = {
    provider: 'google',
    providerAccountId: 'e2e-google-user',
    email: 'e2e.oauth@test.com',
    name: 'E2E OAuth User',
    avatarUrl: 'http://localhost/e2e-oauth-avatar.png',
    accessToken: 'e2e-access-token',
    refreshToken: 'e2e-refresh-token',
    // Far-future fixed expiry so the value is deterministic across runs.
    tokenExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
} as const;

/**
 * E2E-only `OAuthProviderAdapter` that replaces the real Google adapter under
 * E2E_TEST=1 (see getOAuthAdapter). It performs NO token exchange and reads NO
 * client secret — `exchangeCodeForProfile` returns a fixed fixture profile for
 * any code, so the auth callback flow can be exercised hermetically without
 * contacting Google.
 *
 * DELIBERATE: this is a STATIC import in getOAuthAdapter (not require-gated like
 * FakeMarketProvider / FakeNewsClient etc.), mirroring FakeChatProvider and
 * E2eEmailDispatcher. It has no heavy deps (no postgres / fixtures), so its
 * bundle footprint is negligible, and the static import keeps getOAuthAdapter's
 * E2E branch unit-testable — vitest can mock a static module but not a relative
 * CJS `require` inside a require-gated factory.
 *
 * `authorizeUrl` returns a localhost URL (it does not delegate to the real
 * adapter) so it requires no GOOGLE_CLIENT_ID; the returned URL still carries
 * `state`/`redirect_uri` so a spec can drive the start→callback round-trip.
 */
export const e2eFakeOAuthAdapter: OAuthProviderAdapter = {
    id: 'google',
    authorizeUrl({ state, redirectUri }) {
        const params = new URLSearchParams({
            client_id: 'e2e-fake-client',
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
        });
        return `http://localhost/e2e/oauth/authorize?${params.toString()}`;
    },
    async exchangeCodeForProfile(): Promise<OAuthProfileResult> {
        return { ok: true, profile: { ...FIXTURE_PROFILE } };
    },
};
