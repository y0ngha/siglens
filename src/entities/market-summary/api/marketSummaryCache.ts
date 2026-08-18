import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type MarketDataProvider,
    type MarketSummaryData,
    type Timeframe,
    getMarketSummary,
} from '@y0ngha/siglens-core';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { dashboardCacheTtlSeconds } from '@/shared/api/market/sessionSpecFor';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { allQuotesPresent } from '../lib/marketSummaryCompleteness';

/**
 * config(지수+섹터 ETF 목록) fingerprint — cache 키에 박아 config 변경 시 캐시를
 * 자동 무효화한다. static cache(marketSummaryStaticCache)도 **이 상수를 import해**
 * 동일 fingerprint를 공유하므로, 직렬화 포맷이 한쪽에서만 바뀌어 키가 어긋나는 일이 없다.
 *
 * Redis 키 누적: config가 바뀌면 새 fingerprint 키가 생기고 옛 키는 그대로 남지만,
 * 모든 엔트리에 TTL(`dashboardCacheTtlSeconds`, 최대 24h)이 있어 자연 만료된다 —
 * 별도 정리 메커니즘 불필요. (config 변경은 배포 단위로 드물어 누적량도 미미.)
 */
export function marketSummaryConfigFingerprint(scope: DashboardScope): string {
    return createCacheConfigFingerprint(
        JSON.stringify({
            marketIndices: scope.indices,
            sectorEtfs: scope.sectorEtfs,
        })
    );
}

/**
 * scope.id를 키에 직접 넣는다. fingerprint만으로도 두 시장이 갈리기는 하지만,
 * Redis를 눈으로 훑을 때 `market:summary:kr:…`이 보이는 편이 운영에서 훨씬 낫다.
 */
function marketSummaryCacheKey(scope: DashboardScope): string {
    return `market:summary:${scope.id}:${marketSummaryConfigFingerprint(scope)}`;
}

/** 시장 요약은 bars 일봉 TTL 정책을 재사용 — 실제 timeframe과 무관한 placeholder. */
const SUMMARY_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 대시보드 시장 요약(지수 + 섹터 ETF 현재 시세)을 cache→provider로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request. TTL은 bars와 동일한 개장-경계 정책을 재사용:
 *      `dashboardCacheTtlSeconds`(장중 1분 / 장외·주말 min(24h, 다음 개장까지),
 *      한국은 하한 5분).
 *      이 정책은 timeframe과 무관하므로 placeholder('1Day')를 전달한다. getOrSetCache가
 *      get→fetch→set과 Redis 미설정/장애 시 graceful fallback을 담당한다.
 *
 * quote가 0인 종목이 하나라도 있는 번들(부분 실패 포함)은 캐시하지 않는다
 * (`allQuotesPresent` 가드) — transient 장애를 TTL 동안 굳히지 않도록(barsDataCache
 * 빈봉 caution과 동일). 0은 FMP fetch 실패 신호이며, 클라이언트는 같은 기준으로
 * "데이터 일부 로드 실패" 안내를 띄운다(`hasMissingQuotes` 참조).
 */
export const getCachedMarketSummary = cache(
    async (
        provider: MarketDataProvider,
        scope: DashboardScope
    ): Promise<MarketSummaryData> =>
        getOrSetCache(
            marketSummaryCacheKey(scope),
            dashboardCacheTtlSeconds(
                scope.id,
                SUMMARY_TTL_TIMEFRAME,
                new Date()
            ),
            () =>
                getMarketSummary(
                    provider,
                    [...scope.indices],
                    [...scope.sectorEtfs]
                ),
            summary => shouldCacheSummary(scope, summary)
        )
);

/**
 * 이 번들을 Redis에 굳혀도 되는가.
 *
 * 미국은 전부 있어야 한다(`allQuotesPresent`) — FMP는 인증된 유료 소스라 결측이
 * transient 장애 신호이고, 그걸 TTL 동안 굳히면 안 된다.
 *
 * **한국은 지수만 본다.** 소스가 무인증 yahoo이고 섹터 ETF 6종은 거래가 얇아
 * 하나가 간헐적으로 비는 일이 실제로 있다. 전부-아니면-무효로 두면 그 한 종목
 * 때문에 캐시 쓰기가 영영 막혀 `/market/kr`이 매 ISR 재생성과 매 클라 refetch마다
 * yahoo를 새로 때린다 — 429를 피하려고 넣은 캐시가 429의 원인이 된다.
 * 카드 하나가 비는 편이 그보다 낫고, 클라는 `hasMissingQuotes`로 이미 안내한다.
 */
function shouldCacheSummary(
    scope: DashboardScope,
    summary: MarketSummaryData
): boolean {
    if (scope.id !== 'kr') return allQuotesPresent(summary);
    return (
        summary.indices.length > 0 && summary.indices.every(q => q.price > 0)
    );
}
