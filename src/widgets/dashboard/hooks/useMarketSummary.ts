'use client';

import { useMemo } from 'react';
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

export function useMarketSummary(): UseMarketSummaryReturn {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery<MarketSummaryActionResult>({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryClientAction,
        enabled: isHydrated,
        staleTime: IS_E2E_MODE ? 0 : MARKET_SUMMARY_STALE_TIME_MS,
        refetchOnMount: IS_E2E_MODE ? 'always' : undefined,
    });

    const resolved = hasSummary(data) ? data : undefined;

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (resolved?.summary.sectors ?? []).map((s: MarketSectorData) => [
                    s.symbol,
                    s,
                ])
            ),
        [resolved?.summary.sectors]
    );

    const indices = useMemo(
        () => resolved?.summary.indices ?? [],
        [resolved?.summary.indices]
    );

    const hasMissingQuotes = useMemo(
        () => (resolved ? detectMissingQuotes(resolved.summary) : false),
        [resolved]
    );

    return { data, isPending, sectorMap, indices, hasMissingQuotes };
}
