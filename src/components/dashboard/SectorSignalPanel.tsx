'use client';

import type { ReactElement } from 'react';
import type { DashboardTimeframe, SectorSignalsResult } from '@/domain/types';
import { useSectorSignalState } from './hooks/useSectorSignalState';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

export function SectorSignalPanel({
    data,
    initialSector,
    initialTimeframe,
}: SectorSignalPanelProps): ReactElement {
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
                    infoMessage="상승 신호와 하락 신호의 강도가 동일합니다. 방향을 알 수 없습니다."
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
