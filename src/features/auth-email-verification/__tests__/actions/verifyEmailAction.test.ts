vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/entities/email-token/api', () => ({
    createEmailTokenStore: vi.fn(),
}));
vi.mock('@/entities/auth/lib/errorMessages', () => ({
    AUTH_SERVICE_UNAVAILABLE_MESSAGE:
        '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}));
vi.mock('@/entities/auth/lib/verifyEmail', () => ({
    verifyEmail: vi.fn(),
}));
vi.mock('@/entities/auth/server/createAuthRateLimitGuards', () => ({
    createAuthRateLimitGuards: vi.fn(() => ({
        rateLimit: vi.fn(),
        resetCounter: vi.fn(),
        ipHash: vi.fn(),
    })),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(),
}));
// DrizzleUserRepository는 @/entities/auth/api에서 직접 import되므로
// 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn(),
}));

import type { MockedFunction, MockedClass } from 'vitest';

import { cookies } from 'next/headers';
import { verifyEmail } from '@/entities/auth/lib/verifyEmail';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/auth/lib/errorMessages';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { createEmailTokenStore } from '@/entities/email-token/api';
import { getDatabaseClient } from '@/shared/db/client';
import { verifyEmailAction } from '@/features/auth-email-verification/actions/verifyEmailAction';
import { makeFormData } from '@/shared/test-utils/makeFormData';
import {
    expectLogWithoutPlantedSecrets,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const BINDING_TOKEN = 'binding-token-nonce';
const mockCookieSet = vi.fn();
const mockVerify = verifyEmail as MockedFunction<typeof verifyEmail>;
const mockCreateTokenStore = createEmailTokenStore as MockedFunction<
    typeof createEmailTokenStore
>;
const mockGetDatabaseClient = getDatabaseClient as MockedFunction<
    typeof getDatabaseClient
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
    mockGetDatabaseClient.mockReturnValue({
        db: {} as never,
        sql: {} as never,
    });
    return { findByEmail };
}

describe('verifyEmailAction', () => {
    beforeEach(() => {
        mockVerify.mockReset();
        mockCookieSet.mockReset();
        mockCookies.mockResolvedValue({
            set: mockCookieSet,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockCreateTokenStore.mockReset();
        mockGetDatabaseClient.mockReset();
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
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
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

        it('verified: true 로 끝날 때만 바인딩 쿠키를 심는다(HttpOnly, Strict, 30분, 원문 값)', async () => {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
            mockUserRepo(null);
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({ email: 'user@example.com', code: '482917' })
            );
            expect(mockCookieSet).toHaveBeenCalledTimes(1);
            expect(mockCookieSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'siglens_signup_verify',
                    value: BINDING_TOKEN,
                    httpOnly: true,
                    sameSite: 'strict',
                    maxAge: 1800,
                    path: '/',
                })
            );
        });

        it('코어 ok=true이고 이메일이 이미 가입된 경우 email_already_exists 에러를 반환한다', async () => {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
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
            expect(mockCookieSet).not.toHaveBeenCalled();
        });

        it('코어가 실패를 돌려주면 쿠키를 심지 않는다', async () => {
            mockVerify.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_verification_code',
                    field: 'code',
                    message: 'x',
                },
            });
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({ email: 'user@example.com', code: '000000' })
            );
            expect(mockCookieSet).not.toHaveBeenCalled();
        });
    });

    describe('입력 정규화', () => {
        it('email/code 모두 trim하여 코어를 호출한다', async () => {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
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

    describe('한도 초과', () => {
        it.each([
            ['rate_limited', '요청 한도'],
            ['too_many_verification_attempts', '시도 한도'],
        ] as const)(
            '%s를 폼 상태로 그대로 돌려주고 계정을 조회하지 않는다',
            async (code, message) => {
                mockVerify.mockResolvedValue({
                    ok: false,
                    error: { code, field: 'code', message },
                });
                const { findByEmail } = mockUserRepo(null);
                const result = await verifyEmailAction(
                    { verified: false, error: null },
                    makeFormData({
                        email: 'user@example.com',
                        code: '482917',
                    })
                );
                expect(result).toEqual({
                    verified: false,
                    error: { code, message },
                });
                expect(findByEmail).not.toHaveBeenCalled();
            }
        );

        it('한도 가드를 코어 의존성에 펼쳐 넘긴다', async () => {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
            mockUserRepo(null);
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({ email: 'user@example.com', code: '482917' })
            );
            expect(mockVerify).toHaveBeenCalledWith(
                { email: 'user@example.com', code: '482917' },
                expect.objectContaining({
                    rateLimit: expect.any(Function),
                    ipHash: expect.any(Function),
                })
            );
        });
    });

    describe('입력 누락', () => {
        it('email/code 키가 없으면 빈 문자열로 호출한다', async () => {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
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

    it('DB 에러는 파라미터 없이 로그에 남긴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        try {
            mockVerify.mockResolvedValue({
                ok: true,
                bindingToken: BINDING_TOKEN,
            });
            mockUserRepo(null).findByEmail.mockRejectedValue(plantedDbError());
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({ email: 'user@example.com', code: '482917' })
            );
            expect(result.error?.code).toBe('unexpected');
            // 계정 확인이 실패하면 인증 쿠키를 내리지 않는다
            expect(mockCookieSet).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith(
                '[verifyEmailAction] unexpected error:',
                'Error code=57014'
            );
            expectLogWithoutPlantedSecrets(errorSpy);
        } finally {
            errorSpy.mockRestore();
        }
    });
});
