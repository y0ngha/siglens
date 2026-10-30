import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { deleteAccount } from '@/entities/auth/lib/deleteAccount';
import type { OAuthAccountRepository, UserRepository } from '@/shared/db/types';
import type { OAuthRevoker } from '@/entities/oauth-account/lib/revokerTypes';
import type { DeleteAccountApiKeys } from '@/entities/auth/lib/authUseCaseTypes';

async function waitFor(
    assertion: () => void | Promise<void>,
    options?: { timeout?: number; interval?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 1000;
    const interval = options?.interval ?? 10;
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            await assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    throw lastError ?? new Error('waitFor: timeout');
}

/** 활성 키가 없는 회원 — apiKeys 의존성은 필수이므로 키와 무관한 테스트도 채워 넘긴다. */
function noApiKeys(): DeleteAccountApiKeys {
    return {
        listActiveKeyHashes: vi.fn().mockResolvedValue([]),
        revokeAuth: vi.fn().mockResolvedValue(undefined),
    };
}

function makeDependencies(deleted: boolean): {
    dependencies: {
        users: UserRepository;
        oauthAccounts: OAuthAccountRepository;
        oauthRevoker: OAuthRevoker;
        apiKeys: DeleteAccountApiKeys;
    };
    deleteUser: ReturnType<typeof vi.fn>;
} {
    const deleteUser = vi.fn().mockResolvedValue(deleted);

    return {
        dependencies: {
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser,
                updatePassword: vi.fn(),
            },
            oauthAccounts: {
                findByUserId: vi.fn().mockResolvedValue([]),
            },
            oauthRevoker: {
                revokeToken: vi.fn().mockResolvedValue(undefined),
            },
            // 기본값: 활성 키 없음. 키 폐기 동작은 아래 전용 describe가 고정한다.
            apiKeys: {
                listActiveKeyHashes: vi.fn().mockResolvedValue([]),
                revokeAuth: vi.fn().mockResolvedValue(undefined),
            },
        },
        deleteUser,
    };
}

