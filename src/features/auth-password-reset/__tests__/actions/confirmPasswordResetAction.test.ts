jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@/shared/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: jest.fn(),
}));
jest.mock('@/entities/session', () => ({
    bcryptPasswordHasher: { hashPassword: jest.fn() },
    bcryptPasswordVerifier: { verifyPassword: jest.fn() },
    getAuthDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
    AUTH_SERVICE_UNAVAILABLE_MESSAGE:
        '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}));
jest.mock('@/entities/user', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    confirmPasswordReset: jest.fn(),
}));
jest.mock('@/entities/email-token', () => ({
    createEmailTokenStore: jest.fn(),
}));

import { confirmPasswordReset } from '@/entities/user';
import { createEmailTokenStore } from '@/entities/email-token';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/session';
import { confirmPasswordResetAction } from '@/features/auth-password-reset/actions/confirmPasswordResetAction';
import { resetAuthDatabaseClientForTests } from '@/entities/session/lib/db';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockConfirm = confirmPasswordReset as jest.MockedFunction<
    typeof confirmPasswordReset
>;
const mockCreateTokenStore = createEmailTokenStore as jest.MockedFunction<
    typeof createEmailTokenStore
>;

describe('confirmPasswordResetAction', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        mockConfirm.mockReset();
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            consume: jest.fn(),
        });
    });

    describe('Redis 미설정', () => {
        it('createEmailTokenStore가 null이면 redis_unavailable 에러를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await confirmPasswordResetAction(
                { error: null },
                makeFormData({
                    email: 'user@example.com',
                    token: 'tok',
                    newPassword: 'NewPass1234',
                })
            );
            expect(result.error?.code).toBe('redis_unavailable');
            expect(result.error?.message).toBe(
                AUTH_SERVICE_UNAVAILABLE_MESSAGE
            );
            expect(mockConfirm).not.toHaveBeenCalled();
        });
    });

    describe('실패 케이스', () => {
        it('invalid_token 에러를 폼 상태로 반환한다', async () => {
            mockConfirm.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_token',
                    field: 'token',
                    message: 'invalid',
                },
            });
            const result = await confirmPasswordResetAction(
                { error: null },
                makeFormData({
                    email: 'user@example.com',
                    token: 'bad',
                    newPassword: 'Pass1234',
                })
            );
            expect(result.error?.code).toBe('invalid_token');
            expect(result.error?.field).toBe('token');
        });

        it('weak_password 에러는 field: password를 보존한다', async () => {
            mockConfirm.mockResolvedValue({
                ok: false,
                error: {
                    code: 'weak_password',
                    field: 'password',
                    message: 'too weak',
                },
            });
            const result = await confirmPasswordResetAction(
                { error: null },
                makeFormData({
                    email: 'user@example.com',
                    token: 'tok',
                    newPassword: '123',
                })
            );
            expect(result.error?.code).toBe('weak_password');
            expect(result.error?.field).toBe('password');
        });

        it('field가 없는 expired_token 에러도 그대로 보존한다', async () => {
            mockConfirm.mockResolvedValue({
                ok: false,
                error: {
                    code: 'expired_token',
                    message: 'expired',
                },
            });
            const result = await confirmPasswordResetAction(
                { error: null },
                makeFormData({
                    email: 'user@example.com',
                    token: 'expired',
                    newPassword: 'Pass1234',
                })
            );
            expect(result.error?.code).toBe('expired_token');
            expect(result.error?.field).toBeUndefined();
        });

        it('invalid_email 에러도 그대로 반환한다', async () => {
            mockConfirm.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_email',
                    field: 'email',
                    message: 'invalid email',
                },
            });
            const result = await confirmPasswordResetAction(
                { error: null },
                makeFormData({
                    email: 'wrong@example.com',
                    token: 'tok',
                    newPassword: 'Pass1234',
                })
            );
            expect(result.error?.code).toBe('invalid_email');
        });
    });

    describe('성공 케이스', () => {
        it('성공 시 /login?password_reset=1로 redirect한다', async () => {
            mockConfirm.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({
                        email: 'user@example.com',
                        token: 'tok',
                        newPassword: 'NewPass1234',
                    })
                )
            ).rejects.toThrow('NEXT_REDIRECT:/login?password_reset=1');
        });

        it('성공 시 코어에 email/token/newPassword를 그대로 전달한다', async () => {
            mockConfirm.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({
                        email: '  USER@example.com  ',
                        token: 'tok-x',
                        newPassword: 'NewPass1234',
                    })
                )
            ).rejects.toThrow();
            expect(mockConfirm).toHaveBeenCalledWith(
                {
                    email: 'user@example.com',
                    token: 'tok-x',
                    newPassword: 'NewPass1234',
                },
                expect.objectContaining({
                    emailAuthUsers: expect.any(Object),
                    users: expect.any(Object),
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    passwordHasher: expect.any(Object),
                })
            );
        });
    });

    describe('입력 누락', () => {
        it('email 키가 없으면 빈 문자열로 호출한다', async () => {
            mockConfirm.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({ token: 'tok', newPassword: 'NewPass1234' })
                )
            ).rejects.toThrow();
            expect(mockConfirm).toHaveBeenCalledWith(
                { email: '', token: 'tok', newPassword: 'NewPass1234' },
                expect.objectContaining({
                    emailAuthUsers: expect.any(Object),
                    users: expect.any(Object),
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    passwordHasher: expect.any(Object),
                })
            );
        });

        it('token 키가 없으면 빈 문자열로 호출한다', async () => {
            mockConfirm.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({
                        email: 'u@u.com',
                        newPassword: 'NewPass1234',
                    })
                )
            ).rejects.toThrow();
            expect(mockConfirm).toHaveBeenCalledWith(
                { email: 'u@u.com', token: '', newPassword: 'NewPass1234' },
                expect.objectContaining({
                    emailAuthUsers: expect.any(Object),
                    users: expect.any(Object),
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    passwordHasher: expect.any(Object),
                })
            );
        });

        it('newPassword 키가 없으면 빈 문자열로 호출한다', async () => {
            mockConfirm.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({ email: 'u@u.com', token: 'tok' })
                )
            ).rejects.toThrow();
            expect(mockConfirm).toHaveBeenCalledWith(
                { email: 'u@u.com', token: 'tok', newPassword: '' },
                expect.objectContaining({
                    emailAuthUsers: expect.any(Object),
                    users: expect.any(Object),
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    passwordHasher: expect.any(Object),
                })
            );
        });
    });
});
