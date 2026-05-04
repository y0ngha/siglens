// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/infrastructure/db/userRepository', () => ({
    DrizzleUserRepository: jest.fn(),
}));
jest.mock('@/infrastructure/db/sessionRepository', () => ({
    DrizzleSessionRepository: jest.fn(),
}));
jest.mock('@/infrastructure/auth/db', () => ({
    getAuthDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));
jest.mock('@/infrastructure/auth/applyAuthCookie', () => ({
    applyAuthCookie: jest.fn().mockReturnValue({ name: 'auth', value: 'v' }),
}));
jest.mock('@/infrastructure/auth/authHintCookie', () => ({
    createAuthHintCookie: jest.fn().mockReturnValue({ name: 'hint', value: '1' }),
}));
jest.mock('@/infrastructure/auth/sessionCookie', () => ({
    createAuthSession: jest.fn(),
    DEFAULT_SESSION_TTL_SECONDS: 86400,
}));
jest.mock('@/infrastructure/auth/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: jest.fn(),
}));
jest.mock('@/infrastructure/auth/oauth/providers', () => ({
    buildOAuthRedirectUri: jest.fn().mockReturnValue('https://example.com/callback/google'),
    getOAuthAdapter: jest.fn(),
    isOAuthProvider: jest.fn(),
}));
jest.mock('@/infrastructure/auth/oauth/state', () => ({
    OAUTH_STATE_COOKIE_NAME: 'oauth_state',
    OAuthStateSecretMisconfiguredError: class OAuthStateSecretMisconfiguredError extends Error {},
    expiredOAuthStateCookie: jest.fn().mockReturnValue({ name: 'oauth_state', value: '', maxAge: 0 }),
    verifyOAuthState: jest.fn(),
}));
jest.mock('@/infrastructure/auth/sessionCookieOptions', () => ({
    isSecureCookieEnv: jest.fn().mockReturnValue(false),
}));
jest.mock('@/domain/auth/redirect', () => ({
    sanitizeNextPath: jest.fn().mockImplementation((p: string) => p || '/'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/callback/[provider]/route';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { createAuthSession } from '@/infrastructure/auth/sessionCookie';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { getOAuthAdapter, isOAuthProvider } from '@/infrastructure/auth/oauth/providers';
import { verifyOAuthState } from '@/infrastructure/auth/oauth/state';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------

const MockUserRepository = DrizzleUserRepository as jest.MockedClass<typeof DrizzleUserRepository>;
const MockSessionRepository = DrizzleSessionRepository as jest.MockedClass<typeof DrizzleSessionRepository>;
const mockCreateAuthSession = createAuthSession as jest.MockedFunction<typeof createAuthSession>;
const mockCreatePendingOAuthSignupStoreFromEnv = jest.mocked(createPendingOAuthSignupStoreFromEnv);
const mockGetOAuthAdapter = getOAuthAdapter as jest.MockedFunction<typeof getOAuthAdapter>;
const mockIsOAuthProvider = isOAuthProvider as jest.MockedFunction<typeof isOAuthProvider>;
const mockVerifyOAuthState = verifyOAuthState as jest.MockedFunction<typeof verifyOAuthState>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_PROFILE = {
    provider: 'google' as const,
    providerAccountId: 'google-uid-123',
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: new Date('2027-01-01'),
};

const FAKE_USER = {
    id: 'u1',
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: null,
    tier: 'free' as const,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const FAKE_COOKIE = {
    name: 'siglens_session',
    value: 'session-tok',
    httpOnly: true as const,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(),
    maxAgeSeconds: 86400,
};

function makeRequest(searchParams: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
    const url = new URL('https://example.com/api/auth/callback/google');
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
    const req = new NextRequest(url);
    Object.entries(cookies).forEach(([k, v]) => {
        req.cookies.set(k, v);
    });
    return req;
}

const DEFAULT_PARAMS = { params: Promise.resolve({ provider: 'google' }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/callback/[provider]', () => {
    let mockUserRepo: jest.Mocked<InstanceType<typeof DrizzleUserRepository>>;
    let mockSessionRepo: jest.Mocked<InstanceType<typeof DrizzleSessionRepository>>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsOAuthProvider.mockReturnValue(true);
        mockVerifyOAuthState.mockReturnValue({ ok: true, next: '/' });
        mockGetOAuthAdapter.mockReturnValue({
            id: 'google',
            exchangeCodeForProfile: jest.fn().mockResolvedValue({
                ok: true,
                profile: FAKE_PROFILE,
            }),
        } as never);

        mockUserRepo = {
            findByOAuthAccount: jest.fn().mockResolvedValue(null),
            findByEmail: jest.fn().mockResolvedValue(null),
        } as never;
        mockSessionRepo = {} as never;

        MockUserRepository.mockImplementation(() => mockUserRepo);
        MockSessionRepository.mockImplementation(() => mockSessionRepo);

        mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
            save: jest.fn().mockResolvedValue('pending-token'),
            peek: jest.fn(),
            consume: jest.fn(),
            delete: jest.fn(),
        });
    });

    describe('기존 OAuth 계정 사용자', () => {
        it('기존 OAuth 계정이 있으면 세션을 생성하고 next 경로로 리다이렉트한다', async () => {
            mockUserRepo.findByOAuthAccount.mockResolvedValue(FAKE_USER);
            mockCreateAuthSession.mockResolvedValue({
                ok: true,
                user: FAKE_USER,
                session: { id: 's1' } as never,
                cookie: FAKE_COOKIE,
            } as never);

            const req = makeRequest(
                { state: 'valid-state', code: 'auth-code' },
                { oauth_state: 'cookie-state' }
            );
            const res = await GET(req, DEFAULT_PARAMS);

            expect(res.status).toBe(307);
            expect(mockCreateAuthSession).toHaveBeenCalledWith(
                expect.objectContaining({ userId: FAKE_USER.id })
            );
        });
    });

    describe('이메일 충돌', () => {
        it('동일 이메일의 이메일 계정이 존재하면 oauth_email_conflict로 리다이렉트한다', async () => {
            mockUserRepo.findByOAuthAccount.mockResolvedValue(null);
            mockUserRepo.findByEmail.mockResolvedValue(FAKE_USER);

            const req = makeRequest(
                { state: 'valid-state', code: 'auth-code' },
                { oauth_state: 'cookie-state' }
            );
            const res = await GET(req, DEFAULT_PARAMS);

            expect(res.status).toBe(307);
            const location = res.headers.get('location') ?? '';
            expect(location).toContain('error=oauth_email_conflict');
            expect(location).toContain(encodeURIComponent(FAKE_PROFILE.email));
        });
    });

    describe('pendingStore.save 실패', () => {
        it('pendingStore.save가 실패하면 oauth_unknown으로 리다이렉트한다', async () => {
            mockUserRepo.findByOAuthAccount.mockResolvedValue(null);
            mockUserRepo.findByEmail.mockResolvedValue(null);
            mockCreatePendingOAuthSignupStoreFromEnv.mockReturnValue({
                save: jest.fn().mockRejectedValue(new Error('Redis down')),
                peek: jest.fn(),
                consume: jest.fn(),
                delete: jest.fn(),
            });

            const req = makeRequest(
                { state: 'valid-state', code: 'auth-code' },
                { oauth_state: 'cookie-state' }
            );
            const res = await GET(req, DEFAULT_PARAMS);

            expect(res.status).toBe(307);
            const location = res.headers.get('location') ?? '';
            expect(location).toContain('error=oauth_unknown');
        });
    });

    describe('정상 흐름', () => {
        it('신규 사용자는 consent 페이지로 리다이렉트된다', async () => {
            const req = makeRequest(
                { state: 'valid-state', code: 'auth-code' },
                { oauth_state: 'cookie-state' }
            );
            const res = await GET(req, DEFAULT_PARAMS);

            expect(res.status).toBe(307);
            const location = res.headers.get('location') ?? '';
            expect(location).toContain('/signup/oauth/consent');
            expect(location).toContain('token=pending-token');
        });
    });
});
