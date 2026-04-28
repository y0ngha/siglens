jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@y0ngha/siglens-core', () => ({
    DrizzleSessionRepository: jest.fn().mockImplementation(() => ({})),
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    bcryptPasswordVerifier: { verifyPassword: jest.fn() },
    loginUser: jest.fn(),
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginUser } from '@y0ngha/siglens-core';
import { loginAction } from '@/infrastructure/auth/loginAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockLogin = loginUser as jest.MockedFunction<typeof loginUser>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('loginAction', () => {
    let setSpy: jest.Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        setSpy = jest.fn();
        mockCookies.mockResolvedValue({
            set: setSpy,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockLogin.mockReset();
        mockRedirect.mockClear();
    });

    it('formData에 email/password 키가 없으면 빈 문자열로 loginUser를 호출한다', async () => {
        mockLogin.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: 'Email or password is incorrect',
            },
        });
        await loginAction({ error: null }, makeFormData({}));
        expect(mockLogin).toHaveBeenCalledWith(
            { email: '', password: '' },
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('email은 trim하고 password는 원본을 유지한다', async () => {
        mockLogin.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: 'Email or password is incorrect',
            },
        });
        await loginAction(
            { error: null },
            makeFormData({ email: '  a@b.com  ', password: '  Pass1234  ' })
        );
        expect(mockLogin).toHaveBeenCalledWith(
            { email: 'a@b.com', password: '  Pass1234  ' },
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('로그인 실패 시 폼 상태로 에러를 반환한다', async () => {
        mockLogin.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: 'Email or password is incorrect',
            },
        });
        const result = await loginAction(
            { error: null },
            makeFormData({ email: 'a@b.com', password: 'wrong' })
        );
        expect(result.error?.code).toBe('invalid_credentials');
        expect(setSpy).not.toHaveBeenCalled();
        expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('로그인 성공 시 쿠키를 set하고 sanitize된 next로 redirect한다', async () => {
        mockLogin.mockResolvedValue({
            ok: true,
            user: { id: 'u1' } as never,
            session: { id: 's1' } as never,
            cookie: {
                name: 'siglens_session',
                value: 'tok',
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/',
                expires: new Date(),
                maxAgeSeconds: 60,
            },
        });
        await expect(
            loginAction(
                { error: null },
                makeFormData({
                    email: 'a@b.com',
                    password: 'Pass1234',
                    next: '/market',
                })
            )
        ).rejects.toThrow('NEXT_REDIRECT:/market');
        expect(setSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'siglens_session',
                value: 'tok',
            })
        );
    });
});
