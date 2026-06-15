import 'server-only';
import { unstable_cache } from 'next/cache';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getCachedSectorSignals } from './sectorSignalsCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { SECTOR_STOCKS } from '@/shared/config/dashboard-tickers';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

const SECTOR_SIGNALS_STATIC_CONFIG_FINGERPRINT = createCacheConfigFingerprint(
    JSON.stringify(SECTOR_STOCKS)
);

/**
 * ISR static-safe sector signals. timeframe별 캐시. revalidate=1h, `sector:signals` tag.
 * 태그는 market summary/briefing과 분리해 정밀 무효화를 가능케 한다(공유 시 blast-radius).
 */
export function getSectorSignalsStatic(
    timeframe: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return unstable_cache(
        () => getCachedSectorSignals(getMarketDataProvider(), timeframe),
        [
            'sector-signals-static',
            timeframe,
            SECTOR_SIGNALS_STATIC_CONFIG_FINGERPRINT,
        ],
        { revalidate: SECONDS_PER_HOUR, tags: ['sector:signals'] }
    )();
}
