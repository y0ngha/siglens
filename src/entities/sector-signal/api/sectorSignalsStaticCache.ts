import 'server-only';
import { unstable_cache } from 'next/cache';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import {
    getCachedSectorSignals,
    sectorStocksConfigFingerprint,
} from './sectorSignalsCache';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe sector signals. timeframe별 캐시. revalidate=1h, `sector:signals` tag.
 * 태그는 market summary/briefing과 분리해 정밀 무효화를 가능케 한다(공유 시 blast-radius).
 */
export function getSectorSignalsStatic(
    scope: DashboardScope,
    timeframe: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return unstable_cache(
        () =>
            getCachedSectorSignals(
                marketDataProviderFor(scope.id),
                scope,
                timeframe
            ),
        [
            'sector-signals-static',
            scope.id,
            timeframe,
            sectorStocksConfigFingerprint(scope),
        ],
        { revalidate: SECONDS_PER_HOUR, tags: [`sector:signals:${scope.id}`] }
    )();
}
