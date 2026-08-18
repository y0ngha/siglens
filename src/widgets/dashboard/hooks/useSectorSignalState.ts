'use client';

import { useState } from 'react';
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
} from '@/shared/config/dashboard-tickers';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
    resolveConflicts,
} from '@/entities/analysis';
import { useSectorSignals } from './useSectorSignals';

interface UseSectorSignalStateOptions {
    /** 어느 시장의 신호인가. 섹터 목록·쿼리 키·서버 액션이 전부 여기서 갈린다. */
    scope: DashboardScope;
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
    scope,
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
            scope.signalSectors.some(sector => sector.symbol === fromUrl)
            ? fromUrl
            : initialSector;
    });
    const [activeTimeframe, setActiveTimeframe] = useState<DashboardTimeframe>(
        () => {
            const fromUrl = searchParams.get('timeframe');
            return isDashboardTimeframe(fromUrl) ? fromUrl : initialTimeframe;
        }
    );

    const data = useSectorSignals(scope.id, activeTimeframe, initialData);

    /*
     * 수동 메모이제이션을 두지 않는다 — `next.config.ts`의 `reactCompiler: true`가
     * 이 파생값들과 콜백을 자동으로 캐시한다. 손으로 적은 deps 배열은 컴파일러가
     * 하는 일을 중복할 뿐이고, deps가 하나 빠지면 그때부터 조용히 낡은 값을 준다.
     */
    const filtered = filterStrictAnticipation(data.stocks);
    const sectorStocks = filtered.filter(s => s.sectorSymbol === activeSector);
    const { resolved: resolvedStocks, mixed: mixedStocks } =
        resolveConflicts(sectorStocks);
    const quadrants = resolvedStocks.reduce(
        groupStockIntoQuadrants,
        EMPTY_QUADRANTS
    );

    const updateUrl = (
        nextSector: string,
        nextTimeframe: DashboardTimeframe
    ) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextSector === scope.signalSectors[0]?.symbol)
            params.delete('sector');
        else params.set('sector', nextSector);
        if (nextTimeframe === DEFAULT_DASHBOARD_TIMEFRAME)
            params.delete('timeframe');
        else params.set('timeframe', nextTimeframe);
        const qs = params.toString();
        router.replace(qs === '' ? pathname : `${pathname}?${qs}`, {
            scroll: false,
        });
    };

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, activeTimeframe);
    };

    const handleTimeframeChange = (next: DashboardTimeframe) => {
        setActiveTimeframe(next);
        updateUrl(activeSector, next);
    };

    return {
        activeSector,
        activeTimeframe,
        quadrants,
        mixedStocks,
        handleSectorChange,
        handleTimeframeChange,
    };
}
