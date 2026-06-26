import {
    createSessionCookie,
    createExpiredSessionCookie,
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
    DEFAULT_AUTH_COOKIE_PATH,
    DEFAULT_AUTH_COOKIE_SAME_SITE,
} from '@/entities/auth/lib/sessionCookie';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import type { SessionRepository } from '@/shared/db/types';
import { MS_PER_SECOND } from '@/shared/config/time';

describe('createSessionCookie', () => {
    it('builds an active cookie with all defaults', () => {
        const expires = new Date('2026-06-25T00:00:00Z');
        const cookie = createSessionCookie({
            token: 'tok_abc',
            expires,
            maxAgeSeconds: 3600,
        });

        expect(cookie).toEqual({
            name: AUTH_SESSION_COOKIE_NAME,
            value: 'tok_abc',
            httpOnly: true,
            secure: true,
            sameSite: DEFAULT_AUTH_COOKIE_SAME_SITE,
            path: DEFAULT_AUTH_COOKIE_PATH,
            expires,
            maxAgeSeconds: 3600,
        });
    });

    it('accepts custom name, secure, sameSite, and path overrides', () => {
        const expires = new Date('2026-06-25T00:00:00Z');
        const cookie = createSessionCookie({
            token: 'tok_custom',
            expires,
            maxAgeSeconds: 7200,
            name: 'custom_session',
            secure: false,
            sameSite: 'strict',
            path: '/dashboard',
        });

        expect(cookie.name).toBe('custom_session');
        expect(cookie.secure).toBe(false);
        expect(cookie.sameSite).toBe('strict');
        expect(cookie.path).toBe('/dashboard');
    });
});

describe('createExpiredSessionCookie', () => {
    it('builds an expired cookie with zero maxAge and epoch expiry', () => {
        const cookie = createExpiredSessionCookie();

        expect(cookie.value).toBe('');
        expect(cookie.maxAgeSeconds).toBe(0);
        expect(cookie.expires).toEqual(new Date('1970-01-01T00:00:00.000Z'));
        expect(cookie.httpOnly).toBe(true);
    });

    it('accepts custom params for name, secure, sameSite, path', () => {
        const cookie = createExpiredSessionCookie({
            name: 'custom',
            secure: false,
            sameSite: 'none',
            path: '/api',
        });

        expect(cookie.name).toBe('custom');
        expect(cookie.secure).toBe(false);
        expect(cookie.sameSite).toBe('none');
        expect(cookie.path).toBe('/api');
    });

    it('uses defaults when called with no params', () => {
        const cookie = createExpiredSessionCookie();

        expect(cookie.name).toBe(AUTH_SESSION_COOKIE_NAME);
        expect(cookie.secure).toBe(true);
    });
});

describe('createAuthSession', () => {
    const mockSessions: SessionRepository = {
        createSession: vi.fn(),
        findSession: vi.fn(),
        deleteSession: vi.fn(),
        deleteExpiredSessions: vi.fn(),
    };

    const now = new Date('2026-05-25T12:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();
        (
            mockSessions.createSession as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
            id: 'sess_123',
            userId: 'user_1',
            expiresAt: new Date(
                now.getTime() + DEFAULT_SESSION_TTL_SECONDS * MS_PER_SECOND
            ),
            createdAt: now,
        });
    });

    it('creates a session and returns a cookie with default TTL', async () => {
        const result = await createAuthSession({
            userId: 'user_1',
            sessions: mockSessions,
            now,
        });

        expect(result.session.id).toBe('sess_123');
        expect(result.cookie.value).toBe('sess_123');
        expect(result.cookie.maxAgeSeconds).toBe(DEFAULT_SESSION_TTL_SECONDS);
        expect(mockSessions.createSession).toHaveBeenCalledWith({
            userId: 'user_1',
            expiresAt: expect.any(Date),
        });
    });

    it('accepts a custom sessionTtlSeconds', async () => {
        const customTtl = 3600;
        const expectedExpiry = new Date(
            now.getTime() + customTtl * MS_PER_SECOND
        );
        (
            mockSessions.createSession as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
            id: 'sess_456',
            userId: 'user_1',
            expiresAt: expectedExpiry,
            createdAt: now,
        });

        const result = await createAuthSession({
            userId: 'user_1',
            sessions: mockSessions,
            now,
            sessionTtlSeconds: customTtl,
        });

        expect(result.cookie.maxAgeSeconds).toBe(customTtl);
        expect(mockSessions.createSession).toHaveBeenCalledWith({
            userId: 'user_1',
            expiresAt: expectedExpiry,
        });
    });

    it('forwards cookieName, secureCookie, sameSite, and path overrides', async () => {
        const result = await createAuthSession({
            userId: 'user_1',
            sessions: mockSessions,
            now,
            cookieName: 'custom',
            secureCookie: false,
            sameSite: 'none',
            path: '/app',
        });

        expect(result.cookie.name).toBe('custom');
        expect(result.cookie.secure).toBe(false);
        expect(result.cookie.sameSite).toBe('none');
        expect(result.cookie.path).toBe('/app');
    });
});
