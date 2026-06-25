// @vitest-environment node
import {
    OAUTH_STATE_COOKIE_NAME,
    issueOAuthState,
    verifyOAuthState,
    expiredOAuthStateCookie,
    OAuthStateSecretMisconfiguredError,
} from '@/features/auth-oauth/lib/state';
import { googleOAuthAdapter } from '@/features/auth-oauth/lib/google';
import {
    isOAuthProvider,
    buildOAuthRedirectUri,
} from '@/features/auth-oauth/lib/providers';
import { TABS } from '@/views/symbol/utils/symbolTabsConfig';

const FAKE_HMAC_SECRET = 'test-secret-must-be-32-bytes-!ok';

describe('OAuth Flow', () => {
    beforeEach(() => {
        process.env.OAUTH_STATE_HMAC_SECRET = FAKE_HMAC_SECRET;
    });

    afterEach(() => {
        delete process.env.OAUTH_STATE_HMAC_SECRET;
        delete process.env.OAUTH_REDIRECT_BASE_URL;
        delete process.env.NEXT_PUBLIC_SITE_URL;
        delete process.env.GOOGLE_CLIENT_ID;
    });

    describe('OAuth state cookie name', () => {
        it('exports the expected cookie name constant', () => {
            expect(OAUTH_STATE_COOKIE_NAME).toBe('siglens_oauth_state');
        });
    });

    describe('issueOAuthState', () => {
        it('returns a state token and a cookie with the correct name', () => {
            const result = issueOAuthState('google', '/dashboard');
            expect(result.state).toBeTruthy();
            expect(result.cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
            expect(result.cookie.httpOnly).toBe(true);
            expect(result.cookie.sameSite).toBe('lax');
            expect(result.cookie.path).toBe('/');
        });

        it('produces a signed cookie value with separator', () => {
            const result = issueOAuthState('google', '/');
            expect(result.cookie.value).toContain('.');
        });
    });

    describe('verifyOAuthState', () => {
        it('verifies a correctly issued state', () => {
            const now = new Date();
            const { state, cookie } = issueOAuthState('google', '/next', now);
            const result = verifyOAuthState('google', state, cookie.value, now);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.next).toBe('/next');
            }
        });

        it('rejects a tampered state', () => {
            const now = new Date();
            const { cookie } = issueOAuthState('google', '/next', now);
            const result = verifyOAuthState(
                'google',
                'wrong_state',
                cookie.value,
                now
            );
            expect(result.ok).toBe(false);
        });

        it('rejects when cookie value is undefined', () => {
            const result = verifyOAuthState('google', 'any', undefined);
            expect(result.ok).toBe(false);
        });
    });

    describe('expiredOAuthStateCookie', () => {
        it('returns a cookie with maxAge 0 and empty value', () => {
            const cookie = expiredOAuthStateCookie();
            expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
            expect(cookie.maxAge).toBe(0);
            expect(cookie.value).toBe('');
        });
    });

    describe('OAuthStateSecretMisconfiguredError', () => {
        it('throws when HMAC secret is missing', () => {
            delete process.env.OAUTH_STATE_HMAC_SECRET;
            expect(() => issueOAuthState('google', '/')).toThrow(
                OAuthStateSecretMisconfiguredError
            );
        });
    });

    describe('Google OAuth adapter', () => {
        it('builds authorize URL with required parameters', () => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            const url = googleOAuthAdapter.authorizeUrl({
                state: 'test_state',
                redirectUri: 'http://localhost:4200/api/auth/callback/google',
            });
            expect(url).toContain('accounts.google.com');
            expect(url).toContain('scope=openid+email+profile');
            expect(url).toContain('state=test_state');
            expect(url).toContain('client_id=test-client-id');
            expect(url).toContain('response_type=code');
        });
    });

    describe('isOAuthProvider', () => {
        it('returns true for supported provider', () => {
            expect(isOAuthProvider('google')).toBe(true);
        });

        it('returns false for unsupported provider', () => {
            expect(isOAuthProvider('facebook')).toBe(false);
            expect(isOAuthProvider('')).toBe(false);
        });
    });

    describe('buildOAuthRedirectUri', () => {
        it('builds redirect URI from OAUTH_REDIRECT_BASE_URL', () => {
            process.env.OAUTH_REDIRECT_BASE_URL = 'https://example.com';
            const uri = buildOAuthRedirectUri('google');
            expect(uri).toBe('https://example.com/api/auth/callback/google');
        });

        it('strips trailing slash from base URL', () => {
            process.env.OAUTH_REDIRECT_BASE_URL = 'https://example.com/';
            const uri = buildOAuthRedirectUri('google');
            expect(uri).toBe('https://example.com/api/auth/callback/google');
        });

        it('throws when no base URL is configured', () => {
            delete process.env.OAUTH_REDIRECT_BASE_URL;
            delete process.env.NEXT_PUBLIC_SITE_URL;
            expect(() => buildOAuthRedirectUri('google')).toThrow(
                'OAuth redirect base URL is not configured'
            );
        });
    });

    describe('Symbol tabs configuration integrity', () => {
        it('all tabs have valid href builders', () => {
            for (const tab of TABS) {
                const href = tab.hrefBuilder('AAPL');
                expect(href).toMatch(/^\/AAPL/);
            }
        });
    });
});
