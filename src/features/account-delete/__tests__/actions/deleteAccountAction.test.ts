import type { MockedFunction, Mock } from 'vitest';
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
vi.mock('@/entities/user', () => ({
    DrizzleUserRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    deleteAccount: vi.fn(),
}));
vi.mock('@/entities/session', () => ({
    applyAuthCookie: vi.fn((c: unknown) => c),
    isSecureCookieEnv: vi.fn(() => false),
    createExpiredAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: '',
    })),
}));
vi.mock('@/entities/session/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/session/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/session/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetAuthDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/oauth-account', () => ({
    DrizzleOAuthAccountRepository: vi.fn().mockImplementation(function () {
        return { findByUserId: vi.fn() };
    }),
    compositeOAuthRevoker: { revokeToken: vi.fn() },
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { deleteAccount } from '@/entities/user';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { deleteAccountAction } from '@/features/account-delete/actions/deleteAccountAction';
import { resetAuthDatabaseClientForTests } from '@/entities/session/lib/db';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockDelete = deleteAccount as MockedFunction<typeof deleteAccount>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;

const USER = {
    id: 'u1',
    email: 'user@example.com',
    name: null,
    avatarUrl: null,
    tier: 'free' as const,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('deleteAccountAction', () => {
    let setSpy: Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        setSpy = vi.fn();
        mockCookies.mockResolvedValue({
            set: setSpy,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockDelete.mockReset();
        mockGetCurrentUser.mockReset();
        mockRedirect.mockClear();
    });

    const expiredCookie = {
        name: 'siglens_session',
        value: '',
        httpOnly: true as const,
        secure: false,
        sameSite: 'lax' as const,
        path: '/',
        expires: new Date(0),
        maxAgeSeconds: 0,
    };

    describe('인증 실패 (not_authenticated)', () => {
        it('getCurrentUser가 null을 반환하면 not_authenticated 에러를 반환한다', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            const result = await deleteAccountAction(
                { error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.error?.code).toBe('not_authenticated');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    describe('이메일 검증 (email_mismatch)', () => {
        beforeEach(() => {
            mockGetCurrentUser.mockResolvedValue(USER);
        });

        it('입력 이메일이 사용자 이메일과 일치하지 않으면 email_mismatch 에러를 반환한다', async () => {
            const result = await deleteAccountAction(
                { error: null },
                makeFormData({ email: 'other@example.com' })
            );
            expect(result.error?.code).toBe('email_mismatch');
            expect(mockDelete).not.toHaveBeenCalled();
        });

        it('formData에 email 키가 없으면 빈 문자열로 비교하여 email_mismatch 에러를 반환한다', async () => {
            const result = await deleteAccountAction(
                { error: null },
                makeFormData({})
            );
            expect(result.error?.code).toBe('email_mismatch');
        });
    });

    describe('이메일 정규화', () => {
        beforeEach(() => {
            mockGetCurrentUser.mockResolvedValue(USER);
        });

        it('이메일 비교는 대소문자/공백을 무시한다', async () => {
            mockDelete.mockResolvedValue({ ok: true, cookie: expiredCookie });
            await expect(
                deleteAccountAction(
                    { error: null },
                    makeFormData({ email: '  USER@Example.COM  ' })
                )
            ).rejects.toThrow('NEXT_REDIRECT:/?account_deleted=1');
            expect(mockDelete).toHaveBeenCalledWith(
                { userId: 'u1' },
                expect.objectContaining({
                    oauthAccounts: expect.objectContaining({
                        findByUserId: expect.any(Function),
                    }),
                    oauthRevoker: expect.objectContaining({
                        revokeToken: expect.any(Function),
                    }),
                }),
                expect.objectContaining({ secureCookie: false })
            );
        });
    });

    describe('deleteAccount 호출 결과 처리', () => {
        beforeEach(() => {
            mockGetCurrentUser.mockResolvedValue(USER);
        });

        it('실패 시 폼 상태로 에러를 반환하고 쿠키를 set하지 않는다', async () => {
            mockDelete.mockResolvedValue({
                ok: false,
                error: { code: 'user_not_found', message: 'not found' },
            });
            const result = await deleteAccountAction(
                { error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.error?.code).toBe('user_not_found');
            expect(setSpy).not.toHaveBeenCalled();
            expect(mockRedirect).not.toHaveBeenCalled();
        });

        it('성공 시 만료 쿠키를 set하고 /?account_deleted=1로 redirect한다', async () => {
            mockDelete.mockResolvedValue({ ok: true, cookie: expiredCookie });
            await expect(
                deleteAccountAction(
                    { error: null },
                    makeFormData({ email: 'user@example.com' })
                )
            ).rejects.toThrow('NEXT_REDIRECT:/?account_deleted=1');
            expect(mockDelete).toHaveBeenCalledWith(
                { userId: 'u1' },
                expect.objectContaining({
                    oauthAccounts: expect.objectContaining({
                        findByUserId: expect.any(Function),
                    }),
                    oauthRevoker: expect.objectContaining({
                        revokeToken: expect.any(Function),
                    }),
                }),
                expect.any(Object)
            );
            expect(setSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'siglens_session',
                    maxAgeSeconds: 0,
                })
            );
        });
    });
});
