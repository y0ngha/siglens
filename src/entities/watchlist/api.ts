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

const columns = {
    id: watchlistItems.id,
    userId: watchlistItems.userId,
    symbol: watchlistItems.symbol,
    companyName: watchlistItems.companyName,
    createdAt: watchlistItems.createdAt,
};

/** 같은 심볼이 여러 번 오면 앞의 것(호출부 순서 = 최근 담은 순)만 남긴다. */
function dedupeBySymbol(
    candidates: readonly MergeWatchlistCandidate[]
): MergeWatchlistCandidate[] {
    const seen = new Set<string>();
    return candidates.filter(candidate => {
        if (seen.has(candidate.symbol)) return false;
        seen.add(candidate.symbol);
        return true;
    });
}

/**
 * Drizzle implementation of {@link WatchlistItemRepository}. One row per (userId, symbol) via
 * `watchlist_items_user_symbol_uidx`. Every method wraps its query in `withRetry(DB_TRANSIENT_RETRY)`
 * — retry is a repository-layer concern (same policy as `DrizzlePortfolioRepository`).
 */
export class DrizzleWatchlistRepository implements WatchlistItemRepository {
    constructor(private readonly db: SiglensDatabase) {}

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
     *
     * 회원 행을 `FOR NO KEY UPDATE`로 잠가 같은 회원의 동시 담기를 직렬화한다. "개수 조회 →
     * 삽입"을 따로 하면 두 탭이 같은 개수를 보고 둘 다 통과해 상한을 넘긴다. 잠금 모드를
     * `NO KEY UPDATE`로 한 이유: 다른 테이블이 `users`를 참조해 삽입할 때 거는 `KEY SHARE`와
     * 충돌하지 않아 이 잠금이 FK 검사를 막지 않는다.
     */
    async addWithinLimit(
        input: AddWatchlistItemInput,
        limit: number
    ): Promise<AddWatchlistResultRecord> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    await tx
                        .select({ id: users.id })
                        .from(users)
                        .where(eq(users.id, input.userId))
                        .for('no key update');
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
     * 합집합. `candidates`는 최근 담은 순이어야 한다 — 상한(`limit`)은 기존 행 수를 뺀 여유만큼
     * 앞에서부터 채우고 나머지를 `skipped`로 센다. 이미 있는 심볼은 어느 쪽에도 들지 않는다.
     * `onConflictDoNothing`은 조회와 삽입 사이의 경쟁(같은 회원의 다른 탭)을 흡수한다 —
     * 그때 `added`는 실제로 들어간 행 수다.
     */
    async mergeSymbols(
        userId: string,
        candidates: readonly MergeWatchlistCandidate[],
        limit: number
    ): Promise<MergeWatchlistOutcome> {
        const existing = await this.findByUser(userId);
        const existingSymbols = new Set(existing.map(row => row.symbol));
        const fresh = dedupeBySymbol(candidates).filter(
            candidate => !existingSymbols.has(candidate.symbol)
        );
        const capacity = Math.max(0, limit - existing.length);
        const toInsert = fresh.slice(0, capacity);
        const skipped = fresh.length - toInsert.length;
        if (toInsert.length === 0) return { added: 0, skipped };

        const inserted = await withRetry(
            () =>
                this.db
                    .insert(watchlistItems)
                    .values(
                        toInsert.map(candidate => ({
                            userId,
                            symbol: candidate.symbol,
                            companyName: candidate.companyName,
                        }))
                    )
                    .onConflictDoNothing({
                        target: [watchlistItems.userId, watchlistItems.symbol],
                    })
                    .returning({ id: watchlistItems.id }),
            DB_TRANSIENT_RETRY
        );
        return { added: inserted.length, skipped };
    }
}
