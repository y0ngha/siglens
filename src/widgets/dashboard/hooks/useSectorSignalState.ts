'use client';

import { usePathname, useRouter } from 'next/navigation';
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
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
} from '@/entities/analysis/lib/quadrants';
import { resolveConflicts } from '@/entities/analysis/lib/resolveConflicts';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import { useSectorSignals } from './useSectorSignals';

interface UseSectorSignalStateOptions {
    /** 어느 시장의 신호인가. 섹터 목록·쿼리 키·서버 액션이 전부 여기서 갈린다. */
    scope: ClientDashboardScope;
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
    /**
     * 딥링크 복원은 `useSearchParams`가 아니라 `useUrlSearchParam`으로 읽는다 — 전자는 이
     * 패널을 CSR bailout시켜 서버 HTML에 스켈레톤만 남겼다. 서버·하이드레이션 렌더는
     * 쿼리 없음(= 첫 섹터·기본 타임프레임, 서버 seed와 같은 화면)이고, 그 직후 URL 값으로
     * 다시 렌더된다. 하이드레이션 불일치는 없다.
     */
    const sectorParam = useUrlSearchParam('sector');
    const timeframeParam = useUrlSearchParam('timeframe');
    /**
     * 사용자가 탭/셀렉터로 고른 값. URL보다 우선한다(URL 쓰기는 구독자에게 알려지지
     * 않는다). 뒤로/앞으로 가기(popstate)가 오면 무효가 돼 화면이 URL을 다시 따른다.
     */
    const [pickedSector, pickSector] = usePickUntilPopstate<string>();
    const [pickedTimeframe, pickTimeframe] =
        usePickUntilPopstate<DashboardTimeframe>();

    const urlSector =
        sectorParam !== null &&
        scope.signalSectors.some(sector => sector.symbol === sectorParam)
            ? sectorParam
            : initialSector;
    const urlTimeframe = isDashboardTimeframe(timeframeParam)
        ? timeframeParam
        : initialTimeframe;
    const activeSector = pickedSector ?? urlSector;
    const activeTimeframe = pickedTimeframe ?? urlTimeframe;

    // 훅 선언 순서 예외(REACT.md#HK-1): 조회 키가 위 파생값(activeTimeframe)이다.
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
        // 이벤트 핸들러에서만 불린다 — 다른 쿼리(utm 등)를 보존하려고 현재 주소를 읽는다.
        const params = new URLSearchParams(window.location.search);
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
        pickSector(sector);
        updateUrl(sector, activeTimeframe);
    };

    const handleTimeframeChange = (next: DashboardTimeframe) => {
        pickTimeframe(next);
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
