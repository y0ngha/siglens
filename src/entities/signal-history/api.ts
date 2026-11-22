import 'server-only';

import {
    and,
    desc,
    eq,
    gte,
    inArray,
    lt,
    lte,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    signalEvents,
    signalScanCursors,
    signalScanSessions,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    LastSeenUpdate,
    OpenEpisode,
    ScanCursor,
    ScanEpisodeInsert,
    ScanFailureOutcome,
    ScanProgressPruneResult,
    ScanSessionRow,
    SignalEpisodeInsert,
    SignalEpisodeRow,
    SignalEpisodeKey,
    SignalEpisodeStartedRow,
    SignalLatestEpisodeRow,
    SignalHistoryMarket,
    SignalHubCount,
    SignalHubSymbolCounts,
    SymbolScanWrite,
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
    /**
     * 신호 페이지 목록 — 종목마다 가장 최근 에피소드 한 줄만 고르고, 시장 안에서 첫 포착 최신순(같은 날이면
     * 등락률 크기순)으로 `perMarketLimit`개까지 돌려준다. 시장별로 따로 자르므로 한쪽이 다른 쪽을 밀어내지
     * 않는다. 정렬은 미국 → 한국, 시장 안에서는 위 순서다.
     */
    listHubRows(
        signalType: string,
        sinceSession: string,
        perMarketLimit: number
    ): Promise<SignalEpisodeRow[]>;
    /**
     * `market`의 가장 최근 **완료된** 세션 D(`signal_scan_sessions.completed_at`이 채워진 가장 늦은 세션)까지
     * 시작돼 D 이후에도 이어진(`last_seen_session >= D`) 에피소드 중 `signalTypes`에 드는 것 — 처음 포착된 세션이 최신인 순, 같은 날이면 등락률 크기순,
     * 최대 `limit`개. 완료된 세션이 없으면 빈 목록(표가 아직 없는 환경은 `42P01`을 던진다 — 호출부가
     * 대신할 데이터원으로 넘어간다). 가이드 라이브 블록이 읽는다.
     *
     * 비용: 기본키 `(market, session_date, symbol, signal_type)`의 `session_date <= D` 범위를 **거꾸로** 훑으며
     * `last_seen_session >= D`를 행 필터로 거르고, 정렬 첫 키가 `session_date desc`라 `limit`개를 채우면 멈춘다.
     * 2026-11-22 로컬 EXPLAIN ANALYZE(미국 12만 행 합성, 신호 한 종류): 정렬 없는 인덱스 역방향 스캔 312행,
     * 0.4ms. 최악은 최근 첫 포착 행 중 이어진 것이 적어 더 먼 과거까지 훑는 경우인데, 에피소드가 끊기지 않고
     * 오래 이어지는 상태 신호(52주 신고가 등)도 `limit`이 작아 수천 행 안에서 끝나고 결과는 1시간 캐시된다.
     * 그래서 지금은 인덱스를 더하지 않는다. 표가 수백만 행으로 커져 이 스캔이 눈에 띄게 느려지면
     * `(market, last_seen_session)` 인덱스를 추가한다(마이그레이션은 그때).
     */
    listLatestSessionEpisodes(
        signalTypes: readonly string[],
        market: SignalHistoryMarket,
        limit: number
    ): Promise<SignalLatestEpisodeRow[]>;
    /**
     * `signalType`이 `sinceSession` 이후 첫 포착된 서로 다른 종목 수 — 시장별. 페이지 색인 판정과 사이트맵
     * 집계(`recentCountsByType`)가 같은 수를 보게, 목록 상한과 무관하게 전체를 센다.
     */
    countHubSymbols(
        signalType: string,
        sinceSession: string
    ): Promise<SignalHubSymbolCounts>;
}

/**
 * 종목별 기록 진행(`signal_scan_cursors`)과 세션 완료 표식(`signal_scan_sessions`) 저장소. 한 세션을 여러
 * 실행에 걸쳐 기록하고, 놓친 세션을 따라잡고, 발송기가 "끝까지 기록됐는가"를 읽는 데 쓴다.
 */
