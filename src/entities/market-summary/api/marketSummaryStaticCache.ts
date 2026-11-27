import 'server-only';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import { unstable_cache } from 'next/cache';
import {
    marketDataProviderFor,
    scopeUsesFmp,
} from '@/shared/api/market/getMarketDataProvider';
import { assertFmpAvailableAtBuild } from '@/shared/api/offlineBuild';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { hasAnyQuote } from '../lib/marketSummaryCompleteness';
import { hasMissingIndexQuote } from '../lib/shouldCacheMarketSummary';
import {
    getCachedMarketSummary,
    marketSummaryConfigFingerprint,
} from './marketSummaryCache';

/**
 * `getMarketSummaryStatic`의 시장별 캐시 태그. 한국 시세를 무효화하려고 미국까지
 * 날리면 태그를 분리해 둔 의미가 없다.
 */
export function marketSummaryCacheTag(scope: DashboardScope): string {
    return `market:summary:${scope.id}`;
}

function hasSummaryRows(summary: MarketSummaryData): boolean {
    return summary.indices.length + summary.sectors.length > 0;
}

/**
 * ISR static-safe market summary. getCachedMarketSummary(redis getOrSetCache)를 Next
 * data cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. revalidate=1h,
 * `market:summary:<scopeId>` tag(`marketSummaryCacheTag`). RSC prefetch 전용(클라는
 * 별도 client action).
 *
 * 태그는 관심사별로 분리한다(`market:summary:<scopeId>` /
 * `sector:signals:<scopeId>` / `market:briefing:<scopeId>`) — 셋이 한 태그를
 * 공유하면 향후 어느 하나를 revalidateTag로 무효화할 때 나머지까지 함께 날아가는
 * 결합(blast-radius)이 생기므로, 정밀 무효화를 위해 분리해 둔다.
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
            // yahoo(KRX)는 429·장애를 provider가 null로 접고 core가 0-가격 행으로 바꾼다.
            // 모든 quote가 0이면 종목 없음이 아니라 provider 장애다(큐레이션 지수·ETF가 전부
            // 없을 수는 없다) — 던져서 0원 번들이 Data Cache(1h)에 굳지 않게 하고, 호출부
            // (loadMarketSignals)가 catch해 degrade한다. 로그의 시장 태그가 알람 필터 문구다.
            if (
                !scopeUsesFmp(scope.id) &&
                hasSummaryRows(summary) &&
                !hasAnyQuote(summary)
            )
                throw new Error(
                    `[market:${scope.id}] summary quotes all missing (provider outage)`
                );
            // 일부만 0일 때는 지수 결측만 장애 신호로 본다(섹터 ETF 결측은 얇은 거래의 일상).
            // 이 콜백은 unstable_cache 미스에서만 돌아 **실제 provider 조회 1회당 한 줄**이다 —
            // 렌더마다 찍으면 캐시된 번들 하나가 ISR 재생성·로케일 수만큼 알람 점수를 쌓는다.
            // 지수가 0인 원인이 장애인지 종목 없음인지는 여기서 가를 수 없어 문구를 단정하지 않는다.
            if (!scopeUsesFmp(scope.id) && hasMissingIndexQuote(summary))
                console.error(
                    `[market:${scope.id}] summary index quotes missing:`,
                    summary.indices
                        .filter(q => q.price === 0)
                        .map(q => q.symbol)
                        .join(',')
                );
            return summary;
        },
        [
            'market-summary-static',
            scope.id,
            marketSummaryConfigFingerprint(scope),
        ],
        { revalidate: SECONDS_PER_HOUR, tags: [marketSummaryCacheTag(scope)] }
    )();
}
