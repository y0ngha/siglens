jest.mock('@/entities/oauth-account/lib/pendingOAuthSignupStore');
jest.mock('@/entities/terms');
jest.mock('@/entities/user');
jest.mock('@/entities/agreement');
jest.mock('@/entities/session');
jest.mock('@/entities/session/lib/db');
jest.mock('@/entities/session/lib/sessionCookie', () => ({
    createAuthSession: jest.fn(),
    DEFAULT_SESSION_TTL_SECONDS: 7776000,
}));
jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));
jest.mock('@/entities/session/lib/applyAuthCookie', () => ({
    applyAuthCookie: jest.fn((c: unknown) => c),
}));
jest.mock('@/entities/session/lib/authHintCookie', () => ({
    createAuthHintCookie: jest.fn(() => ({ name: 'auth_hint', value: 'true' })),
}));
jest.mock('@/entities/session/lib/sessionCookieOptions', () => ({
    isSecureCookieEnv: jest.fn(() => false),
}));
jest.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: jest.fn((p: unknown) =>
        typeof p === 'string' ? p : '/'
    ),
}));
jest.mock('next/navigation', () => ({
    redirect: jest.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

import { finalizeOAuthSignupAction } from '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { DrizzleTermsRepository } from '@/entities/terms';
import { DrizzleUserRepository } from '@/entities/user';
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { getAuthDatabaseClient } from '@/entities/session/lib/db';
import { createAuthSession } from '@/entities/session/lib/sessionCookie';
import { cookies } from 'next/headers';

const mockRedirect = redirect as unknown as jest.Mock;
const mockCreateStore =
    createPendingOAuthSignupStoreFromEnv as unknown as jest.Mock;
const MockTermsRepo = DrizzleTermsRepository as jest.MockedClass<
    typeof DrizzleTermsRepository
>;
const MockUserRepo = DrizzleUserRepository as jest.MockedClass<
    typeof DrizzleUserRepository
>;
const MockAgreementRepo = DrizzleAgreementRepository as jest.MockedClass<
    typeof DrizzleAgreementRepository
>;
const mockGetAuthDb = getAuthDatabaseClient as unknown as jest.Mock;

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
        peek: jest.fn().mockResolvedValue(peekResult),
        consume: jest.fn().mockResolvedValue(consumeResult),
    });

    MockTermsRepo.mockImplementation(
        () =>
            ({
                findActive: jest
                    .fn()
                    .mockImplementation((kind: string) =>
                        Promise.resolve(
                            kind === 'privacy' ? privacyTerms : tosTerms
                        )
                    ),
            }) as unknown as InstanceType<typeof DrizzleTermsRepository>
    );

    MockUserRepo.mockImplementation(
        () =>
            ({
                findByEmail: jest.fn().mockResolvedValue(existingUser),
                createOAuthUser: jest
                    .fn()
                    .mockResolvedValue(createOAuthUserResult),
                deleteUser: jest.fn().mockResolvedValue(true),
            }) as unknown as InstanceType<typeof DrizzleUserRepository>
    );

    MockAgreementRepo.mockImplementation(
        () =>
            ({
                insertMany: insertManyThrows
                    ? jest.fn().mockRejectedValue(new Error('db error'))
                    : jest.fn().mockResolvedValue(undefined),
            }) as unknown as InstanceType<typeof DrizzleAgreementRepository>
    );

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
        jest.clearAllMocks();
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

        const deleteUser = jest.fn().mockResolvedValue(true);
        MockUserRepo.mockImplementation(
            () =>
                ({
                    findByEmail: jest.fn().mockResolvedValue(null),
                    createOAuthUser: jest
                        .fn()
                        .mockResolvedValue({ id: 'new-user-id' }),
                    deleteUser,
                }) as unknown as InstanceType<typeof DrizzleUserRepository>
        );

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
        const mockCookieSet = jest.fn();
        (cookies as jest.Mock).mockResolvedValue({ set: mockCookieSet });
        (createAuthSession as jest.Mock).mockResolvedValue({
            cookie: { name: 'session', value: 'test-session' },
        });

        await expectRedirectTo('/');

        expect(createAuthSession as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'new-user-id' })
        );
        expect(mockCookieSet).toHaveBeenCalledTimes(2);
    });
});
