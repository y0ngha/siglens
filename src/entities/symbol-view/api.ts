import 'server-only';

import { desc, gte, lt, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { symbolViewsDaily } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { SymbolViewTally } from './types';

/** 종목 일자 조회수의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
export interface SymbolViewRepository {
    /** (date, symbol) upsert — 없으면 1, 있으면 +1. */
    recordView(date: string, symbol: string): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** `fromDate` 이후 합계가 `minViews` 이상인 종목. 많은 순. */
    topViewed(fromDate: string, minViews: number): Promise<SymbolViewTally[]>;
}

export class DrizzleSymbolViewRepository implements SymbolViewRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordView(date: string, symbol: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(symbolViewsDaily)
                    .values({ date, symbol })
                    .onConflictDoUpdate({
                        target: [
                            symbolViewsDaily.date,
                            symbolViewsDaily.symbol,
                        ],
                        set: { views: sql`${symbolViewsDaily.views} + 1` },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(symbolViewsDaily)
                    .where(lt(symbolViewsDaily.date, cutoffDate)),
            NEON_TRANSIENT_RETRY
        );
    }

    async topViewed(
        fromDate: string,
        minViews: number
    ): Promise<SymbolViewTally[]> {
        // Neon HTTP는 bigint(sum 결과)를 문자열로 준다 — int로 캐스팅한다.
        const total = sql<number>`sum(${symbolViewsDaily.views})::int`;
        return this.db
            .select({ symbol: symbolViewsDaily.symbol, views: total })
            .from(symbolViewsDaily)
            .where(gte(symbolViewsDaily.date, fromDate))
            .groupBy(symbolViewsDaily.symbol)
            .having(sql`${total} >= ${minViews}`)
            .orderBy(desc(total));
    }
}
