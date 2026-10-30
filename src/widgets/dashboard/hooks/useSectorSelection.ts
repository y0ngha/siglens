'use client';

/**
 * 섹터 신호 패널의 섹터·타임프레임 선택 상태와 URL 동기화.
 */
import { usePathname, useRouter } from 'next/navigation';
import type { DashboardTimeframe } from '@y0ngha/siglens-core';
import { isDashboardTimeframe } from '@/shared/config/dashboard-tickers';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import { buildSectorSignalQuery, withQuery } from '../utils/sectorSignalUrl';

interface UseSectorSelectionOptions {
    /** 어느 시장의 신호인가. 유효한 섹터 목록과 기본 섹터가 여기서 갈린다. */
    scope: ClientDashboardScope;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

interface UseSectorSelectionReturn {
    activeSector: string;
    activeTimeframe: DashboardTimeframe;
    handleSectorChange: (sector: string) => void;
    handleTimeframeChange: (timeframe: DashboardTimeframe) => void;
}

/**
 * 딥링크 복원은 `useSearchParams`가 아니라 `useUrlSearchParam`으로 읽는다 — 전자는 이
 * 패널을 CSR bailout시켜 서버 HTML에 스켈레톤만 남긴다. 서버·하이드레이션 렌더는
 * 쿼리 없음(= 첫 섹터·기본 타임프레임, 서버 seed와 같은 화면)이고, 그 직후 URL 값으로
 * 다시 렌더된다. 하이드레이션 불일치는 없다.
 *
 * 사용자가 탭/셀렉터로 고른 값이 URL보다 우선한다(URL 쓰기는 구독자에게 알려지지
 * 않는다). 뒤로/앞으로 가기(popstate)가 오면 그 선택이 무효가 돼 화면이 URL을 다시 따른다.
 */
export function useSectorSelection({
    scope,
    initialSector,
    initialTimeframe,
}: UseSectorSelectionOptions): UseSectorSelectionReturn {
    const router = useRouter();
    const pathname = usePathname();
    const sectorParam = useUrlSearchParam('sector');
    const timeframeParam = useUrlSearchParam('timeframe');
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

    const updateUrl = (
        nextSector: string,
        nextTimeframe: DashboardTimeframe
    ) => {
        // 이벤트 핸들러에서만 불린다 — 다른 쿼리(utm 등)를 보존하려고 현재 주소를 읽는다.
        const query = buildSectorSignalQuery(window.location.search, {
            sector: nextSector,
            timeframe: nextTimeframe,
            defaultSector: scope.signalSectors[0]?.symbol,
        });
        router.replace(withQuery(pathname, query), { scroll: false });
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
        handleSectorChange,
        handleTimeframeChange,
    };
}
