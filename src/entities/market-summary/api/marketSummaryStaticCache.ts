import 'server-only';
import { unstable_cache } from 'next/cache';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import {
    getCachedMarketSummary,
    marketSummaryConfigFingerprint,
} from './marketSummaryCache';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe market summary. getCachedMarketSummary(redis getOrSetCache)를 Next
 * data cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. revalidate=1h,
 * `market:summary` tag. RSC prefetch 전용(클라는 별도 client action).
 *
 * 태그는 관심사별로 분리한다(`market:summary` / `sector:signals` / `market:briefing`) —
 * 셋이 한 태그를 공유하면 향후 어느 하나를 revalidateTag로 무효화할 때 나머지까지
 * 함께 날아가는 결합(blast-radius)이 생기므로, 정밀 무효화를 위해 분리해 둔다.
 */
export function getMarketSummaryStatic(
    scope: DashboardScope
): Promise<MarketSummaryData> {
    return unstable_cache(
        () => getCachedMarketSummary(marketDataProviderFor(scope.id), scope),
        [
            'market-summary-static',
            scope.id,
            marketSummaryConfigFingerprint(scope),
        ],
        // 태그도 시장별로 가른다 — 한국 시세를 무효화하려고 미국까지 날리면
        // 태그를 분리해 둔 의미가 없다.
        { revalidate: SECONDS_PER_HOUR, tags: [`market:summary:${scope.id}`] }
    )();
}
