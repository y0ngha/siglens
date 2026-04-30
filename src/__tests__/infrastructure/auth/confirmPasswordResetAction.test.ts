jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@y0ngha/siglens-core', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    bcryptPasswordHasher: { hashPassword: jest.fn() },
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

const confirmPasswordResetV2Mock = jest.fn();
const createEmailTokenStoreMock = jest.fn(() => ({}));
jest.mock('@/domain/auth/coreStubs', () => ({
    confirmPasswordResetV2: confirmPasswordResetV2Mock,
    createEmailTokenStore: createEmailTokenStoreMock,
}));

import { confirmPasswordResetAction } from '@/infrastructure/auth/confirmPasswordResetAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

describe('confirmPasswordResetAction', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        confirmPasswordResetV2Mock.mockReset();
    });

    describe('실패 케이스', () => {
        it('invalid_token 에러를 폼 상태로 반환한다', async () => {
            confirmPasswordResetV2Mock.mockResolvedValue({
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
            confirmPasswordResetV2Mock.mockResolvedValue({
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
            confirmPasswordResetV2Mock.mockResolvedValue({
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
    });

    describe('성공 케이스', () => {
        it('성공 시 /login?password_reset=1로 redirect한다', async () => {
            confirmPasswordResetV2Mock.mockResolvedValue({ ok: true });
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
            confirmPasswordResetV2Mock.mockResolvedValue({ ok: true });
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
            expect(confirmPasswordResetV2Mock).toHaveBeenCalledWith(
                {
                    email: 'USER@example.com',
                    token: 'tok-x',
                    newPassword: 'NewPass1234',
                },
                expect.any(Object)
            );
        });
    });

    describe('입력 누락', () => {
        it('email 키가 없으면 빈 문자열로 호출한다', async () => {
            confirmPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({ token: 'tok', newPassword: 'NewPass1234' })
                )
            ).rejects.toThrow();
            expect(confirmPasswordResetV2Mock).toHaveBeenCalledWith(
                { email: '', token: 'tok', newPassword: 'NewPass1234' },
                expect.any(Object)
            );
        });

        it('token 키가 없으면 빈 문자열로 호출한다', async () => {
            confirmPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({
                        email: 'u@u.com',
                        newPassword: 'NewPass1234',
                    })
                )
            ).rejects.toThrow();
            expect(confirmPasswordResetV2Mock).toHaveBeenCalledWith(
                { email: 'u@u.com', token: '', newPassword: 'NewPass1234' },
                expect.any(Object)
            );
        });

        it('newPassword 키가 없으면 빈 문자열로 호출한다', async () => {
            confirmPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await expect(
                confirmPasswordResetAction(
                    { error: null },
                    makeFormData({ email: 'u@u.com', token: 'tok' })
                )
            ).rejects.toThrow();
            expect(confirmPasswordResetV2Mock).toHaveBeenCalledWith(
                { email: 'u@u.com', token: 'tok', newPassword: '' },
                expect.any(Object)
            );
        });
    });
});
