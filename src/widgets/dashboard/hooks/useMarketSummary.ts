'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { getMarketSummaryAction } from '@/entities/market-summary/actions';
import {
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

interface UseMarketSummaryReturn {
    data: MarketSummaryActionResult | undefined;
    isPending: boolean;
    sectorMap: Map<string, MarketSectorData>;
    indices: readonly MarketIndexData[];
}

function hasSummary(
    data: MarketSummaryActionResult | undefined
): data is Exclude<MarketSummaryActionResult, { ok: false }> {
    return data !== undefined && !('ok' in data);
}

export function useMarketSummary(): UseMarketSummaryReturn {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryAction,
        enabled: isHydrated,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
    });

    const resolved = hasSummary(data) ? data : undefined;

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (resolved?.summary.sectors ?? []).map(s => [s.symbol, s])
            ),
        [resolved?.summary.sectors]
    );

    const indices = useMemo(
        () => resolved?.summary.indices ?? [],
        [resolved?.summary.indices]
    );

    return { data, isPending, sectorMap, indices };
}
