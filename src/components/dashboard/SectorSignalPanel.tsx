'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type {
    Signal,
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/signals/types';
import {
    SIGNAL_SECTORS,
    type DashboardTimeframe,
} from '@/domain/constants/dashboard-tickers';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';

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

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, initialTimeframe);
    };

    const handleTimeframeChange = (next: DashboardTimeframe) => {
        updateUrl(activeSector, next);
    };

    const filtered = useMemo(() => filterStrict(data.stocks), [data.stocks]);

    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );

    const quadrants = useMemo(() => {
        // Local accumulators — object leaves callback as stable result; internal push
        // is acceptable per convention (immutable contract is on the exported value).
        const buckets = {
            bullishConfirmed: [] as StockSignalResult[],
            bullishExpected: [] as StockSignalResult[],
            bearishExpected: [] as StockSignalResult[],
            bearishConfirmed: [] as StockSignalResult[],
        };
        for (const stock of sectorStocks) {
            const byQuadrant: Record<keyof typeof buckets, Signal[]> = {
                bullishConfirmed: [],
                bullishExpected: [],
                bearishExpected: [],
                bearishConfirmed: [],
            };
            for (const s of stock.signals) {
                const key =
                    s.direction === 'bullish' && s.phase === 'confirmed'
                        ? 'bullishConfirmed'
                        : s.direction === 'bullish' && s.phase === 'expected'
                          ? 'bullishExpected'
                          : s.direction === 'bearish' && s.phase === 'expected'
                            ? 'bearishExpected'
                            : 'bearishConfirmed';
                byQuadrant[key].push(s);
            }
            for (const key of Object.keys(buckets) as Array<
                keyof typeof buckets
            >) {
                if (byQuadrant[key].length > 0) {
                    buckets[key].push({ ...stock, signals: byQuadrant[key] });
                }
            }
        }
        return buckets;
    }, [sectorStocks]);

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
                    timeframe={initialTimeframe}
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
