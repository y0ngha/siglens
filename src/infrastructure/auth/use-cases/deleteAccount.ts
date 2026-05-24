import { createExpiredSessionCookie } from '@/infrastructure/auth/sessionCookie';
import type { OAuthAccountRecord } from '@/shared/db/types';
import type {
    DeleteAccountDependencies,
    DeleteAccountError,
    DeleteAccountInput,
    DeleteAccountOptions,
    DeleteAccountResult,
} from '@/infrastructure/auth/use-cases/types';

type RevocableOAuthAccount = Omit<OAuthAccountRecord, 'accessToken'> & {
    accessToken: string;
};

function hasAccessToken(
    account: OAuthAccountRecord
): account is RevocableOAuthAccount {
    return account.accessToken !== null;
}

async function findOAuthAccountsForRevocation(
    userId: string,
    dependencies: Pick<DeleteAccountDependencies, 'oauthAccounts'>
): Promise<OAuthAccountRecord[]> {
    try {
        return await dependencies.oauthAccounts.findByUserId(userId);
    } catch (error) {
        console.warn(
            '[deleteAccount] findByUserId for OAuth revocation failed',
            error
        );
        return [];
    }
}

async function revokeOAuthTokens(
    userId: string,
    dependencies: Pick<
        DeleteAccountDependencies,
        'oauthAccounts' | 'oauthRevoker'
    >
): Promise<void> {
    const accounts = await findOAuthAccountsForRevocation(userId, dependencies);

    const revocableAccounts: RevocableOAuthAccount[] =
        accounts.filter(hasAccessToken);

    void Promise.allSettled(
        revocableAccounts.map(account =>
            dependencies.oauthRevoker
                .revokeToken(account.provider, {
                    accessToken: account.accessToken,
                    refreshToken: account.refreshToken,
                })
                .catch(error => {
                    console.warn(
                        '[deleteAccount] OAuth revokeToken failed',
                        error
                    );
                })
        )
    );
}

const USER_NOT_FOUND_MESSAGE = '사용자 계정을 찾을 수 없습니다.';

function userNotFoundError(): DeleteAccountError {
    return {
        code: 'user_not_found',
        message: USER_NOT_FOUND_MESSAGE,
    };
}

/** Delete a user account along with its dependent persistence rows. */
export async function deleteAccount(
    input: DeleteAccountInput,
    dependencies: DeleteAccountDependencies,
    options: DeleteAccountOptions = {}
): Promise<DeleteAccountResult> {
    await revokeOAuthTokens(input.userId, dependencies);

    const deleted = await dependencies.users.deleteUser(input.userId);

    if (!deleted) {
        return { ok: false, error: userNotFoundError() };
    }

    const cookie = createExpiredSessionCookie({
        name: options.cookieName,
        secure: options.secureCookie,
        sameSite: options.sameSite,
        path: options.path,
    });

    return { ok: true, cookie };
}
