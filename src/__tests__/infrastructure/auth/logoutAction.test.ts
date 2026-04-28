jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@y0ngha/siglens-core', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    DrizzleSessionRepository: jest.fn().mockImplementation(() => ({})),
    logoutUser: jest.fn(),
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logoutUser } from '@y0ngha/siglens-core';
import { logoutAction } from '@/infrastructure/auth/logoutAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockLogout = logoutUser as jest.MockedFunction<typeof logoutUser>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('logoutAction', () => {
    let getSpy: jest.Mock;
    let setSpy: jest.Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        getSpy = jest.fn();
        setSpy = jest.fn();
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
            expect.objectContaining({ name: 'siglens_session', maxAge: 0 })
        );
    });
});
