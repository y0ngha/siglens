'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type {
    DashboardTimeframe,
    Signal,
    SignalDirection,
    SignalPhase,
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/types';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';
import type { ConflictInfo, StockWithConflict } from './conflict-types';

type QuadrantKey =
    | 'bullishConfirmed'
    | 'bullishExpected'
    | 'bearishExpected'
    | 'bearishConfirmed';

const EMPTY_QUADRANTS: Record<QuadrantKey, readonly StockWithConflict[]> = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

const SIGNAL_TO_QUADRANT: Record<
    SignalDirection,
    Record<SignalPhase, QuadrantKey>
> = {
    bullish: {
        confirmed: 'bullishConfirmed',
        expected: 'bullishExpected',
    },
    bearish: {
        confirmed: 'bearishConfirmed',
        expected: 'bearishExpected',
    },
};

function signalToQuadrantKey(s: Signal): QuadrantKey {
    return SIGNAL_TO_QUADRANT[s.direction][s.phase];
}

function groupStockIntoQuadrants(
    acc: Record<QuadrantKey, readonly StockWithConflict[]>,
    stock: StockWithConflict
): Record<QuadrantKey, readonly StockWithConflict[]> {
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
}

function resolveConflicts(stocks: readonly StockSignalResult[]): {
    resolved: readonly StockWithConflict[];
    mixed: readonly StockWithConflict[];
} {
    return stocks.reduce<{
        resolved: StockWithConflict[];
        mixed: StockWithConflict[];
    }>(
        (acc, stock) => {
            const { bullishCount, bearishCount } = stock.signals.reduce(
                (counts, s) => ({
                    bullishCount:
                        counts.bullishCount + (s.direction === 'bullish' ? 1 : 0),
                    bearishCount:
                        counts.bearishCount + (s.direction === 'bearish' ? 1 : 0),
                }),
                { bullishCount: 0, bearishCount: 0 }
            );

            if (bullishCount === 0 || bearishCount === 0) {
                return { ...acc, resolved: [...acc.resolved, stock] };
            }

            const conflict: ConflictInfo = { bullishCount, bearishCount };

            if (bullishCount === bearishCount) {
                return { ...acc, mixed: [...acc.mixed, { ...stock, conflict }] };
            }

            const winningDirection: SignalDirection =
                bullishCount > bearishCount ? 'bullish' : 'bearish';
            const filteredSignals = stock.signals.filter(
                s => s.direction === winningDirection
            );
            return {
                ...acc,
                resolved: [
                    ...acc.resolved,
                    { ...stock, signals: filteredSignals, conflict },
                ],
            };
        },
        { resolved: [], mixed: [] }
    );
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
            if (nextTimeframe === DEFAULT_DASHBOARD_TIMEFRAME)
                params.delete('timeframe');
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

    const { resolved: resolvedStocks, mixed: mixedStocks } = useMemo(
        () => resolveConflicts(sectorStocks),
        [sectorStocks]
    );

    const quadrants = useMemo(
        () => resolvedStocks.reduce(groupStockIntoQuadrants, EMPTY_QUADRANTS),
        [resolvedStocks]
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
                    title="혼재"
                    marker="⚡"
                    variant="mixed"
                    stocks={mixedStocks}
                    infoMessage="상승 신호와 하락 신호의 강도가 동일하다. 방향을 알 수 없다."
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
