import { eq } from 'drizzle-orm';
import { oauthAccounts } from '@/shared/db/schema';
import {
    decryptToken,
    tryReadEncryptionKey,
} from '@/shared/db/tokenEncryption';
import type {
    OAuthAccountRecord,
    OAuthAccountRepository,
    SiglensDatabase,
} from '@/shared/db/types';

const oauthAccountColumns = {
    id: oauthAccounts.id,
    userId: oauthAccounts.userId,
    provider: oauthAccounts.provider,
    providerAccountId: oauthAccounts.providerAccountId,
    accessToken: oauthAccounts.accessToken,
    refreshToken: oauthAccounts.refreshToken,
    tokenExpiresAt: oauthAccounts.tokenExpiresAt,
    createdAt: oauthAccounts.createdAt,
};

function decryptAccountToken(
    encrypted: string | null,
    encryptionKey: string | null
): string | null {
    if (encrypted === null || encryptionKey === null) {
        return null;
    }
    return decryptToken(encrypted, encryptionKey);
}

/**
 * 사용자에 연결된 OAuth 계정 조회 저장소(PostgreSQL). 토큰은 복호화해 돌려주며,
 * 암호화 키가 없거나 복호화에 실패하면 해당 토큰은 null이다. 소비자: 계정 삭제 시 provider revoke.
 */
export class DrizzleOAuthAccountRepository implements OAuthAccountRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findByUserId(userId: string): Promise<OAuthAccountRecord[]> {
        const rows = await this.db
            .select(oauthAccountColumns)
            .from(oauthAccounts)
            .where(eq(oauthAccounts.userId, userId));

        // Read per-call so tests can override process.env between invocations.
        const encryptionKey = tryReadEncryptionKey();

        return rows.map(row => ({
            id: row.id,
            userId: row.userId,
            provider: row.provider,
            providerAccountId: row.providerAccountId,
            accessToken: decryptAccountToken(row.accessToken, encryptionKey),
            refreshToken: decryptAccountToken(row.refreshToken, encryptionKey),
            tokenExpiresAt: row.tokenExpiresAt,
            createdAt: row.createdAt,
        }));
    }
}
