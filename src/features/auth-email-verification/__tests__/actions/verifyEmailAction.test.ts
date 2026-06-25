import type { MockedFunction, MockedClass } from 'vitest';
vi.mock('@/entities/email-token', () => ({
    createEmailTokenStore: vi.fn(),
}));
vi.mock('@/entities/auth', () => ({
    AUTH_SERVICE_UNAVAILABLE_MESSAGE:
        '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    verifyEmail: vi.fn(),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(),
}));
// DrizzleUserRepository는 barrel이 아닌 @/entities/auth/api에서 직접 import되므로
// 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn(),
}));

import { verifyEmail } from '@/entities/auth';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { createEmailTokenStore } from '@/entities/email-token';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/auth';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { verifyEmailAction } from '@/features/auth-email-verification/actions/verifyEmailAction';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockVerify = verifyEmail as MockedFunction<typeof verifyEmail>;
const mockCreateTokenStore = createEmailTokenStore as MockedFunction<
    typeof createEmailTokenStore
>;
const mockGetAuthDatabaseClient = getAuthDatabaseClient as MockedFunction<
    typeof getAuthDatabaseClient
>;
const MockDrizzleUserRepository = DrizzleUserRepository as MockedClass<
    typeof DrizzleUserRepository
>;

function mockUserRepo(existingUser: object | null) {
    const findByEmail = vi.fn().mockResolvedValue(existingUser);
    MockDrizzleUserRepository.mockImplementation(function () {
        return { findByEmail } as unknown as InstanceType<
            typeof DrizzleUserRepository
        >;
    });
    mockGetAuthDatabaseClient.mockReturnValue({
        db: {} as never,
        sql: {} as never,
    });
    return { findByEmail };
}

describe('verifyEmailAction', () => {
    beforeEach(() => {
        mockVerify.mockReset();
        mockCreateTokenStore.mockReset();
        mockGetAuthDatabaseClient.mockReset();
        MockDrizzleUserRepository.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            consume: vi.fn(),
        });
    });

    describe('Redis 미설정', () => {
        it('createEmailTokenStore가 null이면 redis_unavailable 에러를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('redis_unavailable');
            expect(result.error?.message).toBe(
                AUTH_SERVICE_UNAVAILABLE_MESSAGE
            );
            expect(mockVerify).not.toHaveBeenCalled();
        });
    });

    describe('성공', () => {
        it('코어 ok=true이고 이메일이 미가입 상태이면 verified: true 와 error: null 을 반환한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            mockUserRepo(null);
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.verified).toBe(true);
            expect(result.error).toBeNull();
        });

        it('코어 ok=true이고 이메일이 이미 가입된 경우 email_already_exists 에러를 반환한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            mockUserRepo({ id: 'some-id', email: 'user@example.com' });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('email_already_exists');
        });
    });

    describe('입력 정규화', () => {
        it('email/code 모두 trim하여 코어를 호출한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            mockUserRepo(null);
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: '  user@example.com  ',
                    code: '  482917  ',
                })
            );
            expect(mockVerify).toHaveBeenCalledWith(
                { email: 'user@example.com', code: '482917' },
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                })
            );
        });
    });

    describe('실패', () => {
        it('invalid_verification_code 에러를 그대로 반환한다', async () => {
            mockVerify.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_verification_code',
                    field: 'code',
                    message: '잘못된 코드',
                },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: 'wrong',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('invalid_verification_code');
        });

        it('expired_verification_code 에러를 그대로 반환한다', async () => {
            mockVerify.mockResolvedValue({
                ok: false,
                error: {
                    code: 'expired_verification_code',
                    field: 'code',
                    message: '만료된 코드',
                },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.error?.code).toBe('expired_verification_code');
        });
    });

    describe('입력 누락', () => {
        it('email/code 키가 없으면 빈 문자열로 호출한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            mockUserRepo(null);
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({})
            );
            expect(mockVerify).toHaveBeenCalledWith(
                { email: '', code: '' },
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                })
            );
        });
    });
});