export interface SignalScanProgressRepository {
    /** `symbols`의 진행 표식. 표식이 없는 종목은 맵에 없다(처음 기록하는 종목). */
    loadScanCursors(
        market: SignalHistoryMarket,
        symbols: readonly string[]
    ): Promise<Map<string, ScanCursor>>;
    /**
     * 실패·낡은 데이터 시도를 한 번 센다. 같은 세션이면 시도 횟수가 늘고, 세션이 바뀌면 1부터 다시 센다.
     * 기록된 세션(`last_session`)은 건드리지 않는다.
     */
    recordScanFailure(
        market: SignalHistoryMarket,
        symbol: string,
        sessionDate: string,
        outcome: ScanFailureOutcome
    ): Promise<void>;
    /** 종목 한 개의 쓰기 묶음을 한 트랜잭션으로 반영한다. */
    applySymbolScan(write: SymbolScanWrite): Promise<void>;
    /**
     * 마지막 포착 세션이 `sinceSession` 이상인 그 종목의 에피소드.
     *
     * `options.relabelCutover`를 주면 그 시각 이전에 기록된 옛 골든·데드크로스(20/50) 행의 `signalType`을
     * 새 이름(`RELABEL_SIGNAL_TYPES`)으로 돌려준다 — `applySymbolScan`의 이름 바꾸기와 같은 조건이다.
     * 처음 기록하는 종목의 계획 수립(app-2)은 같은 시각을 이 인자와 `SymbolScanWrite.relabelCutover`에
     * 넘겨야, 이름 바꾸기 전 행을 보고도 올바른 에피소드를 이어 간다.
     */
    openEpisodesSince(
        market: SignalHistoryMarket,
        symbol: string,
        sinceSession: string,
        options?: { readonly relabelCutover?: string }
    ): Promise<OpenEpisode[]>;
    /** 세션 집계를 저장한다. 완료 시각은 처음 채워진 값이 유지된다(다시 불러도 바뀌지 않는다). */
    upsertScanSession(row: ScanSessionRow): Promise<void>;
    /** 끝까지 기록이 끝난 가장 최근 세션(`YYYY-MM-DD`). 없으면 null. */
    latestCompletedSession(market: SignalHistoryMarket): Promise<string | null>;
    /**
     * `cutoffSession`보다 이른 세션 집계를 지우고, 대상 목록에서 빠진 지 30일이 넘은 종목의 진행 표식을
     * 지운다.
     */
    pruneScanProgress(
        cutoffSession: string,
        universe: Readonly<Record<SignalHistoryMarket, readonly string[]>>
    ): Promise<ScanProgressPruneResult>;
}

/**
 * 옛 20/50 골든·데드크로스 이름 → 새 이름. 이름 바꾸기(`applySymbolScan`)와 `openEpisodesSince`의 조회가
 * 같은 표를 쓴다.
 */
export const RELABEL_SIGNAL_TYPES = {
    golden_cross: 'short_ma_bullish_cross',
    death_cross: 'short_ma_bearish_cross',
} as const;

/** `CASE <신호 열> WHEN 옛 이름 THEN 새 이름 … ELSE <신호 열> END` — 표 한 곳에서 만든다. */
function relabelCase() {
    const whens = sql.join(
        Object.entries(RELABEL_SIGNAL_TYPES).map(
            ([legacy, renamed]) => sql`WHEN ${legacy} THEN ${renamed}`
        ),
        sql` `
    );
    return sql`CASE ${signalEvents.signalType} ${whens} ELSE ${signalEvents.signalType} END`;
}

/**
 * 이름을 바꿀 옛 행의 조건 — 옛 이름이고 `cutover` 이전에 기록된 행. 새 코드가 쓴 50/200 골든·데드크로스
 * 행(기록 시각이 `cutover` 이후)은 이 조건에 걸리지 않으므로, 캐시 정리로 다시 처음 기록되는 종목도 진짜
 * 골든·데드크로스를 잃지 않는다.
 */
