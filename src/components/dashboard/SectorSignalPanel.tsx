'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Signal, SectorSignalsResult, StockSignalResult } from '@/domain/signals/types';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';
import { useStrictModeToggle } from './hooks/useStrictModeToggle';
import { SectorTabs } from './SectorTabs';
import { StrictModeToggle } from './StrictModeToggle';
import { SignalSubsection } from './SignalSubsection';

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialStrict: boolean;
}

function filterByStrict(
    stocks: readonly StockSignalResult[],
    strict: boolean
): readonly StockSignalResult[] {
    if (!strict) return stocks;
    const result: StockSignalResult[] = [];
    for (const stock of stocks) {
        const filtered = stock.signals.filter(sig => {
            if (sig.phase === 'confirmed') return true;
            if (sig.direction === 'bullish') return stock.trend !== 'uptrend';
            return stock.trend !== 'downtrend';
        });
        if (filtered.length === 0) continue;
        result.push({ ...stock, signals: filtered });
    }
    return result;
}

export function SectorSignalPanel({ data, initialSector, initialStrict }: SectorSignalPanelProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeSector, setActiveSector] = useState(initialSector);
    const [strict, setStrict] = useStrictModeToggle(initialStrict);

    const updateUrl = (nextSector: string, nextStrict: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextSector === SECTOR_ETFS[0].symbol) params.delete('sector');
        else params.set('sector', nextSector);
        if (nextStrict) params.delete('strict');
        else params.set('strict', '0');
        const qs = params.toString();
        router.replace(qs === '' ? pathname : `${pathname}?${qs}`, { scroll: false });
    };

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, strict);
    };

    const handleStrictChange = (next: boolean) => {
        setStrict(next);
        updateUrl(activeSector, next);
    };

    const filtered = useMemo(() => filterByStrict(data.stocks, strict), [data.stocks, strict]);

    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );

    const quadrants = useMemo(() => {
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
                    s.direction === 'bullish' && s.phase === 'confirmed' ? 'bullishConfirmed' :
                    s.direction === 'bullish' && s.phase === 'expected'  ? 'bullishExpected' :
                    s.direction === 'bearish' && s.phase === 'expected'  ? 'bearishExpected' :
                                                                            'bearishConfirmed';
                byQuadrant[key].push(s);
            }
            for (const key of Object.keys(buckets) as Array<keyof typeof buckets>) {
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
                <StrictModeToggle strict={strict} onChange={handleStrictChange} />
            </div>
            <SectorTabs activeSector={activeSector} onChange={handleSectorChange} />
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
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
