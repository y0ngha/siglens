import 'server-only';
import { unstable_cache } from 'next/cache';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import {
    getCachedMarketSummary,
    marketSummaryConfigFingerprint,
} from './marketSummaryCache';
import {
    marketDataProviderFor,
    scopeUsesFmp,
} from '@/shared/api/market/getMarketDataProvider';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { assertFmpAvailableAtBuild } from '@/shared/api/offlineBuild';

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
        async () => {
            const summary = await getCachedMarketSummary(
                marketDataProviderFor(scope.id),
                scope
            );
            // provider가 FMP 실패를 0-가격으로 삼키므로, 빌드 중 FMP가 죽었으면 여기서
            // 던져 그 번들을 Data Cache(1h)에 굳히지 않는다 — 굳으면 60초 뒤 재생성도
            // 같은 0-가격을 읽는다. 호출부(loadMarketSignals)가 catch해 degrade한다.
            if (scopeUsesFmp(scope.id))
                assertFmpAvailableAtBuild('market-summary-static');
            return summary;
        },
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
