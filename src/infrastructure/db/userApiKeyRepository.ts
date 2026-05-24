import type { LlmProvider } from '@/domain/llm';
import { and, eq, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { userApiKeys } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    decryptToken,
    encryptToken,
    tryReadLlmApiKeyEncryptionKey,
} from '@/shared/db/tokenEncryption';
import type {
    UpsertUserApiKeyInput,
    UserApiKeyMetaRecord,
    UserApiKeyRecord,
    UserApiKeyRepository,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * Thrown when a stored ciphertext exists but cannot be decrypted with the
 * configured `LLM_API_KEY_ENCRYPTION_KEY`. Distinct from the "no row" case so
 * callers can prompt the user to re-register their key instead of silently
 * downgrading them to the free-tier path.
 */
export class LlmApiKeyDecryptionFailedError extends Error {
    readonly code = 'api_key_corrupted' as const;

    constructor(
        readonly userId: string,
        readonly provider: LlmProvider
    ) {
        super(
            `Failed to decrypt stored API key for user=${userId} provider=${provider}`
        );
        this.name = 'LlmApiKeyDecryptionFailedError';
    }
}

const userApiKeyMetaColumns = {
    id: userApiKeys.id,
    userId: userApiKeys.userId,
    provider: userApiKeys.provider,
    createdAt: userApiKeys.createdAt,
    updatedAt: userApiKeys.updatedAt,
};

const userApiKeyRowColumns = {
    ...userApiKeyMetaColumns,
    encryptedApiKey: userApiKeys.encryptedApiKey,
};

/** @internal Resolves the LLM encryption key, throwing when absent or invalid, to prevent plaintext storage or blank decryption. */
function requireLlmEncryptionKey(): string {
    const encryptionKey = tryReadLlmApiKeyEncryptionKey();
    if (encryptionKey === null) {
        throw new Error(
            'LLM_API_KEY_ENCRYPTION_KEY environment variable is required for user API key encryption'
        );
    }
    return encryptionKey;
}

/**
 * Drizzle ORM implementation of {@link UserApiKeyRepository} backed by Neon
 * PostgreSQL. Encrypts plaintext API keys with AES-256-GCM (via
 * {@link encryptToken}) before storage and decrypts them on single-row reads.
 *
 * Requires `LLM_API_KEY_ENCRYPTION_KEY` (32-byte hex) to be present in the
 * environment whenever {@link upsert} or {@link findByUserAndProvider} runs.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleUserApiKeyRepository implements UserApiKeyRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async upsert(input: UpsertUserApiKeyInput): Promise<UserApiKeyMetaRecord> {
        const encryptionKey = requireLlmEncryptionKey();
        const encryptedApiKey = encryptToken(input.apiKey, encryptionKey);

        const [row] = await withRetry(
            () =>
                this.db
                    .insert(userApiKeys)
                    .values({
                        userId: input.userId,
                        provider: input.provider,
                        encryptedApiKey,
                    })
                    .onConflictDoUpdate({
                        target: [userApiKeys.userId, userApiKeys.provider],
                        set: { encryptedApiKey, updatedAt: sql`now()` },
                    })
                    .returning(userApiKeyMetaColumns),
            NEON_TRANSIENT_RETRY
        );

        if (row === undefined) {
            throw new Error('Failed to upsert user API key');
        }
        return row;
    }

    async findByUser(userId: string): Promise<UserApiKeyMetaRecord[]> {
        return this.db
            .select(userApiKeyMetaColumns)
            .from(userApiKeys)
            .where(eq(userApiKeys.userId, userId));
    }

    async findByUserAndProvider(
        userId: string,
        provider: LlmProvider
    ): Promise<UserApiKeyRecord | null> {
        const [row] = await this.db
            .select(userApiKeyRowColumns)
            .from(userApiKeys)
            .where(
                and(
                    eq(userApiKeys.userId, userId),
                    eq(userApiKeys.provider, provider)
                )
            )
            .limit(1);

        if (row === undefined) {
            return null;
        }

        const encryptionKey = requireLlmEncryptionKey();
        const apiKey = decryptToken(row.encryptedApiKey, encryptionKey);
        if (apiKey === null) {
            // Row exists but the stored ciphertext failed to decrypt.
            // Surface this as a typed error so callers do not silently treat
            // the user as "no BYOK key registered". userId/provider are
            // non-secret context for observability.
            console.error(
                '[userApiKeyRepository] Failed to decrypt stored API key',
                { userId, provider }
            );
            throw new LlmApiKeyDecryptionFailedError(userId, provider);
        }

        const { encryptedApiKey: _, ...meta } = row;
        return { ...meta, apiKey };
    }

    async deleteByUserAndProvider(
        userId: string,
        provider: LlmProvider
    ): Promise<boolean> {
        const deleted = await this.db
            .delete(userApiKeys)
            .where(
                and(
                    eq(userApiKeys.userId, userId),
                    eq(userApiKeys.provider, provider)
                )
            )
            .returning({ id: userApiKeys.id });

        return deleted.length > 0;
    }
}
