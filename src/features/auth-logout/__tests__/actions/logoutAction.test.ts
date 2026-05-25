import { vi, type MockedFunction, type Mock } from 'vitest';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/session', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    applyAuthCookie: vi.fn((c: unknown) => c),
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    isSecureCookieEnv: vi.fn(() => false),
    createExpiredAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: '',
    })),
}));
vi.mock('@/entities/user', () => ({
    logoutUser: vi.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logoutUser } from '@/entities/user';
import { logoutAction } from '@/features/auth-logout/actions/logoutAction';
import { resetAuthDatabaseClientForTests } from '@/entities/session/lib/db';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockLogout = logoutUser as MockedFunction<typeof logoutUser>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;

describe('logoutAction', () => {
    let getSpy: Mock;
    let setSpy: Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        getSpy = vi.fn();
        setSpy = vi.fn();
        mockCookies.mockResolvedValue({
            get: getSpy,
            set: setSpy,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockLogout.mockReset();
        mockRedirect.mockClear();
    });

    it('세션 쿠키가 없으면 logoutUser를 호출하지 않고 / 로 redirect한다', async () => {
        getSpy.mockReturnValue(undefined);
        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mockLogout).not.toHaveBeenCalled();
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('세션 쿠키가 있으면 logoutUser를 호출하고 만료 쿠키를 set한다', async () => {
        getSpy.mockReturnValue({ value: 'tok' });
        mockLogout.mockResolvedValue({
            ok: true,
            sessionInvalidated: true,
            cookie: {
                name: 'siglens_session',
                value: '',
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
                maxAgeSeconds: 0,
            },
        });
        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mockLogout).toHaveBeenCalledWith(
            { sessionToken: 'tok' },
            expect.any(Object),
            expect.objectContaining({ secureCookie: false })
        );
        expect(setSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'siglens_session',
                maxAgeSeconds: 0,
            })
        );
    });
});
