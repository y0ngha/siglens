import 'server-only';
import { unstable_cache } from 'next/cache';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getCachedSectorSignals } from './sectorSignalsCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/** ISR static-safe sector signals. timeframe별 캐시. revalidate=1h, market-summary tag. */
export function getSectorSignalsStatic(
    timeframe: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return unstable_cache(
        () => getCachedSectorSignals(getMarketDataProvider(), timeframe),
        ['sector-signals-static', timeframe],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
