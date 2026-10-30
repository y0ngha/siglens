import { and, eq, sql } from 'drizzle-orm';
import type { LlmProvider } from '@/shared/config/llmProviders';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { userApiKeys } from '@/shared/db/schema';
import {
    decryptToken,
    encryptToken,
    tryReadLlmApiKeyEncryptionKey,
} from '@/shared/db/tokenEncryption';
import type {
    SiglensDatabase,
    UpsertUserApiKeyInput,
    UserApiKeyMetaRecord,
    UserApiKeyRecord,
    UserApiKeyRepository,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * 저장된 암호문이 있는데 설정된 `LLM_API_KEY_ENCRYPTION_KEY`로 복호화하지 못할 때 던진다.
 * "행 없음"과 구분되어, 호출부가 무료 경로로 조용히 내리지 않고 키 재등록을 안내할 수 있다.
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

/** LLM 암호화 키를 읽는다. 없거나 잘못됐으면 던져, 평문 저장이나 빈 키 복호화를 막는다. */
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
 * PostgreSQL 기반 {@link UserApiKeyRepository} 구현. 평문 API 키를 저장 전에
 * AES-256-GCM({@link encryptToken})으로 암호화하고, 단건 조회에서만 복호화한다.
 * 목록 조회·삭제는 암호문 컬럼을 읽지 않는다.
 *
 * `upsert`와 `findByUserAndProvider`는 환경변수 `LLM_API_KEY_ENCRYPTION_KEY`
 * (32바이트 hex)가 있어야 한다.
 *
 * @param db - `createDatabaseClient`로 얻은 Drizzle 클라이언트.
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
            DB_TRANSIENT_RETRY
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
            // 행은 있지만 복호화에 실패했다. 호출부가 "BYOK 키 없음"으로 오인하지
            // 않도록 타입 있는 오류로 올린다. userId/provider는 비밀이 아니라 로그에 남긴다.
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
