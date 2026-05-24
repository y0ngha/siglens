import { AUTH_SESSION_COOKIE_NAME } from '@/entities/session/lib/sessionCookie';
import { deleteAccount } from '@/entities/user/lib/deleteAccount';
import type { OAuthAccountRepository, UserRepository } from '@/shared/db/types';
import type { OAuthRevoker } from '@/entities/oauth-account/lib/revokerTypes';

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

function makeDependencies(deleted: boolean): {
    dependencies: {
        users: UserRepository;
        oauthAccounts: OAuthAccountRepository;
        oauthRevoker: OAuthRevoker;
    };
    deleteUser: ReturnType<typeof jest.fn>;
} {
    const deleteUser = jest.fn().mockResolvedValue(deleted);

    return {
        dependencies: {
            users: {
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser,
                updatePassword: jest.fn(),
            },
            oauthAccounts: {
                findByUserId: jest.fn().mockResolvedValue([]),
            },
            oauthRevoker: {
                revokeToken: jest.fn().mockResolvedValue(undefined),
            },
        },
        deleteUser,
    };
}

describe('deleteAccount', () => {
    afterEach(() => {
        jest.restoreAllMocks();
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
        const revokeToken = jest.fn().mockResolvedValue(undefined);
        const findByUserId = jest.fn().mockResolvedValue([
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
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser: jest.fn().mockResolvedValue(true),
                updatePassword: jest.fn(),
            },
            oauthAccounts: { findByUserId },
            oauthRevoker: { revokeToken },
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
        const revokeToken = jest.fn().mockResolvedValue(undefined);
        const findByUserId = jest.fn().mockResolvedValue([
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
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser: jest.fn().mockResolvedValue(true),
                updatePassword: jest.fn(),
            },
            oauthAccounts: { findByUserId },
            oauthRevoker: { revokeToken },
        };

        await deleteAccount({ userId: 'user-1' }, dependencies);

        await waitFor(() =>
            expect(findByUserId).toHaveBeenCalledWith('user-1')
        );
        expect(revokeToken).not.toHaveBeenCalled();
    });

    it('logs and continues deleting when OAuth account lookup fails', async () => {
        const lookupError = new Error('lookup failed');
        const consoleWarn = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const dependencies = {
            users: {
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser: jest.fn().mockResolvedValue(true),
                updatePassword: jest.fn(),
            },
            oauthAccounts: {
                findByUserId: jest.fn().mockRejectedValue(lookupError),
            },
            oauthRevoker: {
                revokeToken: jest.fn().mockResolvedValue(undefined),
            },
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
        const consoleWarn = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const dependencies = {
            users: {
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser: jest.fn().mockResolvedValue(true),
                updatePassword: jest.fn(),
            },
            oauthAccounts: {
                findByUserId: jest.fn().mockResolvedValue([
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
                revokeToken: jest.fn().mockRejectedValue(revokeError),
            },
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
});
