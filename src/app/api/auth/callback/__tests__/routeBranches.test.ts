/**
 * Branch coverage tests for oauth callback route.ts — targets uncovered:
 * - L46: invalid provider
 * - L54: missing state/code params
 * - L62: OAuthStateSecretMisconfiguredError catch
 * - L69: verifyOAuthState fails
 * - L77: exchangeCodeForProfile fails
 * - L135: accessToken fallback to ''
 */

import type { MockedFunction, MockedClass } from 'vitest';

vi.mock('@/entities/auth', () => ({
    applyAuthCookie: vi.fn().mockReturnValue({ name: 'auth', value: 'v' }),
    createAuthHintCookie: vi.fn().mockReturnValue({ name: 'hint', value: '1' }),
    createAuthSession: vi.fn(),
    DEFAULT_SESSION_TTL_SECONDS: 86400,
    isSecureCookieEnv: vi.fn().mockReturnValue(false),
}));
// DrizzleUserRepository와 DrizzleSessionRepository는 barrel이 아닌
// @/entities/auth/api에서 직접 import되므로 해당 경로를 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn(),
    DrizzleUserRepository: vi.fn(),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/oauth-account', () => ({
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));

const { MockOAuthStateSecretMisconfiguredError } = vi.hoisted(() => {
    const MockOAuthStateSecretMisconfiguredError = class extends Error {
        constructor() {
            super('HMAC secret misconfigured');
            this.name = 'OAuthStateSecretMisconfiguredError';
        }
    };
    return { MockOAuthStateSecretMisconfiguredError };
});

vi.mock('@/features/auth-oauth', () => ({
    buildOAuthRedirectUri: vi
        .fn()
        .mockReturnValue('https://siglens.io/api/auth/callback/google'),
    getOAuthRedirectBaseUrl: vi.fn().mockReturnValue('https://siglens.io'),
    getOAuthAdapter: vi.fn(),
    isOAuthProvider: vi.fn(),
    OAUTH_STATE_COOKIE_NAME: 'oauth_state',
    OAuthStateSecretMisconfiguredError: MockOAuthStateSecretMisconfiguredError,
    expiredOAuthStateCookie: vi
        .fn()
        .mockReturnValue({ name: 'oauth_state', value: '', maxAge: 0 }),
    verifyOAuthState: vi.fn(),
}));
vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn().mockImplementation((p: string) => p || '/'),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/callback/[provider]/route';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import {
    getOAuthAdapter,
    isOAuthProvider,
    verifyOAuthState,
} from '@/features/auth-oauth';

const MockUserRepository = DrizzleUserRepository as MockedClass<
    typeof DrizzleUserRepository
>;
const MockSessionRepository = DrizzleSessionRepository as MockedClass<
    typeof DrizzleSessionRepository
>;
const mockIsOAuthProvider = isOAuthProvider as MockedFunction<
    typeof isOAuthProvider
>;
const mockVerifyOAuthState = verifyOAuthState as MockedFunction<
    typeof verifyOAuthState
>;
const mockGetOAuthAdapter = getOAuthAdapter as MockedFunction<
    typeof getOAuthAdapter
>;

function makeRequest(
    searchParams: Record<string, string> = {},
    cookies: Record<string, string> = {}
): NextRequest {
    const url = new URL('https://example.com/api/auth/callback/google');
    Object.entries(searchParams).forEach(([k, v]) =>
        url.searchParams.set(k, v)
    );
    const req = new NextRequest(url);
    Object.entries(cookies).forEach(([k, v]) => {
        req.cookies.set(k, v);
    });
    return req;
}

const DEFAULT_PARAMS = { params: Promise.resolve({ provider: 'google' }) };

describe('GET /api/auth/callback — branch coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        MockUserRepository.mockImplementation(function (this: unknown) {
            Object.assign(this as Record<string, unknown>, {
                findByOAuthAccount: vi.fn().mockResolvedValue(null),
                findByEmail: vi.fn().mockResolvedValue(null),
            });
        } as never);
        MockSessionRepository.mockImplementation(function () {} as never);
    });

    it('redirects to error for unsupported provider (L46)', async () => {
        mockIsOAuthProvider.mockReturnValue(false);

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('error=oauth_unknown');
    });

    it('redirects to error when state or code is missing (L54)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);

        // Missing both state and code
        const req = makeRequest({}, { oauth_state: 'cookie' });
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('error=oauth_unknown');
    });

    it('redirects to error on OAuthStateSecretMisconfiguredError (L62)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockImplementation(() => {
            throw new MockOAuthStateSecretMisconfiguredError();
        });

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('error=oauth_unknown');
    });

    it('re-throws non-OAuthStateSecretMisconfiguredError (L67)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockImplementation(() => {
            throw new Error('some other error');
        });

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );

        await expect(GET(req, DEFAULT_PARAMS)).rejects.toThrow(
            'some other error'
        );
    });

    it('redirects to error when state verification fails (L69)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockReturnValue({ ok: false });

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('error=oauth_unknown');
    });

    it('redirects to error when profile exchange fails (L77)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockReturnValue({ ok: true, next: '/' });
        mockGetOAuthAdapter.mockReturnValue({
            id: 'google',
            exchangeCodeForProfile: vi.fn().mockResolvedValue({ ok: false }),
        } as never);

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('error=oauth_profile_invalid');
    });

    it('saves profile with empty accessToken when undefined (L135)', async () => {
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockReturnValue({ ok: true, next: '/' });
        mockGetOAuthAdapter.mockReturnValue({
            id: 'google',
            exchangeCodeForProfile: vi.fn().mockResolvedValue({
                ok: true,
                profile: {
                    provider: 'google',
                    providerAccountId: 'gid',
                    email: 'test@example.com',
                    name: 'Test',
                    avatarUrl: null,
                    // accessToken is undefined — should fallback to ''
                    refreshToken: undefined,
                    tokenExpiresAt: undefined,
                },
            }),
        } as never);

        const mockSave = vi.fn().mockResolvedValue('pending-token');
        (
            createPendingOAuthSignupStoreFromEnv as MockedFunction<
                typeof createPendingOAuthSignupStoreFromEnv
            >
        ).mockReturnValue({
            save: mockSave,
            peek: vi.fn(),
            consume: vi.fn(),
            delete: vi.fn(),
        });

        const req = makeRequest(
            { state: 'valid', code: 'auth-code' },
            { oauth_state: 'cookie' }
        );
        const res = await GET(req, DEFAULT_PARAMS);

        expect(res.status).toBe(307);
        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: '', // fallback from undefined ?? ''
            })
        );
    });
});
