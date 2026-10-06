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
import { scopeUsesFmp } from '@/shared/api/market/getMarketDataProvider';
import { sectorSignalsProviderFor } from './sectorSignalsProvider';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { assertFmpAvailableAtBuild } from '@/shared/api/offlineBuild';

/**
 * ISR static-safe sector signals. timeframe별 캐시. revalidate=1h, `sector:signals` tag.
 * 태그는 market summary/briefing과 분리해 정밀 무효화를 가능케 한다(공유 시 blast-radius).
 */
export function getSectorSignalsStatic(
    scope: DashboardScope,
    timeframe: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return unstable_cache(
        async () => {
            const result = await getCachedSectorSignals(
                sectorSignalsProviderFor(scope.id, timeframe),
                scope,
                timeframe
            );
            // core가 종목별 실패를 빈 결과로 삼키므로 빌드 중 FMP가 죽었으면 Data
            // Cache에 굳히지 않는다 — marketSummaryStaticCache와 같은 이유.
            if (scopeUsesFmp(scope.id))
                assertFmpAvailableAtBuild('sector-signals-static');
            return result;
        },
        [
            'sector-signals-static',
            scope.id,
            timeframe,
            sectorStocksConfigFingerprint(scope),
        ],
        { revalidate: SECONDS_PER_HOUR, tags: [`sector:signals:${scope.id}`] }
    )();
}
