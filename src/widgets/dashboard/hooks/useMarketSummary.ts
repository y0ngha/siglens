'use client';

import { useQuery } from '@tanstack/react-query';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { getMarketSummaryClientAction } from '@/entities/market-summary/actions';
import { hasMissingQuotes as detectMissingQuotes } from '@/entities/market-summary';
import {
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { isE2EClient } from '@/shared/api/e2eClientEnv';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * Build-time-static E2E flag — evaluated once at module import.
 * NEXT_PUBLIC_E2E_TEST is inlined at build time so this is safe as a const.
 */
const IS_E2E_MODE = isE2EClient();

interface UseMarketSummaryReturn {
    data: MarketSummaryActionResult | undefined;
    isPending: boolean;
    sectorMap: Map<string, MarketSectorData>;
    indices: readonly MarketIndexData[];
    /**
     * summary가 있고 0(=FMP fetch 실패)인 종목이 하나라도 있으면 true. 캐시 가드
     * (`allQuotesPresent`)와 동일 기준 — 부분/전면 실패를 안내로 알리는 데 쓴다.
     */
    hasMissingQuotes: boolean;
}

function hasSummary(
    data: MarketSummaryActionResult | undefined
): data is Extract<MarketSummaryActionResult, { summary: unknown }> {
    return data !== undefined && !('ok' in data);
}

/**
 * @param scope - 어느 시장의 시세인가. 쿼리 키와 서버 액션 양쪽에 흐른다 —
 *   키에만 넣고 액션에 안 넘기면 캐시는 갈리는데 내용은 같아진다.
 */
export function useMarketSummary(
    scope: DashboardScopeId
): UseMarketSummaryReturn {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery<MarketSummaryActionResult>({
        queryKey: QUERY_KEYS.marketSummary(scope),
        queryFn: () => getMarketSummaryClientAction(scope),
        enabled: isHydrated,
        staleTime: IS_E2E_MODE ? 0 : MARKET_SUMMARY_STALE_TIME_MS,
        refetchOnMount: IS_E2E_MODE ? 'always' : undefined,
    });

    const resolved = hasSummary(data) ? data : undefined;

    /*
     * 수동 메모이제이션 없음 — `reactCompiler: true`가 이 파생값들을 자동으로 캐시한다.
     * 특히 `sectorMap`은 매 렌더 새 Map을 만들면 소비 컴포넌트가 전부 다시 그려지는
     * 자리라 캐시가 실제로 필요한데, 그 일을 컴파일러가 한다.
     */
    const sectorMap = new Map<string, MarketSectorData>(
        (resolved?.summary.sectors ?? []).map((s: MarketSectorData) => [
            s.symbol,
            s,
        ])
    );

    const indices = resolved?.summary.indices ?? [];

    const hasMissingQuotes = resolved
        ? detectMissingQuotes(resolved.summary)
        : false;

    return { data, isPending, sectorMap, indices, hasMissingQuotes };
}
