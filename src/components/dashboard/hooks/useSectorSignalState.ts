'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardTimeframe, QuadrantKey, SectorSignalsResult, StockWithConflict } from '@y0ngha/siglens-core';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
} from '@/domain/signals/quadrants';
import { resolveConflicts } from '@/domain/signals/resolveConflicts';

interface UseSectorSignalStateOptions {
    data: SectorSignalsResult;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
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
    data,
    initialSector,
    initialTimeframe,
}: UseSectorSignalStateOptions): UseSectorSignalStateReturn {
    const [activeSector, setActiveSector] = useState(initialSector);
    const [activeTimeframe, setActiveTimeframe] = useState(initialTimeframe);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

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
