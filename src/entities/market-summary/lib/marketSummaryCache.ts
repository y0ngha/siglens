import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type MarketDataProvider,
    type MarketSummaryData,
    type Timeframe,
    getMarketSummary,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

const MARKET_SUMMARY_CACHE_KEY = 'market:summary';

/** 시장 요약은 bars 일봉 TTL 정책을 재사용 — 실제 timeframe과 무관한 placeholder. */
const SUMMARY_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/** 전 종목 quote가 0인 번들은 FMP 전면 장애 신호 — 캐싱하지 않는다. */
function hasAnyQuote(summary: MarketSummaryData): boolean {
    return (
        summary.indices.some(q => q.price !== 0) ||
        summary.sectors.some(q => q.price !== 0)
    );
}

/**
 * 대시보드 시장 요약(지수 + 섹터 ETF 현재 시세)을 cache→provider로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request. TTL은 bars와 동일한 개장-경계 정책을 재사용:
 *      `computeBarsEffectiveTtl`(장중 1분 / 장외·주말 min(24h, 다음 개장까지)).
 *      이 정책은 timeframe과 무관하므로 placeholder('1Day')를 전달한다. getOrSetCache가
 *      get→fetch→set과 Redis 미설정/장애 시 graceful fallback을 담당한다.
 *
 * 전 종목 quote가 0인 번들(FMP 전면 장애)은 캐시하지 않는다(`shouldCache` 가드) —
 * transient 장애를 TTL 동안 굳히지 않도록(barsDataCache 빈봉 caution과 동일).
 */
export const getCachedMarketSummary = cache(
    async (provider: MarketDataProvider): Promise<MarketSummaryData> =>
        getOrSetCache(
            MARKET_SUMMARY_CACHE_KEY,
            computeBarsEffectiveTtl(SUMMARY_TTL_TIMEFRAME, new Date()),
            () => getMarketSummary(provider),
            hasAnyQuote
        )
);
