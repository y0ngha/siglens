'use client';

/**
 * 섹터 신호 조회 — 데이터와 조회 상태(loading·error·ready), 재시도를 돌려준다.
 */
import { useQuery } from '@tanstack/react-query';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getSectorSignalsAction } from '@/entities/sector-signal/actions/getSectorSignalsAction';
import {
    QUERY_KEYS,
    SECTOR_SIGNALS_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/** 신호 조회 상태. 데이터가 없을 때 "신호 없음"과 "아직 모름"·"실패"를 가른다. */
export type SectorSignalsStatus = 'loading' | 'error' | 'ready';

function resolveStatus(
    hasData: boolean,
    isError: boolean
): SectorSignalsStatus {
    if (hasData) return 'ready';
    return isError ? 'error' : 'loading';
}

interface UseSectorSignalsReturn {
    /** 조회 결과. `status`가 `ready`일 때만 있다. */
    data: SectorSignalsResult | undefined;
    status: SectorSignalsStatus;
    /** 실패한 조회를 다시 시도한다. */
    retry: () => void;
}

/**
 * React Query 기반 sector signals 클라 훅. timeframe 전환 시 새 queryKey로
 * 자동 refetch — useSectorSignalState가 activeTimeframe을 이 훅에 넘겨 구동한다.
 *
 * initialData: SectorSignalsResult에 timeframe 필드가 없으므로, SSR seed는
 * DEFAULT_DASHBOARD_TIMEFRAME에 한해 쓴다. timeframe이 default와 다르면 seed 무시.
 *
 * 데이터가 없는 동안 빈 결과를 꾸며 돌려주지 않는다. 그러면 소비자가 로딩 중이거나
 * 실패한 화면을 "이 섹터에는 신호가 없다"로 그린다. 데이터가 있으면(재조회 실패로
 * 오래된 값이 남은 경우 포함) 그 값을 그대로 보여 준다.
 */
export function useSectorSignals(
    scope: DashboardScopeId,
    timeframe: DashboardTimeframe,
    initialData?: SectorSignalsResult
): UseSectorSignalsReturn {
    const isHydrated = useHydrated();
    const { data, isError, refetch } = useQuery({
        queryKey: QUERY_KEYS.sectorSignals(scope, timeframe),
        queryFn: () => getSectorSignalsAction(scope, timeframe),
        enabled: isHydrated,
        staleTime: SECTOR_SIGNALS_STALE_TIME_MS,
        // SectorSignalsResult에 timeframe 필드가 없으므로 default tf의 seed만 연결한다.
        initialData:
            timeframe === DEFAULT_DASHBOARD_TIMEFRAME ? initialData : undefined,
    });
    const retry = () => {
        void refetch();
    };
    return { data, status: resolveStatus(data !== undefined, isError), retry };
}
