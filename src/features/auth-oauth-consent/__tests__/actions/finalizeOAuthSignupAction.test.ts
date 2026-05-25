import type { MockedClass, Mock } from 'vitest';
vi.mock('@/entities/oauth-account', () => ({
    DrizzleOAuthAccountRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    compositeOAuthRevoker: { revokeToken: vi.fn() },
    createPendingOAuthSignupStore: vi.fn(),
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));
vi.mock('@/entities/terms');
vi.mock('@/entities/user');
vi.mock('@/entities/agreement');
vi.mock('@/entities/session', () => ({
    applyAuthCookie: vi.fn((c: unknown) => c),
    createAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: 'true',
    })),
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    CONSENT_REQUIRED_MESSAGE: '서비스 이용을 위해 필수 약관에 동의해 주세요.',
    OAUTH_ERROR_REDIRECT: {
        consentInvalid: '/login?error=oauth_consent_invalid',
        consentExpired: '/login?error=oauth_consent_expired',
        serviceUnavailable: '/login?error=service_unavailable',
        emailConflict: '/login?error=oauth_email_conflict',
    },
    createAuthSession: vi.fn(),
    DEFAULT_SESSION_TTL_SECONDS: 7776000,
    isSecureCookieEnv: vi.fn(() => false),
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));
vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn((p: unknown) => (typeof p === 'string' ? p : '/')),
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

import { finalizeOAuthSignupAction } from '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import { DrizzleTermsRepository } from '@/entities/terms';
import { DrizzleUserRepository } from '@/entities/user';
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { getAuthDatabaseClient, createAuthSession } from '@/entities/session';
import { cookies } from 'next/headers';

const mockRedirect = redirect as unknown as Mock;
const mockCreateStore = createPendingOAuthSignupStoreFromEnv as unknown as Mock;
const MockTermsRepo = DrizzleTermsRepository as MockedClass<
    typeof DrizzleTermsRepository
>;
const MockUserRepo = DrizzleUserRepository as MockedClass<
    typeof DrizzleUserRepository
>;
const MockAgreementRepo = DrizzleAgreementRepository as MockedClass<
    typeof DrizzleAgreementRepository
>;
const mockGetAuthDb = getAuthDatabaseClient as unknown as Mock;

const SAMPLE_PROFILE = {
    provider: 'google' as const,
    email: 'new@example.com',
    providerAccountId: 'gid_123',
    name: 'Hong Gildong',
    accessToken: 'at',
    next: '/',
    createdAt: new Date('2026-05-04T00:00:00Z').toISOString(),
};

const SAMPLE_TERMS_P = {
    id: 'terms-p',
    kind: 'privacy' as const,
    version: 1,
    body: '',
    effectiveDate: new Date(),
};
const SAMPLE_TERMS_T = {
    id: 'terms-t',
    kind: 'tos' as const,
    version: 1,
    body: '',
    effectiveDate: new Date(),
};

function buildFormData(over: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set('token', 'tok');
    fd.set('agreed_privacy', 'true');
    fd.set('agreed_tos', 'true');
    for (const [k, v] of Object.entries(over)) fd.set(k, v);
    return fd;
}

function setupMocks(
    options: {
        storeAvailable?: boolean;
        peekResult?: typeof SAMPLE_PROFILE | null;
        consumeResult?: typeof SAMPLE_PROFILE | null;
        privacyTerms?: typeof SAMPLE_TERMS_P | null;
        tosTerms?: typeof SAMPLE_TERMS_T | null;
        existingUser?: { id: string } | null;
        createOAuthUserResult?: { id: string } | null;
        insertManyThrows?: boolean;
    } = {}
): void {
    const {
        storeAvailable = true,
        peekResult = SAMPLE_PROFILE,
        consumeResult = SAMPLE_PROFILE,
        privacyTerms = SAMPLE_TERMS_P,
        tosTerms = SAMPLE_TERMS_T,
        existingUser = null,
        createOAuthUserResult = { id: 'new-user-id' },
        insertManyThrows = false,
    } = options;

    if (!storeAvailable) {
        mockCreateStore.mockReturnValue(null);
        return;
    }

    mockCreateStore.mockReturnValue({
        peek: vi.fn().mockResolvedValue(peekResult),
        consume: vi.fn().mockResolvedValue(consumeResult),
    });

    MockTermsRepo.mockImplementation(function () {
        return {
            findActive: vi
                .fn()
                .mockImplementation((kind: string) =>
                    Promise.resolve(
                        kind === 'privacy' ? privacyTerms : tosTerms
                    )
                ),
        } as unknown as InstanceType<typeof DrizzleTermsRepository>;
    });

    MockUserRepo.mockImplementation(function () {
        return {
            findByEmail: vi.fn().mockResolvedValue(existingUser),
            createOAuthUser: vi.fn().mockResolvedValue(createOAuthUserResult),
            deleteUser: vi.fn().mockResolvedValue(true),
        } as unknown as InstanceType<typeof DrizzleUserRepository>;
    });

    MockAgreementRepo.mockImplementation(function () {
        return {
            insertMany: insertManyThrows
                ? vi.fn().mockRejectedValue(new Error('db error'))
                : vi.fn().mockResolvedValue(undefined),
        } as unknown as InstanceType<typeof DrizzleAgreementRepository>;
    });

    mockGetAuthDb.mockReturnValue({ db: {} });
}

