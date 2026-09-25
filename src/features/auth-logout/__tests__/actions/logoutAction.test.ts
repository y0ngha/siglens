import type { MockedFunction, Mock } from 'vitest';
// 액션의 리다이렉트는 `localeHref`/`localeRedirect`를 거치고, 그 안의
// `getLocale()`은 next-intl config 파일을 요구한다(빌드 플러그인이 만든다).
// 여기서는 액션 로직만 검증하므로 기본 로케일로 고정한다 — 그러면 리다이렉트
// 경로가 접두사 없는 기존 값과 같아져 기존 단언이 그대로 유효하다.
// ko 카탈로그를 실제로 조회하는 스텁 — 키 오타나 카탈로그 누락이 여기서 잡힌다.
vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
const host = vi.hoisted(() => ({ value: 'siglens.io' }));
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
    headers: vi.fn(async () => new Headers({ host: host.value })),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
// 핸드오프 스토어는 Redis 발급만 가짜로 두고 URL 빌더는 실제 것을 쓴다.
vi.mock('@/entities/auth/lib/handoffStore', async () => ({
    ...(await vi.importActual('@/entities/auth/lib/handoffStore')),
    issueLogoutCode: vi.fn(),
}));
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
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    applyAuthCookie: vi.fn((c: unknown) => c),
    isSecureCookieEnv: vi.fn(() => false),
    createExpiredAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: '',
    })),
    logoutUser: vi.fn(),
}));
// DrizzleSessionRepository는 barrel이 아닌 @/entities/auth/api에서 직접 import되므로
// 해당 경로를 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetAuthDatabaseClientForTests: vi.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logoutUser } from '@/entities/auth';
import { logoutAction } from '@/features/auth-logout/actions/logoutAction';
import { resetAuthDatabaseClientForTests } from '@/entities/auth/lib/db';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { issueLogoutCode } from '@/entities/auth/lib/handoffStore';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockLogout = logoutUser as MockedFunction<typeof logoutUser>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockIssueLogoutCode = issueLogoutCode as MockedFunction<
    typeof issueLogoutCode
>;
const EXPIRED_COOKIE = {
    name: 'siglens_session',
    value: '',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAgeSeconds: 0,
} as const;

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
        mockGetCurrentUser.mockReset();
        mockIssueLogoutCode.mockReset();
        host.value = 'siglens.io';
    });

    it('세션 쿠키가 없으면 logoutUser를 호출하지 않고 / 로 redirect한다', async () => {
        getSpy.mockReturnValue(undefined);
        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mockLogout).not.toHaveBeenCalled();
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('unexpected logoutUser error 는 catch 블록에서 redirect(/) 로 폴백한다', async () => {
        getSpy.mockReturnValue({ value: 'tok' });
        mockLogout.mockRejectedValue(new Error('DB connection lost'));

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/');
        expect(errorSpy).toHaveBeenCalledWith(
            '[logoutAction] unexpected error:',
            expect.any(Error)
        );

        errorSpy.mockRestore();
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

    /**
     * ai 세션만 지우면 ai 홈이 핸드오프로 살아 있는 메인 세션에 다시 로그인한다.
     * 그래서 ai 로그아웃은 메인 로그아웃 라우트로 넘어가 메인 세션도 끝낸다.
     */
    describe('ai 호스트', () => {
        beforeEach(() => {
            host.value = 'ai.siglens.io';
        });

        it('세션을 지우기 전에 사용자를 읽어 로그아웃 코드를 발급하고 메인 로그아웃 라우트로 보낸다', async () => {
            getSpy.mockReturnValue({ value: 'tok' });
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockIssueLogoutCode.mockResolvedValue('c'.repeat(64));
            mockLogout.mockResolvedValue({
                ok: true,
                sessionInvalidated: true,
                cookie: EXPIRED_COOKIE,
            });

            await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
            expect(
                mockGetCurrentUser.mock.invocationCallOrder[0]!
            ).toBeLessThan(mockLogout.mock.invocationCallOrder[0]!);
            expect(mockIssueLogoutCode).toHaveBeenCalledWith({
                userId: 'u1',
                locale: 'ko',
            });
            expect(mockRedirect).toHaveBeenCalledWith(
                `https://siglens.io/api/auth/handoff/logout?code=${'c'.repeat(64)}`
            );
        });

        it('코드를 못 만들면 ai 랜딩 ?sso=none으로 보낸다(자동 재로그인 방지)', async () => {
            getSpy.mockReturnValue({ value: 'tok' });
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockIssueLogoutCode.mockRejectedValue(new Error('redis down'));
            mockLogout.mockResolvedValue({
                ok: true,
                sessionInvalidated: true,
                cookie: EXPIRED_COOKIE,
            });
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
            expect(mockRedirect).toHaveBeenCalledWith(
                'https://ai.siglens.io/?sso=none'
            );
            errorSpy.mockRestore();
        });

        it('세션 쿠키가 없으면 코드 없이 ai 랜딩 ?sso=none으로 보낸다', async () => {
            getSpy.mockReturnValue(undefined);

            await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
            expect(mockGetCurrentUser).not.toHaveBeenCalled();
            expect(mockIssueLogoutCode).not.toHaveBeenCalled();
            expect(mockRedirect).toHaveBeenCalledWith(
                'https://ai.siglens.io/?sso=none'
            );
        });

        it('예상치 못한 오류도 ai 랜딩 ?sso=none으로 폴백한다', async () => {
            getSpy.mockReturnValue({ value: 'tok' });
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockLogout.mockRejectedValue(new Error('DB connection lost'));
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
            expect(mockRedirect).toHaveBeenLastCalledWith(
                'https://ai.siglens.io/?sso=none'
            );
            errorSpy.mockRestore();
        });
    });
});
