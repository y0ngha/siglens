import 'server-only';

import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { signalEvents } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    SignalEpisodeInsert,
    SignalEpisodeRow,
    SignalEpisodeKey,
    SignalEpisodeStartedRow,
    SignalHistoryMarket,
    SignalHubCount,
} from './types';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 신호 이력을 읽는 캐시(신호 페이지·사이트맵 집계)의 태그. 기록기가 새 에피소드를 넣으면 이 태그를
 * 무효화해, 장 마감 뒤 기록이 캐시 TTL(1시간)을 기다리지 않고 페이지에 나온다.
 */
export const SIGNAL_HISTORY_CACHE_TAG = 'signal-history';

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
    /**
     * `signalType`이 `sinceSession` 이후 처음 포착된 에피소드 — 첫 포착 세션 최신순, 같은 날이면
     * 등락률 크기순. 신호 페이지가 읽는다(`signal_events_type_date_idx` 범위 스캔).
     */
    listRecentEpisodes(
        signalType: string,
        sinceSession: string,
        limit: number
    ): Promise<SignalEpisodeRow[]>;
    /**
     * 신호별로 `sinceSession` 이후 처음 포착된 에피소드의 서로 다른 (시장, 종목) 수와 가장 최근 마지막
     * 포착 세션. 사이트맵이 색인할 신호 페이지와 lastmod를 고르는 데 쓴다.
     */
    recentCountsByType(
        signalTypes: readonly string[],
        sinceSession: string
    ): Promise<SignalHubCount[]>;
    /**
     * `market`에서 기록된 가장 최근 마지막 포착 세션(`YYYY-MM-DD`). 기록이 하나도 없으면 `null`.
     * 알림 발송기가 "그 세션이 이미 기록됐는가"를 가리는 영속 표식이다(Redis 표식은 사라질 수 있다).
     */
    latestRecordedSession(market: SignalHistoryMarket): Promise<string | null>;
    /**
     * `market`에서 `sessionDate`에 **처음** 포착된(에피소드가 그날 시작된) 행 중 `signalTypes`에 드는 것.
     * 신호별 페이지가 읽는 행과 같아서 메일과 페이지가 어긋나지 않는다(기본키 범위 스캔).
     */
    findEpisodesStartedOn(
        market: SignalHistoryMarket,
        sessionDate: string,
        signalTypes: readonly string[]
    ): Promise<SignalEpisodeStartedRow[]>;
}

/**
 * `signal_events`(신호 에피소드) 저장소. 기록은 `seo-prewarm` 크론의 `recordSignalHistory`가 세션당 한 번
 * 쓴다 — 이어진 에피소드를 찾고(`openEpisodeKeys`), 새로 열거나(`insertEpisodes`) 늘린다(`extendEpisodes`).
 * 모든 쓰기는 같은 날 재실행에 멱등이다. 일시적 DB 오류는 `withRetry`로 재시도한다.
 */
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

    async listRecentEpisodes(
        signalType: string,
        sinceSession: string,
        limit: number
    ): Promise<SignalEpisodeRow[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        market: signalEvents.market,
                        symbol: signalEvents.symbol,
                        koreanName: signalEvents.koreanName,
                        sessionDate: signalEvents.sessionDate,
                        lastSeenSession: signalEvents.lastSeenSession,
                        changePercent: signalEvents.changePercent,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.signalType, signalType),
                            gte(signalEvents.sessionDate, sinceSession)
                        )
                    )
                    .orderBy(
                        desc(signalEvents.sessionDate),
                        desc(sql`abs(${signalEvents.changePercent})`),
                        signalEvents.symbol
                    )
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        // `market` 컬럼은 기록기가 'us' | 'kr'만 쓴다 — 다른 값이 섞이면(수동 입력 등) 버린다.
        return rows.flatMap(row =>
            row.market === 'us' || row.market === 'kr'
                ? [{ ...row, market: row.market }]
                : []
        );
    }

    async recentCountsByType(
        signalTypes: readonly string[],
        sinceSession: string
    ): Promise<SignalHubCount[]> {
        if (signalTypes.length === 0) return [];
        return withRetry(
            () =>
                this.db
                    .select({
                        signalType: signalEvents.signalType,
                        symbols: sql<number>`count(distinct (${signalEvents.market}, ${signalEvents.symbol}))::int`,
                        latestSession: sql<string>`max(${signalEvents.lastSeenSession})::text`,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            inArray(signalEvents.signalType, [...signalTypes]),
                            gte(signalEvents.sessionDate, sinceSession)
                        )
                    )
                    .groupBy(signalEvents.signalType),
            DB_TRANSIENT_RETRY
        );
    }

    async latestRecordedSession(
        market: SignalHistoryMarket
    ): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({
                        latest: sql<
                            string | null
                        >`max(${signalEvents.lastSeenSession})::text`,
                    })
                    .from(signalEvents)
                    .where(eq(signalEvents.market, market)),
            DB_TRANSIENT_RETRY
        );
        return row?.latest ?? null;
    }

    async findEpisodesStartedOn(
        market: SignalHistoryMarket,
        sessionDate: string,
        signalTypes: readonly string[]
    ): Promise<SignalEpisodeStartedRow[]> {
        if (signalTypes.length === 0) return [];
        return withRetry(
            () =>
                this.db
                    .select({
                        symbol: signalEvents.symbol,
                        signalType: signalEvents.signalType,
                        changePercent: signalEvents.changePercent,
                        koreanName: signalEvents.koreanName,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.market, market),
                            eq(signalEvents.sessionDate, sessionDate),
                            inArray(signalEvents.signalType, [...signalTypes])
                        )
                    )
                    .orderBy(signalEvents.symbol, signalEvents.signalType),
            DB_TRANSIENT_RETRY
        );
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

/**
 * 사이트맵용 — 신호마다 `sinceSession` 이후 첫 포착된 종목 수와 가장 최근 마지막 포착 세션.
 * DB 읽기는 `unstable_cache` 안에서만 하고(사이트맵 라우트도 ISR), 실패는 밖에서 빈 목록으로 바꾼다 —
 * 색인할 수 있는지 모르면 사이트맵에 싣지 않는 쪽으로 기운다. 기록기가 태그를 무효화한다.
 */
export async function loadSignalHubCounts(
    signalTypes: readonly string[],
    sinceSession: string
): Promise<readonly SignalHubCount[]> {
    if (isOfflineBuild() || isDatabaseMissingAtBuild()) return [];
    try {
        return await unstable_cache(
            () => {
                const { db } = getDatabaseClient();
                return new DrizzleSignalHistoryRepository(
                    db
                ).recentCountsByType(signalTypes, sinceSession);
            },
            [
                'signal-hub',
                'counts',
                'v2',
                [...signalTypes].sort().join(','),
                sinceSession,
            ],
            { revalidate: SECONDS_PER_HOUR, tags: [SIGNAL_HISTORY_CACHE_TAG] }
        )();
    } catch (error) {
        console.error(
            '[signal-hub] 사이트맵 집계 실패',
            redactDbErrorForLog(error)
        );
        return [];
    }
}
