'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
    DashboardTimeframe,
    QuadrantKey,
    SectorSignalsResult,
    StockWithConflict,
} from '@y0ngha/siglens-core';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    isDashboardTimeframe,
    SIGNAL_SECTORS,
} from '@/shared/config/dashboard-tickers';
import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
    resolveConflicts,
} from '@/entities/analysis';
import { useSectorSignals } from './useSectorSignals';

interface UseSectorSignalStateOptions {
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
    /**
     * SSR seed for the default timeframe. SectorSignalsResult에 timeframe 필드가
     * 없으므로 useSectorSignals는 DEFAULT_DASHBOARD_TIMEFRAME일 때만 seed를 쓴다.
     */
    initialData?: SectorSignalsResult;
}

interface UseSectorSignalStateReturn {
    activeSector: string;
    activeTimeframe: DashboardTimeframe;
    quadrants: Record<QuadrantKey, readonly StockWithConflict[]>;
    mixedStocks: readonly StockWithConflict[];
    handleSectorChange: (sector: string) => void;
    handleTimeframeChange: (timeframe: DashboardTimeframe) => void;
}

export function useSectorSignalState({
    initialSector,
    initialTimeframe,
    initialData,
}: UseSectorSignalStateOptions): UseSectorSignalStateReturn {
    const [activeSector, setActiveSector] = useState(initialSector);
    const [activeTimeframe, setActiveTimeframe] =
        useState<DashboardTimeframe>(initialTimeframe);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Restore sector/timeframe from URL once on mount (deep-link support). Default state
    // from props is shown during SSR/hydration (Suspense fallback covers the swap).
    useEffect(() => {
        const fromUrl = searchParams.get('sector');
        if (fromUrl && SIGNAL_SECTORS.some(s => s.symbol === fromUrl))
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-only URL init
            setActiveSector(fromUrl);
        const tfFromUrl = searchParams.get('timeframe');

        if (isDashboardTimeframe(tfFromUrl)) setActiveTimeframe(tfFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only URL restore
    }, []);

    // activeTimeframe이 데이터 fetch를 직접 구동 — tf 전환이 클라에서 즉시 반영
    const data = useSectorSignals(activeTimeframe, initialData);

    const filtered = useMemo(
        () => filterStrictAnticipation(data.stocks),
        [data.stocks]
    );
    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );
    const { resolved: resolvedStocks, mixed: mixedStocks } = useMemo(
        () => resolveConflicts(sectorStocks),
        [sectorStocks]
    );
    const quadrants = useMemo(
        () => resolvedStocks.reduce(groupStockIntoQuadrants, EMPTY_QUADRANTS),
        [resolvedStocks]
    );

    const updateUrl = useCallback(
        (nextSector: string, nextTimeframe: DashboardTimeframe) => {
            const params = new URLSearchParams(searchParams.toString());
            if (nextSector === SIGNAL_SECTORS[0].symbol)
                params.delete('sector');
            else params.set('sector', nextSector);
            if (nextTimeframe === DEFAULT_DASHBOARD_TIMEFRAME)
                params.delete('timeframe');
            else params.set('timeframe', nextTimeframe);
            const qs = params.toString();
            router.replace(qs === '' ? pathname : `${pathname}?${qs}`, {
                scroll: false,
            });
        },
        [router, pathname, searchParams]
    );

    const handleSectorChange = useCallback(
        (sector: string) => {
            setActiveSector(sector);
            updateUrl(sector, activeTimeframe);
        },
        [updateUrl, activeTimeframe]
    );

    const handleTimeframeChange = useCallback(
        (next: DashboardTimeframe) => {
            setActiveTimeframe(next);
            updateUrl(activeSector, next);
        },
        [updateUrl, activeSector]
    );

    return {
        activeSector,
        activeTimeframe,
        quadrants,
        mixedStocks,
        handleSectorChange,
        handleTimeframeChange,
    };
}
