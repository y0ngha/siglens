import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type BarsData,
    type MarketDataProvider,
    type Timeframe,
    fetchBarsWithIndicators,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

/** fmpSymbol이 OHLCV 결과를 바꾸므로(예: '^SPX' vs 'SPX') 키에 포함. */
function buildBarsKey(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): string {
    const suffix = fmpSymbol ? `:${fmpSymbol.toUpperCase()}` : '';
    return `bars:${symbol.toUpperCase()}:${timeframe}${suffix}`;
}

/**
 * OHLCV+지표를 cache→FMP로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup(layout/page가 같은 TF prefetch 시 1회).
 *   2. Upstash Redis — cross-request, 시장 세션별 TTL(core `computeBarsEffectiveTtl`).
 *      봇이 한 종목의 여러 탭을 연속 크롤링해도 fetch가 1회로 수렴. getOrSetCache가
 *      get→fetch→set과 Redis 미설정/장애 시 graceful fallback을 담당한다.
 *
 * 에러는 캐시하지 않는다(provider의 fmpGet이 throw → set 이전에 전파). 빈 봉도
 * 캐시하지 않는다(`shouldCache` 가드 — transient 장애를 TTL 동안 굳히지 않도록).
 */
export const getCachedBarsWithIndicators = cache(
    async (
        provider: MarketDataProvider,
        symbol: string,
        timeframe: Timeframe,
        fmpSymbol?: string
    ): Promise<BarsData> =>
        getOrSetCache(
            buildBarsKey(symbol, timeframe, fmpSymbol),
            computeBarsEffectiveTtl(timeframe, new Date()),
            // Retry(429/5xx + network)는 provider의 fmpGet(FMP_TRANSIENT_RETRY)에서 처리.
            () =>
                fetchBarsWithIndicators(provider, symbol, timeframe, fmpSymbol),
            fresh => fresh.bars.length > 0
        )
);
