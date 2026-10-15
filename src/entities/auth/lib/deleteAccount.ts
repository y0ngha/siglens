import { createExpiredSessionCookie } from './sessionCookie';
import type { OAuthAccountRecord } from '@/shared/db/types';
import type {
    DeleteAccountDependencies,
    DeleteAccountError,
    DeleteAccountInput,
    DeleteAccountOptions,
    DeleteAccountResult,
} from './authUseCaseTypes';

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

async function readActiveApiKeyHashes(
    userId: string,
    dependencies: Pick<DeleteAccountDependencies, 'apiKeys'>
): Promise<string[]> {
    if (dependencies.apiKeys === undefined) return [];
    try {
        return await dependencies.apiKeys.listActiveKeyHashes(userId);
    } catch (error) {
        console.warn('[deleteAccount] listing API key hashes failed', error);
        return [];
    }
}

async function revokeApiKeyAuth(
    keyHashes: readonly string[],
    dependencies: Pick<DeleteAccountDependencies, 'apiKeys'>
): Promise<void> {
    if (dependencies.apiKeys === undefined || keyHashes.length === 0) return;
    try {
        await dependencies.apiKeys.revokeAuth(keyHashes);
    } catch (error) {
        console.warn('[deleteAccount] API key auth revocation failed', error);
    }
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
    // 삭제 전에 읽는다: 키 행이 cascade로 사라지면 인증 캐시를 지울 해시를 알 방법이 없다.
    const apiKeyHashes = await readActiveApiKeyHashes(
        input.userId,
        dependencies
    );

    const deleted = await dependencies.users.deleteUser(input.userId);

    if (!deleted) {
        return { ok: false, error: userNotFoundError() };
    }

    // 커밋 뒤에 끊는다. 실패해도 삭제는 이미 끝났다(키는 DB에 없고 캐시는 TTL 안에 만료).
    await revokeApiKeyAuth(apiKeyHashes, dependencies);

    const cookie = createExpiredSessionCookie({
        name: options.cookieName,
        secure: options.secureCookie,
        sameSite: options.sameSite,
        path: options.path,
    });

    return { ok: true, cookie };
}
