import type { MarketSummaryData } from '@y0ngha/siglens-core';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { allQuotesPresent } from './marketSummaryCompleteness';

/**
 * 이 번들을 Redis에 굳혀도 되는가. `getCachedMarketSummary`의 쓰기 가드.
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
export function shouldCacheMarketSummary(
    scope: DashboardScope,
    summary: MarketSummaryData
): boolean {
    if (scope.id !== 'kr') return allQuotesPresent(summary);
    return (
        summary.indices.length > 0 && summary.indices.every(q => q.price > 0)
    );
}
