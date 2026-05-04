jest.mock('@/infrastructure/auth/pendingOAuthSignupStore');
jest.mock('@/infrastructure/db/termsRepository');
jest.mock('@/infrastructure/db/userRepository');
jest.mock('@/infrastructure/db/agreementRepository');
jest.mock('@/infrastructure/auth/db');
jest.mock('next/navigation', () => ({
    redirect: jest.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

import { finalizeOAuthSignupAction } from '@/infrastructure/auth/finalizeOAuthSignupAction';
import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';

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
    version: '1.0',
    content: '',
    effectiveDate: new Date(),
    createdAt: new Date(),
};
const SAMPLE_TERMS_T = {
    id: 'terms-t',
    kind: 'tos' as const,
    version: '1.0',
    content: '',
    effectiveDate: new Date(),
    createdAt: new Date(),
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
        transactionThrows?: boolean;
    } = {}
): void {
    const {
        storeAvailable = true,
        peekResult = SAMPLE_PROFILE,
        consumeResult = SAMPLE_PROFILE,
        privacyTerms = SAMPLE_TERMS_P,
        tosTerms = SAMPLE_TERMS_T,
        existingUser = null,
        transactionThrows = false,
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
                    .mockResolvedValue({ id: 'new-user-id' }),
            }) as unknown as InstanceType<typeof DrizzleUserRepository>
    );

    MockAgreementRepo.mockImplementation(
        () =>
            ({
                insertMany: jest.fn().mockResolvedValue(undefined),
            }) as unknown as InstanceType<typeof DrizzleAgreementRepository>
    );

    const txMock = transactionThrows
        ? jest.fn().mockRejectedValue(new Error('db error'))
        : jest
              .fn()
              .mockImplementation(
                  async (cb: (tx: unknown) => Promise<string>) => cb({})
              );

    mockGetAuthDb.mockReturnValue({ db: { transaction: txMock } });
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

    it('redirects to service_unavailable when DB transaction throws', async () => {
        setupMocks({ transactionThrows: true });
        await expectRedirectTo('/login?error=service_unavailable');
    });
});
