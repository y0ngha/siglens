'use client';

import { useMemo } from 'react';
import { IndexCard } from './IndexCard';
import { useBriefing } from './hooks/useBriefing';
import { useMarketSummary } from './hooks/useMarketSummary';
import { MarketSummaryPanelSkeleton } from './MarketSummaryPanelSkeleton';
import { SECTOR_GROUPS } from '@/domain/constants/dashboard-tickers';
import type { MarketSectorData } from '@/domain/types';

export function MarketSummaryPanel() {
    const { data, isPending } = useMarketSummary();

    const indices = data?.summary.indices ?? [];
    const rawSectors = data?.summary.sectors;
    const briefingJobId =
        data?.briefing.status === 'submitted' ? data.briefing.jobId : undefined;
    const initialBriefing =
        data?.briefing.status === 'cached' ? data.briefing.briefing : undefined;

    const { briefing, isLoading, error } = useBriefing(
        briefingJobId,
        initialBriefing
    );

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (rawSectors ?? []).map(s => [s.symbol, s])
            ),
        [rawSectors]
    );

    if (isPending) return <MarketSummaryPanelSkeleton />;

    return (
        <section
            aria-label="시장 현황"
            aria-live="polite"
            className="px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
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
                                <p className="text-secondary-500 mb-1.5 text-xs">
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
                <div className="border-secondary-700/50 rounded-lg border p-4">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="bg-secondary-700/50 h-2 w-2 animate-pulse rounded-full" />
                            <p className="text-secondary-500 text-sm">
                                AI 브리핑 생성 중...
                            </p>
                        </div>
                    ) : briefing ? (
                        <p className="text-secondary-300 text-sm leading-relaxed">
                            {briefing}
                        </p>
                    ) : error ? (
                        <p className="text-chart-bearish text-sm">
                            브리핑을 불러오지 못했습니다.
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
