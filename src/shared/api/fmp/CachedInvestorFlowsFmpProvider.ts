import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    MS_PER_DAY,
    INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS,
    INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS,
} from '@/shared/config/time';
import type {
    InvestorFlowsFmpProvider,
    RawBeneficialOwnership,
    RawInsiderStatistic,
    RawInsiderTrade,
    RawSharesFloat,
} from './investorFlowsProvider.types';
import { sym } from './symKey';

/**
 * 캐시되는 값의 상한. 호출자의 `lookbackDays`/`limit`은 키에 넣지 않고 항상 이 고정 값으로
 * fetch·캐싱한다 — 키에 없는 인자로 잘린 결과를 캐싱하면 다른 호출자가 잘린 값을 받는다
 * (`CachedCongressTradesProvider`의 `CONGRESS_MAX_TRADES`와 같은 이유).
 */
export const INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS = 365;
/** 13D/G 양식 조회가 실패한 결과의 캐시 TTL(초). */
export const INVESTOR_FLOWS_FORM_FAILURE_CACHE_TTL_SECONDS = 3600;
export const INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT = 100;

/**
 * `InvestorFlowsFmpProvider`를 감싸 Redis 캐시를 주입하는 데코레이터.
 *
 * - 내부자 거래·통계: 12시간 (공시 지연 T+2)
 * - 5% 대량보유·유통주식수: 24시간
 *
 * inner가 던지면(FMP 장애) `getOrSetCache`가 set을 건너뛰고 그대로 전파한다 — "던짐 = 인프라 장애,
 * `[]`/`null` = 정상 0건"을 호출자(resilient 로더)가 구분해야 하기 때문이다.
 *
 * 키 스킴 `investor-flows:<kind>:v1:<SYM>` — 반환 형태가 바뀌면 `v1`을 올린다(SERVER.md 데이터 캐시 규칙).
 */
export class CachedInvestorFlowsFmpProvider implements InvestorFlowsFmpProvider {
    constructor(private readonly inner: InvestorFlowsFmpProvider) {}

    getInsiderTrades = cache(
        (symbol: string, lookbackDays: number): Promise<RawInsiderTrade[]> =>
            getOrSetCache(
                `investor-flows:insider:v1:${sym(symbol)}`,
                INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS,
                () =>
                    this.inner.getInsiderTrades(
                        symbol,
                        INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS
                    )
            ).then(rows => this.withinLookback(rows, lookbackDays))
    );

    getInsiderStatistics = cache(
        (symbol: string): Promise<RawInsiderStatistic[]> =>
            getOrSetCache(
                `investor-flows:insider-stats:v1:${sym(symbol)}`,
                INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS,
                () => this.inner.getInsiderStatistics(symbol)
            )
    );

    getBeneficialOwnership = cache(
        (symbol: string, limit: number): Promise<RawBeneficialOwnership[]> =>
            getOrSetCache(
                `investor-flows:13dg:v1:${sym(symbol)}`,
                // SEC 양식 조회가 실패한 행이 있으면 짧게 캐시한다(1시간) — 24시간 동안 URL 추정(`/A` 구분 불가)으로
                // 굳지 않고 곧 다시 정확한 양식을 받아 본다.
                rows =>
                    rows.some(row => row.formLookupFailed === true)
                        ? INVESTOR_FLOWS_FORM_FAILURE_CACHE_TTL_SECONDS
                        : INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS,
                () =>
                    this.inner.getBeneficialOwnership(
                        symbol,
                        INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT
                    )
            ).then(rows => rows.slice(0, limit))
    );

    getSharesFloat = cache((symbol: string): Promise<RawSharesFloat | null> =>
        getOrSetCache(
            `investor-flows:float:v1:${sym(symbol)}`,
            INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS,
            () => this.inner.getSharesFloat(symbol)
        )
    );

    /**
     * 캐시는 가장 넓은 창(12개월)을 담으므로, 더 좁은 창을 요청한 호출자에게는 읽을 때 자른다.
     * 캐시 hit 후에도 날짜가 지나면 오래된 행이 창 밖으로 나가므로 호출 시각 기준으로 다시 거른다.
     */
    private withinLookback(
        rows: RawInsiderTrade[],
        lookbackDays: number
    ): RawInsiderTrade[] {
        if (lookbackDays >= INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS) return rows;
        const cutoffMs = Date.now() - lookbackDays * MS_PER_DAY;
        return rows.filter(row => {
            const filedMs = Date.parse(row.filingDate ?? '');
            return Number.isFinite(filedMs) && filedMs >= cutoffMs;
        });
    }
}
