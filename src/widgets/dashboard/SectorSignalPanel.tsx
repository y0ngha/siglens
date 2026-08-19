'use client';

import { useTranslations } from 'next-intl';
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
    const t = useTranslations('widgets.dashboard');
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
            aria-label={t('SectorSignalPanel.581217')}
            aria-live="polite"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-semibold tracking-[0.15em] text-secondary-200 uppercase">
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
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
                aria-labelledby={`sector-tab-${activeSector}`}
                className="mt-6 flex flex-col gap-4"
            >
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title={t('SectorSignalPanel.080a8a')}
                    marker="▲"
                    variant="confirmed"
                    stocks={quadrants.bullishConfirmed}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title={t('SectorSignalPanel.976db4')}
                    marker="△"
                    variant="expected"
                    stocks={quadrants.bullishExpected}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title={t('SectorSignalPanel.760c9a')}
                    marker="◈"
                    variant="mixed"
                    stocks={mixedStocks}
                    infoMessage={
                        <>
                            <p>{t('SectorSignalPanel.ede11c')}</p>
                            <p>{t('SectorSignalPanel.9c8687')}</p>
                        </>
                    }
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title={t('SectorSignalPanel.880a67')}
                    marker="▽"
                    variant="expected"
                    stocks={quadrants.bearishExpected}
                />
                <SignalSubsection
                    currencySymbol={scope.currencySymbol}
                    tickerIsReadable={scope.tickerIsReadable}
                    title={t('SectorSignalPanel.12526e')}
                    marker="▼"
                    variant="confirmed"
                    stocks={quadrants.bearishConfirmed}
                />
            </div>
        </section>
    );
}
