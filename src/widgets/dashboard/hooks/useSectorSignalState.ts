'use client';

/**
 * 섹터 신호 패널의 화면 상태 — 선택(섹터·타임프레임), 조회 상태, 화면 구성을 한데 묶는다.
 */
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import {
    buildSectorSignalView,
    type SectorSignalView,
} from '../utils/sectorSignalStocks';
import { useSectorSelection } from './useSectorSelection';
import { useSectorSignals, type SectorSignalsStatus } from './useSectorSignals';

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
    status: SectorSignalsStatus;
    /** 선택한 섹터의 화면 구성. 조회가 끝나기 전에는 비어 있다. */
    view: SectorSignalView;
    retry: () => void;
    handleSectorChange: (sector: string) => void;
    handleTimeframeChange: (timeframe: DashboardTimeframe) => void;
}

/** 선택 상태와 조회 결과를 합쳐 패널이 그릴 값(`view`)과 핸들러를 돌려준다. */
export function useSectorSignalState({
    scope,
    initialSector,
    initialTimeframe,
    initialData,
}: UseSectorSignalStateOptions): UseSectorSignalStateReturn {
    const selection = useSectorSelection({
        scope,
        initialSector,
        initialTimeframe,
    });
    // 훅 선언 순서 예외(REACT.md#HK-1): 조회 키가 위 파생값(activeTimeframe)이다.
    const { data, status, retry } = useSectorSignals(
        scope.id,
        selection.activeTimeframe,
        initialData
    );

    /*
     * 수동 메모이제이션을 두지 않는다 — `next.config.ts`의 `reactCompiler: true`가
     * 이 파생값들을 자동으로 캐시한다. 손으로 적은 deps 배열은 컴파일러가 하는 일을
     * 중복할 뿐이고, deps가 하나 빠지면 그때부터 조용히 낡은 값을 준다.
     */
    const view = buildSectorSignalView(
        data?.stocks ?? [],
        selection.activeSector
    );

    return { ...selection, status, retry, view };
}
