import { unstable_cache } from 'next/cache';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import { getCachedMarketSummary } from './marketSummaryCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe market summary. getCachedMarketSummary(redis getOrSetCache)를 Next
 * data cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. revalidate=1h,
 * market-summary tag. RSC prefetch 전용(클라는 별도 client action).
 */
export function getMarketSummaryStatic(): Promise<MarketSummaryData> {
    return unstable_cache(
        () => getCachedMarketSummary(getMarketDataProvider()),
        ['market-summary-static'],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