describe('deleteAccount', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('deletes the user account and returns an expired HTTP-only cookie', async () => {
        const { dependencies, deleteUser } = makeDependencies(true);

        const result = await deleteAccount({ userId: 'user-1' }, dependencies);

        expect(deleteUser).toHaveBeenCalledWith('user-1');
        expect(result).toEqual({
            ok: true,
            cookie: {
                name: AUTH_SESSION_COOKIE_NAME,
                value: '',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                expires: new Date('1970-01-01T00:00:00.000Z'),
                maxAgeSeconds: 0,
            },
        });
    });

    it('applies custom cookie overrides on success', async () => {
        const { dependencies } = makeDependencies(true);

        const result = await deleteAccount({ userId: 'user-1' }, dependencies, {
            cookieName: 'custom_session',
            secureCookie: false,
            sameSite: 'none',
            path: '/app',
        });

        expect(result).toEqual({
            ok: true,
            cookie: {
                name: 'custom_session',
                value: '',
                httpOnly: true,
                secure: false,
                sameSite: 'none',
                path: '/app',
                expires: new Date('1970-01-01T00:00:00.000Z'),
                maxAgeSeconds: 0,
            },
        });
    });

    it('returns user_not_found when no row matches the user id', async () => {
        const { dependencies } = makeDependencies(false);

        const result = await deleteAccount(
            { userId: 'missing-user' },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'user_not_found',
                message: '사용자 계정을 찾을 수 없습니다.',
            },
        });
    });

    it('loads OAuth tokens before deleting the user and revokes tokens in the background', async () => {
        const revokeToken = vi.fn().mockResolvedValue(undefined);
        const findByUserId = vi.fn().mockResolvedValue([
            {
                id: 'account-1',
                userId: 'user-1',
                provider: 'google',
                providerAccountId: 'google-uid',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: null,
                createdAt: new Date(),
            },
        ]);

        const dependencies = {
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser: vi.fn().mockResolvedValue(true),
                updatePassword: vi.fn(),
            },
            oauthAccounts: { findByUserId },
            oauthRevoker: { revokeToken },
            apiKeys: noApiKeys(),
        };

        await deleteAccount({ userId: 'user-1' }, dependencies);

        expect(findByUserId.mock.invocationCallOrder[0]).toBeLessThan(
            dependencies.users.deleteUser.mock.invocationCallOrder[0]!
        );
        expect(dependencies.users.deleteUser).toHaveBeenCalledWith('user-1');
        await waitFor(() => {
            expect(revokeToken).toHaveBeenCalledWith('google', {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
        });
    });

    it('skips revocation for accounts without an access token', async () => {
        const revokeToken = vi.fn().mockResolvedValue(undefined);
        const findByUserId = vi.fn().mockResolvedValue([
            {
                id: 'account-2',
                userId: 'user-1',
                provider: 'kakao',
                providerAccountId: 'kakao-uid',
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
                createdAt: new Date(),
            },
        ]);

        const dependencies = {
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser: vi.fn().mockResolvedValue(true),
                updatePassword: vi.fn(),
            },
            oauthAccounts: { findByUserId },
            oauthRevoker: { revokeToken },
            apiKeys: noApiKeys(),
        };

        await deleteAccount({ userId: 'user-1' }, dependencies);

        await waitFor(() =>
            expect(findByUserId).toHaveBeenCalledWith('user-1')
        );
        expect(revokeToken).not.toHaveBeenCalled();
    });

    it('logs and continues deleting when OAuth account lookup fails', async () => {
        const lookupError = new Error('lookup failed');
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const dependencies = {
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser: vi.fn().mockResolvedValue(true),
                updatePassword: vi.fn(),
            },
            oauthAccounts: {
                findByUserId: vi.fn().mockRejectedValue(lookupError),
            },
            oauthRevoker: {
                revokeToken: vi.fn().mockResolvedValue(undefined),
            },
            apiKeys: noApiKeys(),
        };

        const result = await deleteAccount({ userId: 'user-1' }, dependencies);

        expect(consoleWarn).toHaveBeenCalledWith(
            '[deleteAccount] findByUserId for OAuth revocation failed',
            lookupError
        );
        expect(dependencies.users.deleteUser).toHaveBeenCalledWith('user-1');
        expect(result.ok).toBe(true);
    });

    it('logs provider revocation failures without blocking deletion', async () => {
        const revokeError = new Error('revoke failed');
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const dependencies = {
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser: vi.fn().mockResolvedValue(true),
                updatePassword: vi.fn(),
            },
            oauthAccounts: {
                findByUserId: vi.fn().mockResolvedValue([
                    {
                        id: 'account-1',
                        userId: 'user-1',
                        provider: 'google',
                        providerAccountId: 'google-uid',
                        accessToken: 'access-token',
                        refreshToken: null,
                        tokenExpiresAt: null,
                        createdAt: new Date(),
                    },
                ]),
            },
            oauthRevoker: {
                revokeToken: vi.fn().mockRejectedValue(revokeError),
            },
            apiKeys: noApiKeys(),
        };

        const result = await deleteAccount({ userId: 'user-1' }, dependencies);

        expect(result.ok).toBe(true);
        await waitFor(() => {
            expect(consoleWarn).toHaveBeenCalledWith(
                '[deleteAccount] OAuth revokeToken failed',
                revokeError
            );
        });
    });

    describe('API key auth revocation', () => {
        const HASHES = ['a'.repeat(64), 'b'.repeat(64)];

        it('reads the active key hashes BEFORE deleting and revokes auth AFTER the commit', async () => {
            const { dependencies, deleteUser } = makeDependencies(true);
            const order: string[] = [];
            deleteUser.mockImplementation(async () => {
                order.push('delete');
                return true;
            });
            const apiKeys = {
                listActiveKeyHashes: vi.fn(async () => {
                    order.push('list');
                    return HASHES;
                }),
                revokeAuth: vi.fn(async () => {
                    order.push('revoke');
                }),
            };

            await deleteAccount(
                { userId: 'user-1' },
                { ...dependencies, apiKeys }
            );

            expect(order).toEqual(['list', 'delete', 'revoke']);
            expect(apiKeys.listActiveKeyHashes).toHaveBeenCalledWith('user-1');
            expect(apiKeys.revokeAuth).toHaveBeenCalledWith(HASHES);
        });

        it('does not revoke auth when the delete did not happen', async () => {
            const { dependencies } = makeDependencies(false);
            const apiKeys = {
                listActiveKeyHashes: vi.fn().mockResolvedValue(HASHES),
                revokeAuth: vi.fn(),
            };
            await deleteAccount(
                { userId: 'user-1' },
                { ...dependencies, apiKeys }
            );
            expect(apiKeys.revokeAuth).not.toHaveBeenCalled();
        });

        it('still deletes when listing the hashes fails', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            const { dependencies, deleteUser } = makeDependencies(true);
            const apiKeys = {
                listActiveKeyHashes: vi.fn().mockRejectedValue(new Error('db')),
                revokeAuth: vi.fn(),
            };
            const result = await deleteAccount(
                { userId: 'user-1' },
                { ...dependencies, apiKeys }
            );
            expect(deleteUser).toHaveBeenCalled();
            expect(result.ok).toBe(true);
            expect(apiKeys.revokeAuth).not.toHaveBeenCalled();
        });

        it('still succeeds when revoking auth fails (the rows are already gone)', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            const { dependencies } = makeDependencies(true);
            const apiKeys = {
                listActiveKeyHashes: vi.fn().mockResolvedValue(HASHES),
                revokeAuth: vi.fn().mockRejectedValue(new Error('redis')),
            };
            const result = await deleteAccount(
                { userId: 'user-1' },
                { ...dependencies, apiKeys }
            );
            expect(result.ok).toBe(true);
        });

        it('skips revocation when the user has no active keys', async () => {
            const { dependencies } = makeDependencies(true);
            const apiKeys = {
                listActiveKeyHashes: vi.fn().mockResolvedValue([]),
                revokeAuth: vi.fn(),
            };
            await deleteAccount(
                { userId: 'user-1' },
                { ...dependencies, apiKeys }
            );
            expect(apiKeys.revokeAuth).not.toHaveBeenCalled();
        });
    });
});
