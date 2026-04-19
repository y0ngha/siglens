'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type {
    DashboardTimeframe,
    Signal,
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/types';
import { SIGNAL_SECTORS } from '@/domain/constants/dashboard-tickers';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';

type QuadrantKey =
    | 'bullishConfirmed'
    | 'bullishExpected'
    | 'bearishExpected'
    | 'bearishConfirmed';

const EMPTY_QUADRANTS: Record<QuadrantKey, readonly StockSignalResult[]> = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

function signalToQuadrantKey(s: Signal): QuadrantKey {
    if (s.direction === 'bullish' && s.phase === 'confirmed')
        return 'bullishConfirmed';
    if (s.direction === 'bullish' && s.phase === 'expected')
        return 'bullishExpected';
    if (s.direction === 'bearish' && s.phase === 'expected')
        return 'bearishExpected';
    return 'bearishConfirmed';
}

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

// Strict mode is always on: anticipation signals only visible when the stock's
// trend opposes or is sideways relative to the signal's direction.
function filterStrict(
    stocks: readonly StockSignalResult[]
): readonly StockSignalResult[] {
    return stocks.flatMap(stock => {
        const filtered = stock.signals.filter(sig => {
            if (sig.phase === 'confirmed') return true;
            if (sig.direction === 'bullish') return stock.trend !== 'uptrend';
            return stock.trend !== 'downtrend';
        });
        return filtered.length === 0 ? [] : [{ ...stock, signals: filtered }];
    });
}

export function SectorSignalPanel({
    data,
    initialSector,
    initialTimeframe,
}: SectorSignalPanelProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeSector, setActiveSector] = useState(initialSector);
    const [activeTimeframe, setActiveTimeframe] = useState(initialTimeframe);

    const updateUrl = useCallback(
        (nextSector: string, nextTimeframe: DashboardTimeframe) => {
            const params = new URLSearchParams(searchParams.toString());
            if (nextSector === SIGNAL_SECTORS[0].symbol)
                params.delete('sector');
            else params.set('sector', nextSector);
            if (nextTimeframe === '1Day') params.delete('timeframe');
            else params.set('timeframe', nextTimeframe);
            const qs = params.toString();
            router.replace(qs === '' ? pathname : `${pathname}?${qs}`, {
                scroll: false,
            });
        },
        [router, pathname, searchParams]
    );

    const filtered = useMemo(() => filterStrict(data.stocks), [data.stocks]);

    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );

    const quadrants = useMemo(
        () =>
            sectorStocks.reduce<
                Record<QuadrantKey, readonly StockSignalResult[]>
            >((acc, stock) => {
                const grouped = stock.signals.reduce<
                    Record<QuadrantKey, readonly Signal[]>
                >(
                    (g, s) => {
                        const key = signalToQuadrantKey(s);
                        return { ...g, [key]: [...g[key], s] };
                    },
                    {
                        bullishConfirmed: [],
                        bullishExpected: [],
                        bearishExpected: [],
                        bearishConfirmed: [],
                    }
                );
                return (Object.keys(grouped) as QuadrantKey[]).reduce(
                    (next, key) =>
                        grouped[key].length === 0
                            ? next
                            : {
                                  ...next,
                                  [key]: [
                                      ...next[key],
                                      { ...stock, signals: grouped[key] },
                                  ],
                              },
                    acc
                );
            }, EMPTY_QUADRANTS),
        [sectorStocks]
    );

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, activeTimeframe);
    };

    const handleTimeframeChange = (next: DashboardTimeframe) => {
        setActiveTimeframe(next);
        updateUrl(activeSector, next);
    };

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
