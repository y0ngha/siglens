import type { MockedFunction, Mock } from 'vitest';
// 액션의 리다이렉트는 `localeHref`/`localeRedirect`를 거치고, 그 안의
// `getLocale()`은 next-intl config 파일을 요구한다(빌드 플러그인이 만든다).
// 여기서는 액션 로직만 검증하므로 기본 로케일로 고정한다 — 그러면 리다이렉트
// 경로가 접두사 없는 기존 값과 같아져 기존 단언이 그대로 유효하다.
vi.mock('next-intl/server', () => ({ getLocale: async () => 'ko' }));
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
vi.mock('@/entities/auth', () => ({
    applyAuthCookie: vi.fn((c: unknown) => c),
    isSecureCookieEnv: vi.fn(() => false),
    createAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: 'true',
    })),
    DEFAULT_SESSION_TTL_SECONDS: 7776000,
    loginUser: vi.fn(),
}));
// DrizzleUserRepository와 DrizzleSessionRepository는 barrel이 아닌
// @/entities/auth/api에서 직접 import되므로 해당 경로를 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    DrizzleUserRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
vi.mock('@/entities/auth/lib/bcrypt', () => ({
    bcryptPasswordVerifier: { verifyPassword: vi.fn() },
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetAuthDatabaseClientForTests: vi.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginUser } from '@/entities/auth';
import { loginAction } from '@/features/auth-login/actions/loginAction';
import { resetAuthDatabaseClientForTests } from '@/entities/auth/lib/db';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockLogin = loginUser as MockedFunction<typeof loginUser>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;

describe('loginAction', () => {
    let setSpy: Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        setSpy = vi.fn();
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
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
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
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
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
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
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