async function expectRedirectTo(
    url: string,
    fd: FormData = buildFormData()
): Promise<void> {
    await expect(finalizeOAuthSignupAction({}, fd)).rejects.toThrow(
        'NEXT_REDIRECT'
    );
    expect(mockRedirect).toHaveBeenCalledWith(url);
}

describe('finalizeOAuthSignupAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns consent_required when agreed_privacy is false', async () => {
        const result = await finalizeOAuthSignupAction(
            {},
            buildFormData({ agreed_privacy: 'false' })
        );
        expect(result.error?.code).toBe('consent_required');
    });

    it('returns consent_required when agreed_tos is false', async () => {
        const result = await finalizeOAuthSignupAction(
            {},
            buildFormData({ agreed_tos: 'false' })
        );
        expect(result.error?.code).toBe('consent_required');
    });

    it('redirects to oauth_consent_invalid when token is empty', async () => {
        await expectRedirectTo(
            '/login?error=oauth_consent_invalid',
            buildFormData({ token: '' })
        );
    });

    it('redirects to service_unavailable when pending store is unavailable', async () => {
        setupMocks({ storeAvailable: false });
        await expectRedirectTo('/login?error=service_unavailable');
    });

    it('redirects to oauth_consent_expired when store.peek returns null', async () => {
        setupMocks({ peekResult: null });
        await expectRedirectTo('/login?error=oauth_consent_expired');
    });

    it('redirects to service_unavailable when active privacy terms not found', async () => {
        setupMocks({ privacyTerms: null });
        await expectRedirectTo('/login?error=service_unavailable');
    });

    it('redirects to service_unavailable when active tos terms not found', async () => {
        setupMocks({ tosTerms: null });
        await expectRedirectTo('/login?error=service_unavailable');
    });

    it('redirects to oauth_consent_expired when consume returns null (race condition)', async () => {
        setupMocks({ consumeResult: null });
        await expectRedirectTo('/login?error=oauth_consent_expired');
    });

    it('redirects to oauth_email_conflict when email already exists after consume', async () => {
        setupMocks({ existingUser: { id: 'existing-id' } });
        await expectRedirectTo('/login?error=oauth_email_conflict');
    });

    it('redirects to service_unavailable when agreement insertion throws and compensates by deleting the user', async () => {
        setupMocks({ insertManyThrows: true });

        const deleteUser = vi.fn().mockResolvedValue(true);
        MockUserRepo.mockImplementation(function () {
            return {
                findByEmail: vi.fn().mockResolvedValue(null),
                createOAuthUser: vi
                    .fn()
                    .mockResolvedValue({ id: 'new-user-id' }),
                deleteUser,
            } as unknown as InstanceType<typeof DrizzleUserRepository>;
        });

        await expectRedirectTo('/login?error=service_unavailable');

        expect(deleteUser).toHaveBeenCalledWith('new-user-id');
    });

    it('redirects to oauth_email_conflict when createOAuthUser returns null (race condition)', async () => {
        setupMocks({ createOAuthUserResult: null });
        await expectRedirectTo('/login?error=oauth_email_conflict');
    });

    it('예상치 못한 내부 에러 발생 시 service_unavailable로 리다이렉트한다', async () => {
        mockCreateStore.mockImplementation(() => {
            throw new Error('Unexpected internal error');
        });
        await expectRedirectTo('/login?error=service_unavailable');
    });

    it('성공 시 세션 쿠키를 설정하고 next 경로로 리다이렉트', async () => {
        setupMocks();
        const mockCookieSet = vi.fn();
        (cookies as Mock).mockResolvedValue({ set: mockCookieSet });
        (createAuthSession as Mock).mockResolvedValue({
            cookie: { name: 'session', value: 'test-session' },
        });

        await expectRedirectTo('/');

        expect(createAuthSession as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'new-user-id' })
        );
        expect(mockCookieSet).toHaveBeenCalledTimes(2);
    });
});
