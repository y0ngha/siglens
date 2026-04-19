'use client';

import { useMemo } from 'react';
import { IndexCard } from './IndexCard';
import { BriefingCard } from './BriefingCard';
import { useBriefing } from './hooks/useBriefing';
import { useMarketSummary } from './hooks/useMarketSummary';
import { MarketSummaryPanelSkeleton } from './MarketSummaryPanelSkeleton';
import { SECTOR_GROUPS } from '@/domain/constants/dashboard-tickers';
import type { MarketSectorData } from '@/domain/types';

export function MarketSummaryPanel() {
    const { data, isPending } = useMarketSummary();

    const { briefing, generatedAt, isLoading, error } = useBriefing(
        data?.briefing.status === 'submitted' ? data.briefing.jobId : undefined,
        data?.briefing.status === 'cached' ? data.briefing.briefing : undefined,
        data?.briefing.status === 'cached'
            ? data.briefing.generatedAt
            : undefined
    );

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (data?.summary.sectors ?? []).map(s => [s.symbol, s])
            ),
        [data?.summary.sectors]
    );

    const indices = data?.summary.indices ?? [];

    if (isPending) return <MarketSummaryPanelSkeleton />;

    return (
        <section
            aria-label="시장 현황"
            aria-live="polite"
            className="px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase">
                시장 현황
            </h2>
            <div className="flex flex-col gap-6">
                {/* 주요 지수 */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {indices.map(idx => (
                        <IndexCard key={idx.fmpSymbol} data={idx} />
                    ))}
                </div>

                {/* 섹터 ETF — 그룹별 내부 링크 포함 (SEO) */}
                <div className="flex flex-col gap-3">
                    {SECTOR_GROUPS.map(group => {
                        const groupSectors = group.symbols
                            .map(sym => sectorMap.get(sym))
                            .filter(
                                (s): s is MarketSectorData => s !== undefined
                            );

                        return (
                            <div key={group.label}>
                                <p className="text-secondary-500 mb-1.5 text-[10px] tracking-wider uppercase">
                                    {group.label}
                                </p>
                                <div
                                    className={`grid gap-2 ${groupSectors.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
                                >
                                    {groupSectors.map(etf => (
                                        <IndexCard
                                            key={etf.symbol}
                                            data={etf}
                                            href={`/${etf.symbol}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* AI 브리핑 */}
                <BriefingCard
                    briefing={briefing}
                    generatedAt={generatedAt}
                    isLoading={isLoading}
                    error={error}
                />
            </div>
        </section>
    );
}
