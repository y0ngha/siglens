import 'server-only';

import { asc, desc, gte, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
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
    /**
     * `fromDate` 이후 합계가 `minViews` 이상인 종목. 많은 순이고, 동률은 심볼 오름차순이라
     * 상위 N개 절단 경계에서도 실행마다 같은 종목이 남는다.
     */
    topViewed(fromDate: string, minViews: number): Promise<SymbolViewTally[]>;
}

/**
 * `SymbolViewRepository`의 Drizzle 구현 — 메서드별 계약은 인터페이스 JSDoc을 따른다.
 * 쓰기 경로(`recordView`, `pruneOlderThan`)만 일시적 DB 오류에 한해 재시도하고,
 * `topViewed`는 재시도 없이 오류를 그대로 던진다(호출부가 실패를 건너뛴다).
 * `recordView` 재시도는 첫 시도가 커밋된 뒤 응답만 유실된 경우 +1이 한 번 더
 * 들어갈 수 있는 at-least-once 카운터다.
 */
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
            DB_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(symbolViewsDaily)
                    .where(lt(symbolViewsDaily.date, cutoffDate)),
            DB_TRANSIENT_RETRY
        );
    }

    async topViewed(
        fromDate: string,
        minViews: number
    ): Promise<SymbolViewTally[]> {
        // postgres-js는 int8(sum 결과)을 문자열로 준다 — int로 캐스팅한다.
        const total = sql<number>`sum(${symbolViewsDaily.views})::int`;
        return this.db
            .select({ symbol: symbolViewsDaily.symbol, views: total })
            .from(symbolViewsDaily)
            .where(gte(symbolViewsDaily.date, fromDate))
            .groupBy(symbolViewsDaily.symbol)
            .having(sql`${total} >= ${minViews}`)
            .orderBy(desc(total), asc(symbolViewsDaily.symbol));
    }
}
