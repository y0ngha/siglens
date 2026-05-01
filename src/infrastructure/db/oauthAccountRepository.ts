import { eq } from 'drizzle-orm';
import { oauthAccounts } from './schema';
import type { SiglensDatabase } from './types';
import { decryptToken, tryReadEncryptionKey } from './tokenEncryption';
import type { OAuthAccountRecord, OAuthAccountRepository } from './types';

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
 * Drizzle ORM implementation of {@link OAuthAccountRepository} backed by Neon PostgreSQL.
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
