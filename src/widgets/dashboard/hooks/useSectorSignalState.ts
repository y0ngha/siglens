'use client';

import { useCallback, useMemo, useState } from 'react';
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
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    /**
     * 딥링크 복원: URL 쿼리를 **첫 렌더에서 바로** 초기값으로 쓴다.
     * 예전에는 마운트 effect에서 setState로 복원해 렌더가 한 번 더 돌았다(잘못된 섹터가
     * 한 프레임 보였다). 이 패널은 `useSearchParams` 때문에 CSR bailout이라 서버가
     * 이 서브트리를 렌더하지 않으므로(page.tsx의 Suspense fallback이 대신 나간다)
     * 렌더 중 쿼리를 읽어도 하이드레이션 불일치가 없다.
     */
    const [activeSector, setActiveSector] = useState(() => {
        const fromUrl = searchParams.get('sector');
        return fromUrl !== null &&
            SIGNAL_SECTORS.some(sector => sector.symbol === fromUrl)
            ? fromUrl
            : initialSector;
    });
    const [activeTimeframe, setActiveTimeframe] = useState<DashboardTimeframe>(
        () => {
            const fromUrl = searchParams.get('timeframe');
            return isDashboardTimeframe(fromUrl) ? fromUrl : initialTimeframe;
        }
    );

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