function legacyRowCondition(cutover: string) {
    return and(
        inArray(signalEvents.signalType, Object.keys(RELABEL_SIGNAL_TYPES)),
        sql`${signalEvents.computedAt} < ${cutover}::timestamptz`
    );
}

/** 기본키(시장·첫 세션·종목·신호)가 같은 입력은 하나만 남긴다 — 같은 문장 안의 중복은 DB가 못 거른다. */
function dedupeByPrimaryKey(
    rows: readonly ScanEpisodeInsert[]
): ScanEpisodeInsert[] {
    const byKey = new Map(
        rows.map(
            row =>
                [
                    `${row.market}\u0000${row.sessionDate}\u0000${row.symbol}\u0000${row.signalType}`,
                    row,
                ] as const
        )
    );
    return [...byKey.values()];
}

type SignalHistoryTransaction = Parameters<
    Parameters<SiglensDatabase['transaction']>[0]
>[0];

/**
 * `rebuildFrom` 이전의 옛 골든·데드크로스(20/50) 행을 단기 이평 교차 이름으로 바꾼다(`legacyRowCondition`).
 *
 * `NOT EXISTS`를 남긴 이유: 옛 행과 새 이름 행이 같은 (시장, 종목, 세션)에 함께 있으면 기본키 충돌로 트랜잭션
 * 전체가 실패해 그 종목이 영원히 기록되지 않는다. 기록 시각 조건으로 새 코드의 행은 이미 제외되지만, 이전
 * 첫 기록이 다른 구간으로 일부만 바꿔 놓은 경우처럼 두 이름이 공존할 수 있는 길이 완전히 닫히지는 않아
 * 값싼 방어로 둔다. 이때 옛 행은 그대로 남는다.
 */
async function relabelBefore(
    tx: SignalHistoryTransaction,
    market: SignalHistoryMarket,
    symbol: string,
    rebuildFrom: string,
    cutover: string
): Promise<void> {
    await tx
        .update(signalEvents)
        .set({ signalType: relabelCase() })
        .where(
            and(
                eq(signalEvents.market, market),
                eq(signalEvents.symbol, symbol),
                lt(signalEvents.sessionDate, rebuildFrom),
                legacyRowCondition(cutover),
                sql`NOT EXISTS (
                    SELECT 1 FROM signal_events renamed
                    WHERE renamed.market = ${signalEvents.market}
                      AND renamed.symbol = ${signalEvents.symbol}
                      AND renamed.session_date = ${signalEvents.sessionDate}
                      AND renamed.signal_type = ${relabelCase()}
                )`
            )
        );
}

/** 이미 있는 에피소드의 마지막 포착 세션을 한 문장으로 늘린다(줄어드는 갱신은 거른다). */
function lastSeenUpdateStatement(
    market: SignalHistoryMarket,
    symbol: string,
    updates: readonly LastSeenUpdate[]
) {
    const values = sql.join(
        updates.map(
            u =>
                sql`(${u.signalType}, ${u.sessionDate}::date, ${u.lastSeenSession}::date)`
        ),
        sql`, `
    );
    return sql`
        UPDATE signal_events AS e
        SET last_seen_session = v.last_seen
        FROM (VALUES ${values}) AS v(signal_type, session_date, last_seen)
        WHERE e.market = ${market}
          AND e.symbol = ${symbol}
          AND e.signal_type = v.signal_type
          AND e.session_date = v.session_date
          AND e.last_seen_session < v.last_seen`;
}

/**
 * `signal_events`(신호 에피소드) 저장소. 기록은 `seo-prewarm` 크론의 `recordSignalHistory`가 세션당 한 번
 * 쓴다 — 이어진 에피소드를 찾고(`openEpisodeKeys`), 새로 열거나(`insertEpisodes`) 늘린다(`extendEpisodes`).
 * 모든 쓰기는 같은 날 재실행에 멱등이다. 일시적 DB 오류는 `withRetry`로 재시도한다.
 */
