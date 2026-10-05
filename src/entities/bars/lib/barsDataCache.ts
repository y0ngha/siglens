import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type BarsData,
    type MarketDataProvider,
    type MarketSessionSpec,
    type Timeframe,
    US_EQUITY_SESSION,
    fetchBarsWithIndicators,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

/**
 * 캐시 값의 모양 버전. core 2.10.0부터 일봉 결과에 공포·탐욕용 5년 일봉
 * (`fearGreedBars`)이 붙는다. 옛 항목에는 그 필드가 없어 `fearGreedInputs`가
 * 2년 봉으로 돌아가므로, 키를 올리지 않으면 캐시가 만료될 때까지 같은 종목의
 * 점수가 항목 나이에 따라 갈린다. 값의 모양이 바뀌면 이 숫자를 올린다.
 */
const BARS_CACHE_VERSION = 'v2';

/** fmpSymbol이 OHLCV 결과를 바꾸므로(예: '^SPX' vs 'SPX') 키에 포함. */
function buildBarsKey(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): string {
    const suffix = fmpSymbol ? `:${fmpSymbol.toUpperCase()}` : '';
    return `bars:${BARS_CACHE_VERSION}:${symbol.toUpperCase()}:${timeframe}${suffix}`;
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
        fmpSymbol?: string,
        session: MarketSessionSpec = US_EQUITY_SESSION
    ): Promise<BarsData> =>
        getOrSetCache(
            buildBarsKey(symbol, timeframe, fmpSymbol),
            computeBarsEffectiveTtl(timeframe, new Date(), session),
            // Retry(429/5xx + network)는 provider의 fmpGet(FMP_TRANSIENT_RETRY)에서 처리.
            () =>
                fetchBarsWithIndicators(provider, symbol, timeframe, fmpSymbol),
            fresh => fresh.bars.length > 0
        )
);
