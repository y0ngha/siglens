jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: jest.fn(),
}));
jest.mock('@/infrastructure/db/sessionRepository', () => ({
    DrizzleSessionRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/infrastructure/db/userRepository', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/infrastructure/db/agreementRepository', () => ({
    DrizzleAgreementRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/infrastructure/db/termsRepository', () => ({
    DrizzleTermsRepository: jest.fn(),
}));
jest.mock('@/infrastructure/auth/bcrypt', () => ({
    bcryptPasswordHasher: { hashPassword: jest.fn() },
    bcryptPasswordVerifier: { verifyPassword: jest.fn() },
}));
jest.mock('@/infrastructure/auth/use-cases/loginUser', () => ({
    loginUser: jest.fn(),
}));
jest.mock('@/infrastructure/auth/use-cases/registerUser', () => ({
    registerUser: jest.fn(),
}));
jest.mock('@/infrastructure/email/tokenStore', () => ({
    createEmailTokenStore: jest.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginUser } from '@/infrastructure/auth/use-cases/loginUser';
import { registerUser } from '@/infrastructure/auth/use-cases/registerUser';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { registerAction } from '@/infrastructure/auth/registerAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockRegister = registerUser as jest.MockedFunction<typeof registerUser>;
const mockLogin = loginUser as jest.MockedFunction<typeof loginUser>;
const mockCreateTokenStore = createEmailTokenStore as jest.MockedFunction<
    typeof createEmailTokenStore
>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
const MockTermsRepository = DrizzleTermsRepository as jest.MockedClass<
    typeof DrizzleTermsRepository
>;

const FAKE_USER = {
    id: 'u1',
    email: 'a@b.com',
    name: null,
    avatarUrl: null,
    tier: 'free' as const,
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
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            consume: jest.fn(),
        });
        mockRedirect.mockClear();
        // Default: active terms exist for both kinds
        MockTermsRepository.mockImplementation(
            () =>
                ({
                    findActive: jest.fn().mockImplementation((kind: string) => {
                        if (kind === 'privacy')
                            return Promise.resolve(FAKE_PRIVACY_TERMS);
                        if (kind === 'tos')
                            return Promise.resolve(FAKE_TOS_TERMS);
                        return Promise.resolve(null);
                    }),
                    upsertFromSeed: jest.fn(),
                }) as unknown as InstanceType<typeof DrizzleTermsRepository>
        );
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
            MockTermsRepository.mockImplementation(
                () =>
                    ({
                        findActive: jest.fn().mockResolvedValue(null),
                        upsertFromSeed: jest.fn(),
                    }) as unknown as InstanceType<typeof DrizzleTermsRepository>
            );
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
                expect.anything()
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
                expect.anything()
            );
        });

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
                expect.anything()
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
                expect.anything()
            );
            expect(setSpy).toHaveBeenCalledWith(
                expect.objectContaining({ value: 'tok' })
            );
        });
    });
});
