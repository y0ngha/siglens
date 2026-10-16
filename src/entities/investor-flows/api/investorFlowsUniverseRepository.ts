import 'server-only';
import { and, asc, eq, gt, inArray, isNull, notLike, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    cusipSymbolMap,
    investorFlowsState,
    koreanTickers,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    type CusipConflict,
    resolveCusipMapConflicts,
} from '../lib/cusipMapConflicts';
import {
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
    INVESTOR_FLOWS_US_EXCHANGES,
} from '../lib/investorFlowsPolicy';
import { KR_SYMBOL_LIKE_PATTERNS } from '@/entities/ticker/api';

export interface CusipMapRow {
    cusip: string;
    symbol: string;
    source: 'fmp' | 'openfigi';
}

/** `upsertCusipMap`의 결과 — 실제로 쓴 행(CUSIP당 하나)과, 한 CUSIP을 여러 심볼이 주장해 버린 건. */
export interface CusipMapUpsertResult {
    written: CusipMapRow[];
    conflicts: CusipConflict[];
}

/** 유니버스의 CUSIP 한 건 — 포지션이 저장하는 대리키 `id`와 심볼. */
export interface UniverseCusip {
    id: number;
    symbol: string;
}

/** 유니버스 — 13F 필터가 쓰는 CUSIP→id 맵과 FINRA 필터가 쓰는 심볼 목록. */
export interface InvestorFlowsUniverse {
    cusips: ReadonlyMap<string, UniverseCusip>;
    symbols: string[];
    /**
     * 이 스냅샷을 읽은 시각 — **DB 시계**(`now()`, 같은 문장에서 읽는다). 이 유니버스로 파싱한 제출의 원장
     * `universe_stamp`가 되어 CUSIP별 baseline 판정에 쓰인다(`aggregateSql.ts`). `created_at`과 같은 시계라야 비교가 맞다.
     */
    loadedAt: string;
}

/** 기존 매핑을 FMP와 다시 대조할 후보. */
export interface RecheckCandidate {
    id: number;
    cusip: string;
    symbol: string;
}

/**
 * CUSIP↔심볼 맵(= 유니버스)과, 맵에 아직 없는 미국 종목 후보 조회.
 *
 * 후보의 출처는 티커 DB(`korean_tickers` — 이름과 달리 미국·한국 종목을 함께 담는다)다. 거래소가
 * 미국 3곳이고 국내 접미사(`.KS`·`.KQ`)가 없는 행만 후보로 삼는다. ETF·펀드는 DB만으로 가릴 수 없어
 * FMP profile의 플래그로 걸러진다(`syncCusipMap`).
 */
export class DrizzleInvestorFlowsUniverseRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async loadUniverse(): Promise<InvestorFlowsUniverse> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: cusipSymbolMap.id,
                        cusip: cusipSymbolMap.cusip,
                        symbol: cusipSymbolMap.symbol,
                        loadedAt: sql<string>`now()::text`,
                    })
                    .from(cusipSymbolMap),
            DB_TRANSIENT_RETRY
        );
        return {
            cusips: new Map(
                rows.map(row => [row.cusip, { id: row.id, symbol: row.symbol }])
            ),
            symbols: [...new Set(rows.map(row => row.symbol))],
            // 한 문장이라 모든 행이 같은 값이다. 빈 맵이면 호출부가 먼저 멈추지만, 앱 시계가 아니라 DB 시계로 채워 둔다.
            loadedAt: rows[0]?.loadedAt ?? (await this.databaseNow()),
        };
    }

    private async databaseNow(): Promise<string> {
        const [row] = await withRetry(
            () =>
                this.db.execute(sql`SELECT now()::text AS now`) as Promise<
                    { now: string }[]
                >,
            DB_TRANSIENT_RETRY
        );
        return row?.now ?? new Date().toISOString();
    }

    /** 맵의 행 수 — "전수 한 바퀴 완료" 판정의 최소 규모 확인용. */
    async countMapped(): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ n: sql<number>`count(*)::int` })
                    .from(cusipSymbolMap),
            DB_TRANSIENT_RETRY
        );
        return row?.n ?? 0;
    }

    /** 작은 key/value 상태(`investor_flows_state`) — 전수 한 바퀴 완료 표식 등. */
    async getState(key: string): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ value: investorFlowsState.value })
                    .from(investorFlowsState)
                    .where(eq(investorFlowsState.key, key)),
            DB_TRANSIENT_RETRY
        );
        return row?.value ?? null;
    }

    /**
     * 키가 **없을 때만** 기록한다(set-once) — 이미 있으면 값도 `updated_at`도 건드리지 않는다. 한 번 선 사실이
     * 덮어써지지 않게 하는 용도다.
     */
    async setStateIfAbsent(key: string, value: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(investorFlowsState)
                    .values({ key, value })
                    .onConflictDoNothing({ target: investorFlowsState.key }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 맵에 심볼이 없는 미국 종목을 심볼 오름차순으로 `afterSymbol` 다음부터 `limit`개.
     * 호출부가 `afterSymbol`을 옮겨 가며 페이지를 넘긴다 — 시도했다 실패한 심볼이 앞쪽을 영구히
     * 차지해 뒤쪽이 굶는 것을 막는다.
     */
    async listUnmappedUsSymbols(
        afterSymbol: string,
        limit: number
    ): Promise<string[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ symbol: koreanTickers.symbol })
                    .from(koreanTickers)
                    .where(
                        and(
                            gt(koreanTickers.symbol, afterSymbol),
                            isNull(koreanTickers.delistedAt),
                            inArray(koreanTickers.exchange, [
                                ...INVESTOR_FLOWS_US_EXCHANGES,
                            ]),
                            ...KR_SYMBOL_LIKE_PATTERNS.map(pattern =>
                                notLike(koreanTickers.symbol, pattern)
                            ),
                            sql`NOT EXISTS (
                                SELECT 1 FROM cusip_symbol_map m
                                WHERE m.symbol = ${koreanTickers.symbol}
                            )`
                        )
                    )
                    .orderBy(asc(koreanTickers.symbol))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => row.symbol);
    }

    /**
     * 매핑을 upsert한다. 쓰기 전에 **입력 전체**에서 CUSIP당 한 행만 남긴다(`resolveCusipMapConflicts`) — 같은 CUSIP이 한 문장에
     * 두 번 들어가면 21000으로 실행 전체가 실패한다. 이미 맵에 있는 CUSIP을 다른 심볼이 주장하면, 맵의 심볼이 아직 상장된 미국
     * 종목일 때 그 심볼을 지킨다(두 상장이 매 실행 맵을 번갈아 덮지 않게). 상장 폐지된 심볼이면 새 심볼이 덮는다(티커 변경).
     * 버린 건은 `conflicts`로 돌려주어 호출부가 로그와 miss 표식을 맡는다.
     */
    async upsertCusipMap(
        rows: readonly CusipMapRow[]
    ): Promise<CusipMapUpsertResult> {
        if (rows.length === 0) return { written: [], conflicts: [] };
        const { rows: written, conflicts } = resolveCusipMapConflicts(
            rows,
            await this.findLiveMappedSymbolsInConflict(rows)
        );
        for (
            let i = 0;
            i < written.length;
            i += INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
        ) {
            const chunk = written.slice(
                i,
                i + INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
            );
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db
                        .insert(cusipSymbolMap)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: cusipSymbolMap.cusip,
                            set: {
                                symbol: sql`excluded.symbol`,
                                source: sql`excluded.source`,
                                updatedAt: sql`now()`,
                            },
                            setWhere: sql`${cusipSymbolMap.symbol} IS DISTINCT FROM excluded.symbol OR ${cusipSymbolMap.source} IS DISTINCT FROM excluded.source`,
                        }),
                DB_TRANSIENT_RETRY
            );
        }
        return { written, conflicts };
    }

    /**
     * `rows`의 CUSIP 중 맵에 **다른 심볼**로 이미 있고 그 심볼이 아직 상장된 미국 종목(`listUnmappedUsSymbols`와 같은 거래소·상장
     * 조건)인 것 → 그 심볼. 다른 심볼과 겹치는 CUSIP이 없으면 티커 DB는 읽지 않는다.
     */
    private async findLiveMappedSymbolsInConflict(
        rows: readonly CusipMapRow[]
    ): Promise<Map<string, string>> {
        const mapped = await withRetry(
            () =>
                this.db
                    .select({
                        cusip: cusipSymbolMap.cusip,
                        symbol: cusipSymbolMap.symbol,
                    })
                    .from(cusipSymbolMap)
                    .where(
                        inArray(cusipSymbolMap.cusip, [
                            ...new Set(rows.map(row => row.cusip)),
                        ])
                    ),
            DB_TRANSIENT_RETRY
        );
        const contested = mapped.filter(existing =>
            rows.some(
                row =>
                    row.cusip === existing.cusip &&
                    row.symbol !== existing.symbol
            )
        );
        if (contested.length === 0) return new Map();
        const live = await withRetry(
            () =>
                this.db
                    .select({ symbol: koreanTickers.symbol })
                    .from(koreanTickers)
                    .where(
                        and(
                            inArray(koreanTickers.symbol, [
                                ...new Set(contested.map(m => m.symbol)),
                            ]),
                            isNull(koreanTickers.delistedAt),
                            inArray(koreanTickers.exchange, [
                                ...INVESTOR_FLOWS_US_EXCHANGES,
                            ])
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        const liveSymbols = new Set(live.map(row => row.symbol));
        return new Map(
            contested
                .filter(m => liveSymbols.has(m.symbol))
                .map(m => [m.cusip, m.symbol])
        );
    }

    /** `fmp` 출처 매핑 중 가장 오래전에(또는 한 번도) 대조하지 않은 것부터 `limit`개. */
    async listRecheckCandidates(limit: number): Promise<RecheckCandidate[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        id: cusipSymbolMap.id,
                        cusip: cusipSymbolMap.cusip,
                        symbol: cusipSymbolMap.symbol,
                    })
                    .from(cusipSymbolMap)
                    .where(eq(cusipSymbolMap.source, 'fmp'))
                    .orderBy(
                        sql`${cusipSymbolMap.checkedAt} ASC NULLS FIRST`,
                        cusipSymbolMap.id
                    )
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    /** 대조를 마친 매핑의 `checked_at`을 지금으로. */
    async markChecked(ids: readonly number[]): Promise<void> {
        if (ids.length === 0) return;
        await withRetry(
            () =>
                this.db
                    .update(cusipSymbolMap)
                    .set({ checkedAt: sql`now()` })
                    .where(inArray(cusipSymbolMap.id, [...ids])),
            DB_TRANSIENT_RETRY
        );
    }

    async findExistingCusips(cusips: readonly string[]): Promise<Set<string>> {
        if (cusips.length === 0) return new Set();
        const rows = await withRetry(
            () =>
                this.db
                    .select({ cusip: cusipSymbolMap.cusip })
                    .from(cusipSymbolMap)
                    .where(inArray(cusipSymbolMap.cusip, [...cusips])),
            DB_TRANSIENT_RETRY
        );
        return new Set(rows.map(row => row.cusip));
    }
}
