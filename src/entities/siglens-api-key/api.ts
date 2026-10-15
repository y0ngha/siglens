import 'server-only';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { siglensApiKeys, users } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { API_KEY_LAST_USED_THROTTLE_SECONDS } from '@/shared/config/publicApi';
import type {
    ApiKeyPrincipal,
    CreateSiglensApiKeyInput,
    CreateSiglensApiKeyResult,
    RevokeSiglensApiKeyResult,
    SiglensApiKeySummary,
} from './model';

const summaryColumns = {
    id: siglensApiKeys.id,
    name: siglensApiKeys.name,
    keyPrefix: siglensApiKeys.keyPrefix,
    createdAt: siglensApiKeys.createdAt,
    lastUsedAt: siglensApiKeys.lastUsedAt,
};

/**
 * Drizzle repository for `siglens_api_keys`. Reads that sit on the request path
 * (`findActivePrincipalByHash`) deliberately do NOT use `withRetry`: the auth caller already
 * degrades to 503, and a retry ladder would hold a bearer request for seconds.
 */
export class DrizzleSiglensApiKeyRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 활성 키만, 오래된 순. 폐기된 키는 계정 화면에 남기지 않는다. */
    async listActiveByUser(userId: string): Promise<SiglensApiKeySummary[]> {
        return withRetry(
            () =>
                this.db
                    .select(summaryColumns)
                    .from(siglensApiKeys)
                    .where(
                        and(
                            eq(siglensApiKeys.userId, userId),
                            isNull(siglensApiKeys.revokedAt)
                        )
                    )
                    .orderBy(asc(siglensApiKeys.createdAt)),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 회원의 활성 키 해시. 계정 삭제 직전에 읽어 두었다가 삭제 뒤 인증 캐시를 끊는 데 쓴다
     * (키 행은 FK cascade로 사라지므로 삭제 뒤에는 해시를 알 수 없다).
     */
    async listActiveKeyHashesByUser(userId: string): Promise<string[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ keyHash: siglensApiKeys.keyHash })
                    .from(siglensApiKeys)
                    .where(
                        and(
                            eq(siglensApiKeys.userId, userId),
                            isNull(siglensApiKeys.revokedAt)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => row.keyHash);
    }

    /**
     * 활성 키 수 상한을 지키며 발급한다. 개수 확인과 삽입이 탭·요청 사이에서 경합하지
     * 않도록 소유 회원 행에 락을 잡은 트랜잭션 안에서 한다(SERVER.md#CC-10).
     */
    async createWithinLimit(
        input: CreateSiglensApiKeyInput,
        limit: number
    ): Promise<CreateSiglensApiKeyResult> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    await tx
                        .select({ id: users.id })
                        .from(users)
                        .where(eq(users.id, input.userId))
                        .for('no key update');
                    const [active] = await tx
                        .select({ value: count() })
                        .from(siglensApiKeys)
                        .where(
                            and(
                                eq(siglensApiKeys.userId, input.userId),
                                isNull(siglensApiKeys.revokedAt)
                            )
                        );
                    if ((active?.value ?? 0) >= limit) {
                        return { status: 'limit_reached' } as const;
                    }
                    const [row] = await tx
                        .insert(siglensApiKeys)
                        .values(input)
                        .returning(summaryColumns);
                    if (row === undefined) {
                        throw new Error('Failed to insert siglens API key');
                    }
                    return { status: 'created', key: row } as const;
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 본인 소유의 활성 키만 폐기한다. `user_id` 조건이 WHERE에 있어 남의 키 id를 넘겨도
     * 영향이 없다. 이미 폐기된 키는 `not_found`(멱등하게 두 번째 호출은 아무것도 안 한다).
     * 캐시 무효화에 쓰도록 해시를 돌려준다.
     */
    async revokeOwned(
        userId: string,
        keyId: string
    ): Promise<RevokeSiglensApiKeyResult> {
        const [row] = await withRetry(
            () =>
                this.db
                    .update(siglensApiKeys)
                    .set({ revokedAt: sql`now()` })
                    .where(
                        and(
                            eq(siglensApiKeys.id, keyId),
                            eq(siglensApiKeys.userId, userId),
                            isNull(siglensApiKeys.revokedAt)
                        )
                    )
                    .returning({ keyHash: siglensApiKeys.keyHash }),
            DB_TRANSIENT_RETRY
        );
        return row === undefined
            ? { status: 'not_found' }
            : { status: 'revoked', keyHash: row.keyHash };
    }

    /**
     * 해시로 활성 키와 소유 회원을 한 번에 읽는다. 이메일 미인증 회원은 제외한다
     * (탈퇴 회원은 FK cascade로 키 자체가 없다). 없으면 `null`.
     */
    async findActivePrincipalByHash(
        keyHash: string
    ): Promise<ApiKeyPrincipal | null> {
        const [row] = await this.db
            .select({
                keyId: siglensApiKeys.id,
                keyName: siglensApiKeys.name,
                keyPrefix: siglensApiKeys.keyPrefix,
                userId: siglensApiKeys.userId,
                tier: users.tier,
            })
            .from(siglensApiKeys)
            .innerJoin(users, eq(users.id, siglensApiKeys.userId))
            .where(
                and(
                    eq(siglensApiKeys.keyHash, keyHash),
                    isNull(siglensApiKeys.revokedAt),
                    eq(users.emailVerified, true)
                )
            )
            .limit(1);
        return row ?? null;
    }

    /**
     * 회원의 API 기본 모델(`users.api_default_model`). 설정이 없거나 회원이 없으면 `null`.
     * 요청 경로에서 매번 읽는다(캐시하지 않는다) — 계정 화면에서 바꾸면 다음 요청부터 반영돼야 한다.
     */
    async findApiDefaultModel(userId: string): Promise<string | null> {
        const [row] = await this.db
            .select({ model: users.apiDefaultModel })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return row?.model ?? null;
    }

    /**
     * 기본 모델을 저장한다(`null`이면 해제). 회원 행이 없으면 `false`.
     * 유효성(로스터·등록된 BYOK provider)은 호출부(`setApiDefaultModelAction`)가 이미 확인했다.
     */
    async setApiDefaultModel(
        userId: string,
        model: string | null
    ): Promise<boolean> {
        const rows = await withRetry(
            () =>
                this.db
                    .update(users)
                    .set({ apiDefaultModel: model })
                    .where(eq(users.id, userId))
                    .returning({ id: users.id }),
            DB_TRANSIENT_RETRY
        );
        return rows.length > 0;
    }

    /**
     * `last_used_at`을 최대 분당 한 번만 쓴다. 조건이 WHERE에 있어 최근에 갱신된 행은
     * 아무것도 쓰지 않는다 — 호출이 잦아도 쓰기가 늘지 않는다.
     */
    async touchLastUsed(keyId: string): Promise<void> {
        await this.db
            .update(siglensApiKeys)
            .set({ lastUsedAt: sql`now()` })
            .where(
                and(
                    eq(siglensApiKeys.id, keyId),
                    sql`(${siglensApiKeys.lastUsedAt} IS NULL OR ${siglensApiKeys.lastUsedAt} < now() - make_interval(secs => ${API_KEY_LAST_USED_THROTTLE_SECONDS}))`
                )
            );
    }
}
