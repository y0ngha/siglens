'use client';

import type { MarketIndexData, MarketSectorData } from '@/domain/types';
import { IndexCard } from './IndexCard';
import { useBriefing } from './hooks/useBriefing';

interface MarketSummaryPanelProps {
    indices: MarketIndexData[];
    sectors: MarketSectorData[];
    initialBriefing?: string;
    briefingJobId?: string;
}

export function MarketSummaryPanel({
    indices,
    sectors,
    initialBriefing,
    briefingJobId,
}: MarketSummaryPanelProps) {
    const { briefing, isLoading, error } = useBriefing(
        briefingJobId,
        initialBriefing
    );

    return (
        <section
            aria-label="시장 현황"
            aria-live="polite"
            className="px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                시장 현황
            </h2>
            <div className="flex flex-col gap-4">
                {/* 주요 지수 */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {indices.map(idx => (
                        <IndexCard key={idx.fmpSymbol} data={idx} />
                    ))}
                </div>

                {/* 섹터 ETF — 내부 링크 포함 (SEO) */}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
                    {sectors.map(etf => (
                        <IndexCard
                            key={etf.symbol}
                            data={etf}
                            href={`/${etf.symbol}`}
                        />
                    ))}
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
