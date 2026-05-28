import 'server-only';
import { cache } from 'react';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    type MarketDataProvider,
    type MarketSummaryData,
    getMarketSummary,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

const MARKET_SUMMARY_CACHE_KEY = 'market:summary';

/**
 * 대시보드 시장 요약(지수 + 섹터 ETF 현재 시세)을 cache→provider로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request. TTL은 bars와 동일한 개장-경계 정책을 재사용:
 *      `computeBarsEffectiveTtl`(장중 1분 / 장외·주말 min(24h, 다음 개장까지)).
 *      이 정책은 timeframe과 무관하므로 placeholder('1Day')를 전달한다.
 *      Redis 미설정 시 graceful fallback으로 주입된 provider를 직접 호출.
 *
 * 전 종목 quote가 0인 번들(FMP 전면 장애)은 캐시하지 않는다 — transient 장애를
 * TTL 동안 굳히지 않도록(barsDataCache 빈봉 caution과 동일).
 */
export const getCachedMarketSummary = cache(
    async (provider: MarketDataProvider): Promise<MarketSummaryData> => {
        const redis = getRedisClient();
        if (redis !== null) {
            try {
                const hit = await redis.get<MarketSummaryData>(
                    MARKET_SUMMARY_CACHE_KEY
                );
                if (hit !== null) return hit;
            } catch (error) {
                console.error('[marketSummaryCache] Redis get failed', error);
            }
        }

        const fresh = await getMarketSummary(provider);

        const hasQuote = [...fresh.indices, ...fresh.sectors].some(
            q => q.price !== 0
        );
        if (hasQuote && redis !== null) {
            try {
                await redis.set(MARKET_SUMMARY_CACHE_KEY, fresh, {
                    ex: computeBarsEffectiveTtl('1Day', new Date()),
                });
            } catch (error) {
                console.error('[marketSummaryCache] Redis set failed', error);
            }
        }
        return fresh;
    }
);
