import 'server-only';

import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { signalEvents } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    SignalEpisodeInsert,
    SignalEpisodeKey,
    SignalHistoryMarket,
} from './types';

export interface SignalHistoryRepository {
    /**
     * `market`에서 `symbols`의 에피소드 중 마지막 포착 세션이 `sinceSession` 이상인 것 — 직전 세션
     * 이후로 이어진(아직 끊기지 않은) 에피소드의 (종목, 신호).
     */
    openEpisodeKeys(
        market: SignalHistoryMarket,
        symbols: readonly string[],
        sinceSession: string
    ): Promise<SignalEpisodeKey[]>;
    /** 새 에피소드를 연다(같은 키·같은 첫 세션은 무시). 넣은 행 수를 돌려준다. */
    insertEpisodes(rows: readonly SignalEpisodeInsert[]): Promise<number>;
    /**
     * 이어진 에피소드의 마지막 포착 세션을 `sessionDate`로 늘린다. `sinceSession` 이전에 끊긴 에피소드는
     * 건드리지 않는다. 늘린 행 수를 돌려준다.
     */
    extendEpisodes(
        market: SignalHistoryMarket,
        keys: readonly SignalEpisodeKey[],
        sessionDate: string,
        sinceSession: string
    ): Promise<number>;
    /** 마지막 포착 세션이 `cutoffDate`보다 이른 에피소드를 지운다. 지운 행 수를 돌려준다. */
    pruneOlderThan(cutoffDate: string): Promise<number>;
}

export class DrizzleSignalHistoryRepository implements SignalHistoryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async openEpisodeKeys(
        market: SignalHistoryMarket,
        symbols: readonly string[],
        sinceSession: string
    ): Promise<SignalEpisodeKey[]> {
        if (symbols.length === 0) return [];
        return withRetry(
            () =>
                this.db
                    .selectDistinct({
                        symbol: signalEvents.symbol,
                        signalType: signalEvents.signalType,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.market, market),
                            inArray(signalEvents.symbol, [...symbols]),
                            gte(signalEvents.lastSeenSession, sinceSession)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    async insertEpisodes(
        rows: readonly SignalEpisodeInsert[]
    ): Promise<number> {
        if (rows.length === 0) return 0;
        const inserted = await withRetry(
            () =>
                this.db
                    .insert(signalEvents)
                    .values(
                        rows.map(row => ({
                            ...row,
                            lastSeenSession: row.sessionDate,
                            computedAt: new Date(row.computedAt),
                        }))
                    )
                    .onConflictDoNothing()
                    .returning({ symbol: signalEvents.symbol }),
            DB_TRANSIENT_RETRY
        );
        return inserted.length;
    }

    async extendEpisodes(
        market: SignalHistoryMarket,
        keys: readonly SignalEpisodeKey[],
        sessionDate: string,
        sinceSession: string
    ): Promise<number> {
        if (keys.length === 0) return 0;
        // (종목, 신호) 쌍 그대로 고른다. 종목 목록 × 신호 목록으로 따로 거르면, 오늘 A에는 X만,
        // B에는 Y만 잡혔을 때 이어진 A-Y 에피소드까지 늘어난다.
        const pairs = sql.join(
            keys.map(key => sql`(${key.symbol}, ${key.signalType})`),
            sql`, `
        );
        const updated = await withRetry(
            () =>
                this.db
                    .update(signalEvents)
                    .set({ lastSeenSession: sessionDate })
                    .where(
                        and(
                            eq(signalEvents.market, market),
                            gte(signalEvents.lastSeenSession, sinceSession),
                            lt(signalEvents.lastSeenSession, sessionDate),
                            sql`(${signalEvents.symbol}, ${signalEvents.signalType}) in (${pairs})`
                        )
                    )
                    .returning({ symbol: signalEvents.symbol }),
            DB_TRANSIENT_RETRY
        );
        return updated.length;
    }

    async pruneOlderThan(cutoffDate: string): Promise<number> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(signalEvents)
                    .where(lt(signalEvents.lastSeenSession, cutoffDate))
                    .returning({ symbol: signalEvents.symbol }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }
}
