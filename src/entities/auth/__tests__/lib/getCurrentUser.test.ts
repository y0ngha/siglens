import type { MockedFunction } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/auth/lib/sessionCookie', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
vi.mock('@/entities/auth/lib/findUserBySessionToken', () => ({
    findUserBySessionToken: vi.fn(),
}));

import { cookies } from 'next/headers';
import { findUserBySessionToken } from '@/entities/auth/lib/findUserBySessionToken';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resetAuthDatabaseClientForTests } from '@/entities/auth/lib/db';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockFind = findUserBySessionToken as MockedFunction<
    typeof findUserBySessionToken
>;

function makeCookieStore(token?: string) {
    return {
        get: (name: string) =>
            name === 'siglens_session' && token
                ? { name, value: token }
                : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe('getCurrentUser', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        mockFind.mockReset();
    });

    it('세션 쿠키가 없으면 findUserBySessionToken 호출 없이 null을 반환한다', async () => {
        mockCookies.mockResolvedValue(makeCookieStore());
        const result = await getCurrentUser();
        expect(result).toBeNull();
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('세션 쿠키가 있으면 findUserBySessionToken 결과를 반환한다', async () => {
        const fakeUser = {
            id: 'user-1',
            email: 'user@example.com',
            name: null,
            avatarUrl: null,
            tier: 'free' as const,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        mockCookies.mockResolvedValue(makeCookieStore('abc'));
        mockFind.mockResolvedValue(fakeUser);
        const result = await getCurrentUser();
        expect(result).toBe(fakeUser);
        expect(mockFind).toHaveBeenCalledWith(
            'abc',
            expect.objectContaining({
                users: expect.any(Object),
                sessions: expect.any(Object),
            })
        );
    });
});
