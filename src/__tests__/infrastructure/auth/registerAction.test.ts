jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@y0ngha/siglens-core', () => ({
    DrizzleSessionRepository: jest.fn().mockImplementation(() => ({})),
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    bcryptPasswordHasher: { hashPassword: jest.fn() },
    bcryptPasswordVerifier: { verifyPassword: jest.fn() },
    loginUser: jest.fn(),
    registerUser: jest.fn(),
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginUser, registerUser } from '@y0ngha/siglens-core';
import { registerAction } from '@/infrastructure/auth/registerAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockRegister = registerUser as jest.MockedFunction<typeof registerUser>;
const mockLogin = loginUser as jest.MockedFunction<typeof loginUser>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

const FAKE_USER = {
    id: 'u1',
    email: 'a@b.com',
    name: null,
    avatarUrl: null,
    tier: 'free' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const FAKE_COOKIE = {
    name: 'siglens_session',
    value: 'tok',
    httpOnly: true as const,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(),
    maxAgeSeconds: 60,
};

describe('registerAction', () => {
    let setSpy: jest.Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        setSpy = jest.fn();
        mockCookies.mockResolvedValue({
            set: setSpy,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockRegister.mockReset();
        mockLogin.mockReset();
        mockRedirect.mockClear();
    });

    it('formData에 email/password 키가 없으면 빈 문자열로 registerUser를 호출한다', async () => {
        mockRegister.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_email',
                field: 'email',
                message: 'Email format is invalid',
            },
        });
        await registerAction({ error: null }, makeFormData({}));
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({ email: '', password: '' }),
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('email은 trim하고 password는 원본을 유지한다', async () => {
        mockRegister.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_email',
                field: 'email',
                message: 'Email format is invalid',
            },
        });
        await registerAction(
            { error: null },
            makeFormData({ email: '  a@b.com  ', password: '  Pass1234  ' })
        );
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'a@b.com',
                password: '  Pass1234  ',
            }),
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('회원가입 검증 실패 시 폼 상태로 에러를 반환한다', async () => {
        mockRegister.mockResolvedValue({
            ok: false,
            error: {
                code: 'weak_password',
                field: 'password',
                message: 'Password must be at least 8 characters',
            },
        });
        const result = await registerAction(
            { error: null },
            makeFormData({ email: 'a@b.com', password: 'weak' })
        );
        expect(result.error?.code).toBe('weak_password');
        expect(result.error?.field).toBe('password');
        expect(mockLogin).not.toHaveBeenCalled();
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('회원가입 성공 후 자동 로그인이 실패하면 auto_login_failed 에러를 반환한다', async () => {
        mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
        mockLogin.mockResolvedValue({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: 'Email or password is incorrect',
            },
        });
        const result = await registerAction(
            { error: null },
            makeFormData({ email: 'a@b.com', password: 'Pass1234' })
        );
        expect(result.error?.code).toBe('auto_login_failed');
        expect(setSpy).not.toHaveBeenCalled();
        expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('회원가입 + 자동 로그인 성공 시 name과 next를 반영해 redirect한다', async () => {
        mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
        mockLogin.mockResolvedValue({
            ok: true,
            user: FAKE_USER,
            session: { id: 's1' } as never,
            cookie: FAKE_COOKIE,
        });
        await expect(
            registerAction(
                { error: null },
                makeFormData({
                    email: 'a@b.com',
                    password: 'Pass1234',
                    name: '  Holly  ',
                    next: '/market',
                })
            )
        ).rejects.toThrow('NEXT_REDIRECT:/market');
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Holly' }),
            expect.any(Object),
            expect.any(Object)
        );
        expect(setSpy).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'tok' })
        );
    });

    it('name이 빈 문자열이면 undefined로 전달된다', async () => {
        mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
        mockLogin.mockResolvedValue({
            ok: true,
            user: FAKE_USER,
            session: { id: 's1' } as never,
            cookie: FAKE_COOKIE,
        });
        await expect(
            registerAction(
                { error: null },
                makeFormData({
                    email: 'a@b.com',
                    password: 'Pass1234',
                    name: '   ',
                })
            )
        ).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mockRegister).toHaveBeenCalledWith(
            expect.objectContaining({ name: undefined }),
            expect.any(Object),
            expect.any(Object)
        );
    });
});
