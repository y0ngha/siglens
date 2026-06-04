'use client';

import { useQuery } from '@tanstack/react-query';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getSectorSignalsAction } from '@/entities/sector-signal/actions';
import {
    QUERY_KEYS,
    MARKET_SUMMARY_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';

/**
 * React Query 기반 sector signals 클라 훅. timeframe 전환 시 새 queryKey로
 * 자동 refetch — useSectorSignalState가 activeTimeframe을 이 훅에 넘겨 구동한다.
 *
 * initialData: SectorSignalsResult에 timeframe 필드가 없으므로, SSR seed는
 * DEFAULT_DASHBOARD_TIMEFRAME에 한해 쓴다. timeframe이 default와 다르면 seed 무시.
 */
export function useSectorSignals(
    timeframe: DashboardTimeframe,
    initialData?: SectorSignalsResult
): SectorSignalsResult {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.sectorSignals(timeframe),
        queryFn: () => getSectorSignalsAction(timeframe),
        enabled: isHydrated,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
        // SectorSignalsResult에 timeframe 필드가 없으므로 default tf의 seed만 연결한다.
        initialData:
            timeframe === DEFAULT_DASHBOARD_TIMEFRAME ? initialData : undefined,
    });
    return data ?? { computedAt: '', stocks: [] };
}
