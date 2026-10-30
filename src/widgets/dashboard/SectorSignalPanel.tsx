'use client';

/**
 * 섹터 신호 패널 — 타임프레임·섹터 선택과 선택한 섹터의 신호 소절을 조립한다.
 */
import { useTranslations } from 'next-intl';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { useSectorSignalState } from './hooks/useSectorSignalState';
import { SectorSignalBody } from './SectorSignalBody';
import { SectorSignalStatusLine } from './ui/sector-signal/SectorSignalStatusLine';
import { SectorTabs } from './ui/sector-signal/SectorTabs';
import { TimeframeSelector } from './ui/sector-signal/TimeframeSelector';

interface SectorSignalPanelProps {
    /** 어느 시장의 신호인가. 섹터 탭·조회·URL 복원이 전부 여기서 갈린다. */
    scope: ClientDashboardScope;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
    /**
     * SSR prefetch seed for the default timeframe. page.tsx에서 queryClient seed로
     * 넣어도 되지만, panel이 직접 받아 useSectorSignalState → useSectorSignals로 전달해
     * 초기 hydration 전 데이터를 즉시 렌더한다.
     */
    initialData?: SectorSignalsResult;
}

/**
 * 스크린리더에 알리는 영역(live region)은 상태 줄(`SectorSignalStatusLine`) 하나뿐이다.
 * 섹션 전체를 live region으로 두면 탭·타임프레임을 바꿀 때마다 카드 전체가 낭독된다.
 */
export function SectorSignalPanel({
    scope,
    initialSector,
    initialTimeframe,
    initialData,
}: SectorSignalPanelProps) {
    const t = useTranslations('widgets.dashboard');
    const {
        activeSector,
        activeTimeframe,
        status,
        retry,
        view,
        handleSectorChange,
        handleTimeframeChange,
    } = useSectorSignalState({
        scope,
        initialSector,
        initialTimeframe,
        initialData,
    });

    return (
        <section
            aria-label={t('SectorSignalPanel.581217')}
            className="page-container sector-panel-bg relative py-10"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className={HEADING_SECTION}>
                    {t('SectorSignalPanel.581217')}
                </h2>
                <TimeframeSelector
                    timeframe={activeTimeframe}
                    onChange={handleTimeframeChange}
                />
            </div>
            <SectorTabs
                sectors={scope.signalSectors}
                activeSector={activeSector}
                onChange={handleSectorChange}
            />
            <SectorSignalStatusLine status={status} view={view} />
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
                aria-labelledby={`sector-tab-${activeSector}`}
                className="mt-6 flex flex-col gap-4"
            >
                <SectorSignalBody
                    scope={scope}
                    status={status}
                    view={view}
                    onRetry={retry}
                />
            </div>
        </section>
    );
}
