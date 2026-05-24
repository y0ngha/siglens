jest.mock('@/entities/user/lib/verifyEmail', () => ({
    verifyEmail: jest.fn(),
}));
jest.mock('@/entities/email-token', () => ({
    createEmailTokenStore: jest.fn(),
}));
jest.mock('@/entities/session/lib/db', () => ({
    getAuthDatabaseClient: jest.fn(),
}));
jest.mock('@/entities/user', () => ({
    DrizzleUserRepository: jest.fn(),
}));

import { verifyEmail } from '@/entities/user/lib/verifyEmail';
import { createEmailTokenStore } from '@/entities/email-token';
import { getAuthDatabaseClient } from '@/entities/session/lib/db';
import { DrizzleUserRepository } from '@/entities/user';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/session/lib/errorMessages';
import { verifyEmailAction } from '@/features/auth-email-verification/actions/verifyEmailAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockVerify = verifyEmail as jest.MockedFunction<typeof verifyEmail>;
const mockCreateTokenStore = createEmailTokenStore as jest.MockedFunction<
    typeof createEmailTokenStore
>;
const mockGetAuthDatabaseClient = getAuthDatabaseClient as jest.MockedFunction<
    typeof getAuthDatabaseClient
>;
const MockDrizzleUserRepository = DrizzleUserRepository as jest.MockedClass<
    typeof DrizzleUserRepository
>;

function mockUserRepo(existingUser: object | null) {
    const findByEmail = jest.fn().mockResolvedValue(existingUser);
    MockDrizzleUserRepository.mockImplementation(
        () =>
            ({ findByEmail }) as unknown as InstanceType<
                typeof DrizzleUserRepository
            >
    );
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
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            consume: jest.fn(),
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
