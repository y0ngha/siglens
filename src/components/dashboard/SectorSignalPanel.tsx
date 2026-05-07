'use client';

import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { useSectorSignalState } from '@/components/dashboard/hooks/useSectorSignalState';
import { SectorTabs } from '@/components/dashboard/SectorTabs';
import { TimeframeSelector } from '@/components/dashboard/TimeframeSelector';
import { SignalSubsection } from '@/components/dashboard/SignalSubsection';

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

export function SectorSignalPanel({
    data,
    initialSector,
    initialTimeframe,
}: SectorSignalPanelProps) {
    const {
        activeSector,
        activeTimeframe,
        quadrants,
        mixedStocks,
        handleSectorChange,
        handleTimeframeChange,
    } = useSectorSignalState({
        data,
        initialSector,
        initialTimeframe,
    });

    return (
        <section
            aria-label="섹터 신호 탐색"
            aria-live="polite"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-secondary-200 text-sm font-semibold tracking-[0.15em] uppercase">
                    섹터 신호 탐색
                </h2>
                <TimeframeSelector
                    timeframe={activeTimeframe}
                    onChange={handleTimeframeChange}
                />
            </div>
            <SectorTabs
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
                    title="상승 신호"
                    marker="▲"
                    variant="confirmed"
                    stocks={quadrants.bullishConfirmed}
                />
                <SignalSubsection
                    title="상승 조짐"
                    marker="△"
                    variant="expected"
                    stocks={quadrants.bullishExpected}
                />
                <SignalSubsection
                    title="혼재"
                    marker="◈"
                    variant="mixed"
                    stocks={mixedStocks}
                    infoMessage={
                        <>
                            <p>상승 신호와 하락 신호의 강도가 비슷한 종목들이에요.</p>
                            <p>어느 쪽으로 움직일지 방향이 명확하지 않으니 신중하게 보는 게 좋아요.</p>
                        </>
                    }
                />
                <SignalSubsection
                    title="하락 조짐"
                    marker="▽"
                    variant="expected"
                    stocks={quadrants.bearishExpected}
                />
                <SignalSubsection
                    title="하락 신호"
                    marker="▼"
                    variant="confirmed"
                    stocks={quadrants.bearishConfirmed}
                />
            </div>
        </section>
    );
}
