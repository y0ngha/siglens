import type { MockedFunction, MockedClass, Mock } from 'vitest';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({
        db: {},
        sql: () => null,
    })),
    resetDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/auth', () => ({
    applyAuthCookie: vi.fn((c: unknown) => c),
    createAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: 'true',
    })),
    AUTH_SERVICE_UNAVAILABLE_MESSAGE:
        '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    CONSENT_REQUIRED_MESSAGE: '서비스 이용을 위해 필수 약관에 동의해 주세요.',
    DEFAULT_SESSION_TTL_SECONDS: 7776000,
    isSecureCookieEnv: vi.fn(() => false),
    loginUser: vi.fn(),
    registerUser: vi.fn(),
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
    bcryptPasswordHasher: { hashPassword: vi.fn() },
    bcryptPasswordVerifier: { verifyPassword: vi.fn() },
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetAuthDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/agreement', () => ({
    DrizzleAgreementRepository: vi.fn(),
}));
vi.mock('@/entities/terms', () => ({
    DrizzleTermsRepository: vi.fn(),
}));
vi.mock('@/entities/email-token', () => ({
    createEmailTokenStore: vi.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    loginUser,
    registerUser,
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
} from '@/entities/auth';
import { createEmailTokenStore } from '@/entities/email-token';
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { DrizzleTermsRepository } from '@/entities/terms';
import { registerAction } from '@/features/auth-signup/actions/registerAction';
import {
    getAuthDatabaseClient,
    resetAuthDatabaseClientForTests,
} from '@/entities/auth/lib/db';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockRegister = registerUser as MockedFunction<typeof registerUser>;
const mockLogin = loginUser as MockedFunction<typeof loginUser>;
const mockCreateTokenStore = createEmailTokenStore as MockedFunction<
    typeof createEmailTokenStore
>;
const mockRedirect = redirect as MockedFunction<typeof redirect>;
const mockGetAuthDatabaseClient = getAuthDatabaseClient as MockedFunction<
    typeof getAuthDatabaseClient
>;
const MockTermsRepository = DrizzleTermsRepository as MockedClass<
    typeof DrizzleTermsRepository
>;

const FAKE_USER = {
    id: 'u1',
    email: 'a@b.com',
    name: null,
    avatarUrl: null,
    tier: 'member' as const,
    emailVerified: true,
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

const FAKE_PRIVACY_TERMS = {
    id: 'terms-privacy-id',
    kind: 'privacy' as const,
    version: 1,
    effectiveDate: new Date('2026-04-30'),
    body: '',
};

const FAKE_TOS_TERMS = {
    id: 'terms-tos-id',
    kind: 'tos' as const,
    version: 1,
    effectiveDate: new Date('2026-04-30'),
    body: '',
};

/** Helper that always includes consent fields by default. */
function makeConsentFormData(overrides: Record<string, string> = {}): FormData {
    return makeFormData({
        email: 'a@b.com',
        password: 'Pass1234',
        agreed_privacy: 'true',
        agreed_tos: 'true',
        ...overrides,
    });
}

describe('registerAction', () => {
    let setSpy: Mock;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        setSpy = vi.fn();
        mockCookies.mockResolvedValue({
            set: setSpy,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        mockRegister.mockReset();
        mockLogin.mockReset();
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            consume: vi.fn(),
        });
        mockRedirect.mockClear();
        // Default: active terms exist for both kinds
        MockTermsRepository.mockImplementation(function () {
            return {
                findActive: vi.fn().mockImplementation((kind: string) => {
                    if (kind === 'privacy')
                        return Promise.resolve(FAKE_PRIVACY_TERMS);
                    if (kind === 'tos') return Promise.resolve(FAKE_TOS_TERMS);
                    return Promise.resolve(null);
                }),
                upsertFromSeed: vi.fn(),
            } as unknown as InstanceType<typeof DrizzleTermsRepository>;
        });
    });

    describe('동의 검증', () => {
        it('agreed_privacy가 false이면 consent_required를 반환한다', async () => {
            const result = await registerAction(
                { error: null },
                makeConsentFormData({ agreed_privacy: 'false' })
            );
            expect(result.error?.code).toBe('consent_required');
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('agreed_tos가 누락되면 consent_required를 반환한다', async () => {
            const fd = makeConsentFormData();
            fd.delete('agreed_tos');
            const result = await registerAction({ error: null }, fd);
            expect(result.error?.code).toBe('consent_required');
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('두 항목 모두 미동의이면 consent_required를 반환한다', async () => {
            const result = await registerAction(
                { error: null },
                makeFormData({ email: 'a@b.com', password: 'Pass1234' })
            );
            expect(result.error?.code).toBe('consent_required');
        });
    });

    describe('약관 DB 조회', () => {
        it('활성 약관이 없으면 service_unavailable을 반환한다', async () => {
            MockTermsRepository.mockImplementation(function () {
                return {
                    findActive: vi.fn().mockResolvedValue(null),
                    upsertFromSeed: vi.fn(),
                } as unknown as InstanceType<typeof DrizzleTermsRepository>;
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('service_unavailable');
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('privacyTerms만 없으면 service_unavailable을 반환한다', async () => {
            MockTermsRepository.mockImplementation(function () {
                return {
                    findActive: vi
                        .fn()
                        .mockImplementation((kind: string) =>
                            kind === 'privacy'
                                ? Promise.resolve(null)
                                : Promise.resolve(FAKE_TOS_TERMS)
                        ),
                    upsertFromSeed: vi.fn(),
                } as unknown as InstanceType<typeof DrizzleTermsRepository>;
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('service_unavailable');
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('tosTerms만 없으면 service_unavailable을 반환한다', async () => {
            MockTermsRepository.mockImplementation(function () {
                return {
                    findActive: vi
                        .fn()
                        .mockImplementation((kind: string) =>
                            kind === 'tos'
                                ? Promise.resolve(null)
                                : Promise.resolve(FAKE_PRIVACY_TERMS)
                        ),
                    upsertFromSeed: vi.fn(),
                } as unknown as InstanceType<typeof DrizzleTermsRepository>;
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('service_unavailable');
            expect(mockRegister).not.toHaveBeenCalled();
        });
    });

    describe('Redis 미설정', () => {
        it('createEmailTokenStore가 null을 반환하면 안내 에러를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('redis_unavailable');
            expect(result.error?.message).toBe(
                AUTH_SERVICE_UNAVAILABLE_MESSAGE
            );
            expect(mockRegister).not.toHaveBeenCalled();
        });
    });

    describe('입력 정규화', () => {
        it('email 키가 없으면 빈 문자열로 처리한다', async () => {
            mockRegister.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_email',
                    field: 'email' as const,
                    message: 'Email format is invalid',
                },
            });
            await registerAction(
                { error: null },
                makeConsentFormData({ email: '' })
            );
            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({ email: '', password: 'Pass1234' }),
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    agreements: expect.any(DrizzleAgreementRepository),
                })
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
                makeConsentFormData({
                    email: '  a@b.com  ',
                    password: '  Pass1234  ',
                })
            );
            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'a@b.com',
                    password: '  Pass1234  ',
                }),
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    agreements: expect.any(DrizzleAgreementRepository),
                })
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
                    makeConsentFormData({ name: '   ' })
                )
            ).rejects.toThrow('NEXT_REDIRECT:/');
            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({ name: undefined }),
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    agreements: expect.any(DrizzleAgreementRepository),
                })
            );
        });
    });

    describe('약관 ID 전달', () => {
        it('agreedTermsIds로 활성 약관 ID 두 개를 전달한다', async () => {
            mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
            mockLogin.mockResolvedValue({
                ok: true,
                user: FAKE_USER,
                session: { id: 's1' } as never,
                cookie: FAKE_COOKIE,
            });
            await expect(
                registerAction({ error: null }, makeConsentFormData())
            ).rejects.toThrow('NEXT_REDIRECT');
            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({
                    agreedTermsIds: ['terms-privacy-id', 'terms-tos-id'],
                }),
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    agreements: expect.any(DrizzleAgreementRepository),
                })
            );
        });
    });

    describe('실패 케이스', () => {
        it('회원가입 검증 실패(weak_password) 시 폼 상태로 에러를 반환한다', async () => {
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
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('weak_password');
            expect(result.error?.field).toBe('password');
            expect(mockLogin).not.toHaveBeenCalled();
            expect(setSpy).not.toHaveBeenCalled();
        });

        it('email_already_exists 에러는 field: email로 보존되어 폼 상태로 반환된다', async () => {
            mockRegister.mockResolvedValue({
                ok: false,
                error: {
                    code: 'email_already_exists',
                    field: 'email',
                    message: '이미 가입된 이메일입니다',
                },
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('email_already_exists');
            expect(result.error?.field).toBe('email');
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('email_not_verified 에러도 폼 상태로 그대로 반환한다', async () => {
            mockRegister.mockResolvedValue({
                ok: false,
                error: {
                    code: 'email_not_verified',
                    field: 'email',
                    message: 'Email is not verified',
                },
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('email_not_verified');
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('예상치 못한 내부 에러 발생 시 service_unavailable을 반환한다', async () => {
            mockGetAuthDatabaseClient.mockImplementationOnce(() => {
                throw new Error('Unexpected db error');
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('service_unavailable');
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('회원가입 성공 후 자동 로그인이 실패하면 auto_login_failed 에러를 반환한다', async () => {
            mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
            mockLogin.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_credentials',
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                },
            });
            const result = await registerAction(
                { error: null },
                makeConsentFormData()
            );
            expect(result.error?.code).toBe('auto_login_failed');
            expect(setSpy).not.toHaveBeenCalled();
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('성공 케이스', () => {
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
                    makeConsentFormData({ name: '  Holly  ', next: '/market' })
                )
            ).rejects.toThrow('NEXT_REDIRECT:/market');
            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Holly' }),
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    agreements: expect.any(DrizzleAgreementRepository),
                })
            );
            expect(setSpy).toHaveBeenCalledWith(
                expect.objectContaining({ value: 'tok' })
            );
        });

        it('redirect 제어 신호는 에러 로그로 기록하지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockRegister.mockResolvedValue({ ok: true, user: FAKE_USER });
            mockLogin.mockResolvedValue({
                ok: true,
                user: FAKE_USER,
                session: { id: 's1' } as never,
                cookie: FAKE_COOKIE,
            });

            await expect(
                registerAction({ error: null }, makeConsentFormData())
            ).rejects.toThrow('NEXT_REDIRECT:/');

            expect(errorSpy).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
