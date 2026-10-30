import { and, count, eq, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { users, watchlistItems } from '@/shared/db/schema';
import type {
    AddWatchlistItemInput,
    AddWatchlistResultRecord,
    MergeWatchlistCandidate,
    MergeWatchlistOutcome,
    SiglensDatabase,
    WatchlistItemRecord,
    WatchlistItemRepository,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { planWatchlistMerge } from './lib/planWatchlistMerge';

const columns = {
    id: watchlistItems.id,
    userId: watchlistItems.userId,
    symbol: watchlistItems.symbol,
    companyName: watchlistItems.companyName,
    createdAt: watchlistItems.createdAt,
};

type WatchlistTx = Parameters<Parameters<SiglensDatabase['transaction']>[0]>[0];

/**
 * 회원 행을 `FOR NO KEY UPDATE`로 잠가 같은 회원의 동시 쓰기를 직렬화한다. "개수 조회 →
 * 삽입"을 따로 하면 두 탭이 같은 개수를 보고 둘 다 통과해 상한을 넘긴다. 잠금 모드를
 * `NO KEY UPDATE`로 한 이유: 다른 테이블이 `users`를 참조해 삽입할 때 거는 `KEY SHARE`와
 * 충돌하지 않아 이 잠금이 FK 검사를 막지 않는다.
 */
async function lockMember(tx: WatchlistTx, userId: string): Promise<void> {
    await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('no key update');
}

/**
 * 관심종목 저장소의 Drizzle 구현({@link WatchlistItemRepository}). 서버 전용 — 같은 엔티티의
 * 액션과 app에서만 쓴다. `watchlist_items_user_symbol_uidx`로 (userId, symbol)당 한 행이며,
 * 모든 쿼리를 `withRetry(DB_TRANSIENT_RETRY)`로 감싼다(재시도는 저장소 계층 책임 —
 * `DrizzlePortfolioRepository`와 같은 정책).
 */
export class DrizzleWatchlistRepository implements WatchlistItemRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 회원의 전 행(정렬 없음 — 최근 담은 순 정렬은 호출부 몫). */
    async findByUser(userId: string): Promise<WatchlistItemRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select(columns)
                    .from(watchlistItems)
                    .where(eq(watchlistItems.userId, userId)),
            DB_TRANSIENT_RETRY
        );
    }

    /** 회원이 담은 건수. */
    async countByUser(userId: string): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ value: count() })
                    .from(watchlistItems)
                    .where(eq(watchlistItems.userId, userId)),
            DB_TRANSIENT_RETRY
        );
        return Number(row?.value ?? 0);
    }

    /**
     * 상한 안에서만 담는다. 이미 담긴 심볼은 상한과 무관하게 멱등 성공이다(행 유지, 이름이
     * 비어 있을 때만 채움 — `created_at`이 그대로라 "최근 담은 순"이 흔들리지 않는다).
     * 동시 담기는 {@link lockMember}로 직렬화한다.
     */
    async addWithinLimit(
        input: AddWatchlistItemInput,
        limit: number
    ): Promise<AddWatchlistResultRecord> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    await lockMember(tx, input.userId);
                    const owned = await tx
                        .select({ symbol: watchlistItems.symbol })
                        .from(watchlistItems)
                        .where(eq(watchlistItems.userId, input.userId));
                    const alreadySaved = owned.some(
                        row => row.symbol === input.symbol
                    );
                    if (!alreadySaved && owned.length >= limit) {
                        return { status: 'limit_reached' } as const;
                    }
                    const [row] = await tx
                        .insert(watchlistItems)
                        .values({
                            userId: input.userId,
                            symbol: input.symbol,
                            companyName: input.companyName,
                        })
                        .onConflictDoUpdate({
                            target: [
                                watchlistItems.userId,
                                watchlistItems.symbol,
                            ],
                            set: {
                                companyName: sql`coalesce(${watchlistItems.companyName}, ${input.companyName})`,
                            },
                        })
                        .returning(columns);
                    if (row === undefined) {
                        throw new Error('Failed to upsert watchlist item');
                    }
                    return {
                        status: 'added',
                        item: row,
                        created: !alreadySaved,
                    } as const;
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 한 건 삭제. 지운 행이 있었으면 true(없는 심볼은 false — 멱등). */
    async remove(userId: string, symbol: string): Promise<boolean> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(watchlistItems)
                    .where(
                        and(
                            eq(watchlistItems.userId, userId),
                            eq(watchlistItems.symbol, symbol)
                        )
                    )
                    .returning({ id: watchlistItems.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length > 0;
    }

    /**
     * 합집합. `candidates`는 최근 담은 순이어야 한다(계획은 {@link planWatchlistMerge}).
     * 회원 행 잠금 안에서 읽고 넣어, 같은 회원의 `addWithinLimit`·다른 탭 병합과 겹쳐도
     * 상한을 넘기지 않는다. `onConflictDoNothing`은 잠금 밖 경로(직접 삽입)에 대한 방어선이며
     * `added`는 실제로 들어간 행 수다.
     */
    async mergeSymbols(
        userId: string,
        candidates: readonly MergeWatchlistCandidate[],
        limit: number
    ): Promise<MergeWatchlistOutcome> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    await lockMember(tx, userId);
                    const existing = await tx
                        .select({ symbol: watchlistItems.symbol })
                        .from(watchlistItems)
                        .where(eq(watchlistItems.userId, userId));
                    const { toInsert, skipped } = planWatchlistMerge(
                        new Set(existing.map(row => row.symbol)),
                        candidates,
                        limit
                    );
                    if (toInsert.length === 0) return { added: 0, skipped };

                    const inserted = await tx
                        .insert(watchlistItems)
                        .values(
                            toInsert.map(candidate => ({
                                userId,
                                symbol: candidate.symbol,
                                companyName: candidate.companyName,
                            }))
                        )
                        .onConflictDoNothing({
                            target: [
                                watchlistItems.userId,
                                watchlistItems.symbol,
                            ],
                        })
                        .returning({ id: watchlistItems.id });
                    return { added: inserted.length, skipped };
                }),
            DB_TRANSIENT_RETRY
        );
    }
}
