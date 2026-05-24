jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/shared/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: jest.fn(),
}));
jest.mock('@/infrastructure/auth/sessionCookie', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
jest.mock('@/infrastructure/db/sessionRepository', () => ({
    DrizzleSessionRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/infrastructure/db/userRepository', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/infrastructure/auth/use-cases/findUserBySessionToken', () => ({
    findUserBySessionToken: jest.fn(),
}));

import { cookies } from 'next/headers';
import { findUserBySessionToken } from '@/infrastructure/auth/use-cases/findUserBySessionToken';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockFind = findUserBySessionToken as jest.MockedFunction<
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
