import {
    issueOAuthState,
    verifyOAuthState,
    OAuthStateSecretMisconfiguredError,
    OAUTH_STATE_COOKIE_NAME,
} from '@/features/auth-oauth/lib/state';

const VALID_SECRET = 'a'.repeat(32);

describe('OAuth state validation edge cases', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('HMAC misconfiguration', () => {
        it('throws OAuthStateSecretMisconfiguredError when secret is missing', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');

            expect(() => issueOAuthState('google', '/')).toThrow(
                OAuthStateSecretMisconfiguredError
            );
        });

        it('throws when secret is too short', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'short');

            expect(() => issueOAuthState('google', '/')).toThrow(
                'at least 32 bytes'
            );
        });

        it('verify also throws on missing secret', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');

            expect(() => verifyOAuthState('google', 'state', 'cookie')).toThrow(
                OAuthStateSecretMisconfiguredError
            );
        });
    });

    describe('Missing state cookie', () => {
        it('returns ok: false when cookie value is undefined', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);

            const result = verifyOAuthState('google', 'some-state', undefined);

            expect(result.ok).toBe(false);
        });

        it('returns ok: false when cookie value is empty string', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);

            const result = verifyOAuthState('google', 'state', '');

            expect(result.ok).toBe(false);
        });
    });

    describe('Tampered cookie', () => {
        it('returns ok: false when signature is tampered', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const { state, cookie } = issueOAuthState('google', '/dashboard');

            const tampered = cookie.value.replace(/.$/, 'X');
            const result = verifyOAuthState('google', state, tampered);

            expect(result.ok).toBe(false);
        });

        it('returns ok: false when payload is tampered', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const { state, cookie } = issueOAuthState('google', '/dashboard');

            const [, sig] = cookie.value.split('.');
            const tampered = `dGFtcGVyZWQ.${sig}`;
            const result = verifyOAuthState('google', state, tampered);

            expect(result.ok).toBe(false);
        });
    });

    describe('Provider mismatch', () => {
        it('returns ok: false when provider does not match', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const { state, cookie } = issueOAuthState('google', '/');

            const result = verifyOAuthState(
                'apple' as unknown as 'google',
                state,
                cookie.value
            );

            expect(result.ok).toBe(false);
        });
    });

    describe('Expired state', () => {
        it('returns ok: false when state has expired', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const issuedAt = new Date('2025-01-01T00:00:00Z');
            const { state, cookie } = issueOAuthState('google', '/', issuedAt);

            const verifyAt = new Date('2025-01-01T00:10:00Z');
            const result = verifyOAuthState(
                'google',
                state,
                cookie.value,
                verifyAt
            );

            expect(result.ok).toBe(false);
        });
    });

    describe('Valid flow', () => {
        it('succeeds with correct state and cookie', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const now = new Date();
            const { state, cookie } = issueOAuthState(
                'google',
                '/dashboard',
                now
            );

            const result = verifyOAuthState('google', state, cookie.value, now);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.next).toBe('/dashboard');
            }
        });

        it('cookie has correct name', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
            const { cookie } = issueOAuthState('google', '/');

            expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
            expect(cookie.httpOnly).toBe(true);
            expect(cookie.sameSite).toBe('lax');
        });
    });

    describe('Malformed cookie format', () => {
        it('returns ok: false when cookie has no separator', () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);

            const result = verifyOAuthState(
                'google',
                'state',
                'no-separator-here'
            );

            expect(result.ok).toBe(false);
        });
    });
});
