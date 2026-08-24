'use client';

import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { useSectorSignalState } from './hooks/useSectorSignalState';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';

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

export function SectorSignalPanel({
    scope,
    initialSector,
    initialTimeframe,
    initialData,
}: SectorSignalPanelProps) {
    const {
        activeSector,
        activeTimeframe,
        quadrants,
        mixedStocks,
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
            aria-label="섹터별 신호 모아보기"
            aria-live="polite"
            className="page-container sector-panel-bg relative py-10"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-semibold tracking-[0.01em] text-secondary-200">
                    섹터별 신호 모아보기
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
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
                aria-labelledby={`sector-tab-${activeSector}`}
                className="mt-6 flex flex-col gap-4"
            >
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title="상승 신호"
                    marker="▲"
                    variant="confirmed"
                    stocks={quadrants.bullishConfirmed}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title="상승 조짐"
                    marker="△"
                    variant="expected"
                    stocks={quadrants.bullishExpected}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title="혼재"
                    marker="◈"
                    variant="mixed"
                    stocks={mixedStocks}
                    infoMessage={
                        <>
                            <p>
                                상승 신호와 하락 신호의 강도가 비슷한
                                종목들이에요.
                            </p>
                            <p>
                                어느 쪽으로 움직일지 방향이 명확하지 않으니
                                신중하게 보는 게 좋아요.
                            </p>
                        </>
                    }
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title="하락 조짐"
                    marker="▽"
                    variant="expected"
                    stocks={quadrants.bearishExpected}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title="하락 신호"
                    marker="▼"
                    variant="confirmed"
                    stocks={quadrants.bearishConfirmed}
                />
            </div>
        </section>
    );
}