export class DrizzleSignalHistoryRepository
    implements SignalHistoryRepository, SignalScanProgressRepository
{
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

    async listHubRows(
        signalType: string,
        sinceSession: string,
        perMarketLimit: number
    ): Promise<SignalEpisodeRow[]> {
        // 종목마다 가장 최근 에피소드(기본키에 세션이 들어 있어 동률이 없다) → 시장별 순위 → 상한.
        const latest = this.db
            .selectDistinctOn([signalEvents.market, signalEvents.symbol], {
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
                signalEvents.market,
                signalEvents.symbol,
                desc(signalEvents.sessionDate)
            )
            .as('latest');
        const ranked = this.db
            .select({
                market: latest.market,
                symbol: latest.symbol,
                koreanName: latest.koreanName,
                sessionDate: latest.sessionDate,
                lastSeenSession: latest.lastSeenSession,
                changePercent: latest.changePercent,
                rank: sql<number>`row_number() over (partition by ${latest.market} order by ${latest.sessionDate} desc, abs(${latest.changePercent}) desc, ${latest.symbol})`.as(
                    'rank'
                ),
            })
            .from(latest)
            .as('ranked');
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        market: ranked.market,
                        symbol: ranked.symbol,
                        koreanName: ranked.koreanName,
                        sessionDate: ranked.sessionDate,
                        lastSeenSession: ranked.lastSeenSession,
                        changePercent: ranked.changePercent,
                    })
                    .from(ranked)
                    .where(lte(ranked.rank, perMarketLimit))
                    // 미국 → 한국(`us` < `kr`의 반대라 내림차순), 시장 안에서는 순위 순서.
                    .orderBy(
                        desc(ranked.market),
                        desc(ranked.sessionDate),
                        desc(sql`abs(${ranked.changePercent})`),
                        ranked.symbol
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.flatMap(row =>
            row.market === 'us' || row.market === 'kr'
                ? [{ ...row, market: row.market }]
                : []
        );
    }

    async listLatestSessionEpisodes(
        signalTypes: readonly string[],
        market: SignalHistoryMarket,
        limit: number
    ): Promise<SignalLatestEpisodeRow[]> {
        if (signalTypes.length === 0 || limit <= 0) return [];
        const latestCompleted = sql`(
            SELECT max(${signalScanSessions.sessionDate})
            FROM ${signalScanSessions}
            WHERE ${signalScanSessions.market} = ${market}
              AND ${signalScanSessions.completedAt} IS NOT NULL
        )`;
        return withRetry(
            () =>
                this.db
                    .select({
                        symbol: signalEvents.symbol,
                        koreanName: signalEvents.koreanName,
                        signalType: signalEvents.signalType,
                        sessionDate: signalEvents.sessionDate,
                        changePercent: signalEvents.changePercent,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.market, market),
                            inArray(signalEvents.signalType, [...signalTypes]),
                            // 가장 최근 완료 세션 D 기준으로, D까지 시작됐고(`session_date <= D`) D 이후에도
                            // 이어진(`last_seen_session >= D`) 에피소드. `>=`인 이유: 다음 세션 D+1을 여러
                            // 실행에 나눠 기록하는 동안 이미 늘어난 에피소드(last_seen = D+1)와 아직 못 만난
                            // 에피소드(last_seen = D)가 모두 보여야 한다 — `=`로 두면 D+1이 일부만 기록된
                            // 동안 이어진 에피소드가 목록에서 사라진다. `session_date <= D`는 D+1에 새로
                            // 열린(미완료 세션의) 행이 먼저 나오지 않게 한다. D의 서브쿼리가 null(완료 세션
                            // 없음)이면 두 비교가 모두 거짓이라 빈 목록이다.
                            sql`${signalEvents.lastSeenSession} >= ${latestCompleted}`,
                            sql`${signalEvents.sessionDate} <= ${latestCompleted}`
                        )
                    )
                    .orderBy(
                        desc(signalEvents.sessionDate),
                        desc(sql`abs(${signalEvents.changePercent})`),
                        signalEvents.symbol,
                        signalEvents.signalType
                    )
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    async countHubSymbols(
        signalType: string,
        sinceSession: string
    ): Promise<SignalHubSymbolCounts> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        market: signalEvents.market,
                        symbols: sql<number>`count(distinct ${signalEvents.symbol})::int`,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.signalType, signalType),
                            gte(signalEvents.sessionDate, sinceSession)
                        )
                    )
                    .groupBy(signalEvents.market),
            DB_TRANSIENT_RETRY
        );
        const countOf = (market: SignalHistoryMarket): number =>
            rows.find(row => row.market === market)?.symbols ?? 0;
        return { us: countOf('us'), kr: countOf('kr') };
    }

    async loadScanCursors(
        market: SignalHistoryMarket,
        symbols: readonly string[]
    ): Promise<Map<string, ScanCursor>> {
        if (symbols.length === 0) return new Map();
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        symbol: signalScanCursors.symbol,
                        lastSession: signalScanCursors.lastSession,
                        attemptSession: signalScanCursors.attemptSession,
                        attempts: signalScanCursors.attempts,
                        lastOutcome: signalScanCursors.lastOutcome,
                    })
                    .from(signalScanCursors)
                    .where(
                        and(
                            eq(signalScanCursors.market, market),
                            inArray(signalScanCursors.symbol, [...symbols])
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return new Map(
            rows.map(({ symbol, ...cursor }) => [symbol, cursor] as const)
        );
    }

    async recordScanFailure(
        market: SignalHistoryMarket,
        symbol: string,
        sessionDate: string,
        outcome: ScanFailureOutcome
    ): Promise<void> {
        // 한 문장 upsert — 읽고 쓰는 사이에 다른 실행이 끼어도 시도 횟수가 어긋나지 않는다. 기본키(시장,
        // 종목)가 곧 소유 조건이다.
        await withRetry(
            () =>
                this.db
                    .insert(signalScanCursors)
                    .values({
                        market,
                        symbol,
                        attemptSession: sessionDate,
                        attempts: 1,
                        lastOutcome: outcome,
                    })
                    .onConflictDoUpdate({
                        target: [
                            signalScanCursors.market,
                            signalScanCursors.symbol,
                        ],
                        set: {
                            attempts: sql`CASE WHEN ${signalScanCursors.attemptSession} = ${sessionDate}::date THEN ${signalScanCursors.attempts} + 1 ELSE 1 END`,
                            attemptSession: sql`${sessionDate}::date`,
                            lastOutcome: outcome,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    async applySymbolScan(write: SymbolScanWrite): Promise<void> {
        const { market, symbol, session, rebuildFrom } = write;
        const inserts = dedupeByPrimaryKey(write.inserts);
        await withRetry(
            () =>
                this.db.transaction(async tx => {
                    if (rebuildFrom !== null) {
                        await tx
                            .delete(signalEvents)
                            .where(
                                and(
                                    eq(signalEvents.market, market),
                                    eq(signalEvents.symbol, symbol),
                                    gte(signalEvents.sessionDate, rebuildFrom)
                                )
                            );
                        if (write.relabelCutover !== null) {
                            await relabelBefore(
                                tx,
                                market,
                                symbol,
                                rebuildFrom,
                                write.relabelCutover
                            );
                        }
                    }
                    if (write.lastSeenUpdates.length > 0) {
                        await tx.execute(
                            lastSeenUpdateStatement(
                                market,
                                symbol,
                                write.lastSeenUpdates
                            )
                        );
                    }
                    if (inserts.length > 0) {
                        await tx
                            .insert(signalEvents)
                            .values(
                                inserts.map(row => ({
                                    ...row,
                                    computedAt: new Date(row.computedAt),
                                }))
                            )
                            .onConflictDoNothing();
                    }
                    await tx
                        .insert(signalScanCursors)
                        .values({
                            market,
                            symbol,
                            lastSession: session,
                            attemptSession: null,
                            attempts: 0,
                            lastOutcome: 'recorded',
                        })
                        .onConflictDoUpdate({
                            target: [
                                signalScanCursors.market,
                                signalScanCursors.symbol,
                            ],
                            set: {
                                lastSession: session,
                                attemptSession: null,
                                attempts: 0,
                                lastOutcome: 'recorded',
                                updatedAt: sql`now()`,
                            },
                        });
                }),
            DB_TRANSIENT_RETRY
        );
    }

    async openEpisodesSince(
        market: SignalHistoryMarket,
        symbol: string,
        sinceSession: string,
        options: { readonly relabelCutover?: string } = {}
    ): Promise<OpenEpisode[]> {
        const { relabelCutover } = options;
        const signalType =
            relabelCutover === undefined
                ? sql<string>`${signalEvents.signalType}`
                : sql<string>`CASE WHEN ${legacyRowCondition(relabelCutover)} THEN ${relabelCase()} ELSE ${signalEvents.signalType} END`;
        return withRetry(
            () =>
                this.db
                    .select({
                        signalType,
                        sessionDate: signalEvents.sessionDate,
                        lastSeenSession: signalEvents.lastSeenSession,
                    })
                    .from(signalEvents)
                    .where(
                        and(
                            eq(signalEvents.market, market),
                            eq(signalEvents.symbol, symbol),
                            gte(signalEvents.lastSeenSession, sinceSession)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    async upsertScanSession(row: ScanSessionRow): Promise<void> {
        const completedAt =
            row.completedAt === null ? null : new Date(row.completedAt);
        await withRetry(
            () =>
                this.db
                    .insert(signalScanSessions)
                    .values({
                        market: row.market,
                        sessionDate: row.sessionDate,
                        universeSize: row.universeSize,
                        recorded: row.recorded,
                        failed: row.failed,
                        stale: row.stale,
                        completedAt,
                    })
                    .onConflictDoUpdate({
                        target: [
                            signalScanSessions.market,
                            signalScanSessions.sessionDate,
                        ],
                        set: {
                            universeSize: row.universeSize,
                            recorded: row.recorded,
                            failed: row.failed,
                            stale: row.stale,
                            // 완료 시각은 한 번만 정한다 — 이미 있으면 그대로 두고, 나중 호출이 덮어쓰지도 되돌리지도 않는다.
                            completedAt: sql`coalesce(${signalScanSessions.completedAt}, ${row.completedAt}::timestamptz)`,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    async latestCompletedSession(
        market: SignalHistoryMarket
    ): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({
                        latest: sql<
                            string | null
                        >`max(${signalScanSessions.sessionDate})::text`,
                    })
                    .from(signalScanSessions)
                    .where(
                        and(
                            eq(signalScanSessions.market, market),
                            sql`${signalScanSessions.completedAt} is not null`
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return row?.latest ?? null;
    }

    async pruneScanProgress(
        cutoffSession: string,
        universe: Readonly<Record<SignalHistoryMarket, readonly string[]>>
    ): Promise<ScanProgressPruneResult> {
        const droppedSessions = await withRetry(
            () =>
                this.db
                    .delete(signalScanSessions)
                    .where(lt(signalScanSessions.sessionDate, cutoffSession))
                    .returning({ market: signalScanSessions.market }),
            DB_TRANSIENT_RETRY
        );
        // 시장마다 "이 시장의 대상이 아닌 종목" 조건을 만든다. 대상이 빈 시장은 시장 전체가 해당한다.
        const outsideUniverse = (market: SignalHistoryMarket) =>
            universe[market].length === 0
                ? eq(signalScanCursors.market, market)
                : and(
                      eq(signalScanCursors.market, market),
                      notInArray(signalScanCursors.symbol, [
                          ...universe[market],
                      ])
                  );
        const droppedCursors = await withRetry(
            () =>
                this.db
                    .delete(signalScanCursors)
                    .where(
                        and(
                            sql`${signalScanCursors.updatedAt} < now() - interval '30 days'`,
                            or(outsideUniverse('us'), outsideUniverse('kr'))
                        )
                    )
                    .returning({ symbol: signalScanCursors.symbol }),
            DB_TRANSIENT_RETRY
        );
        return {
            sessions: droppedSessions.length,
            cursors: droppedCursors.length,
        };
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
