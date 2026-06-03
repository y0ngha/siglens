'use client';

import { Suspense, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { ErrorBoundary } from 'react-error-boundary';
import { IndexCard } from './IndexCard';
import {
    BriefingCard,
    BriefingErrorCard,
    BriefingLoadingCard,
} from './BriefingCard';
import { MarketDataErrorNotice } from './MarketDataErrorNotice';
import { useBriefing } from './hooks/useBriefing';
import { useMarketSummary } from './hooks/useMarketSummary';
import { MarketSummaryPanelSkeleton } from './MarketSummaryPanelSkeleton';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { SECTOR_GROUPS } from '@/shared/config/dashboard-tickers';
import type {
    MarketSectorData,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';

interface BriefingContentProps {
    jobId: string;
}

function BriefingContent({ jobId }: BriefingContentProps) {
    const result = useBriefing(jobId);
    if (result.status === 'processing') return <BriefingLoadingCard />;
    return (
        <BriefingCard
            briefing={result.briefing}
            generatedAt={result.generatedAt}
        />
    );
}

interface BriefingRegionProps {
    input: SubmitBriefingResult | null | undefined;
}

function BriefingRegion({ input }: BriefingRegionProps) {
    if (input === undefined) return null;
    if (input === null) return <BotBlockedNotice />;
    if (input.status === 'cached') {
        return (
            <BriefingCard
                briefing={input.briefing}
                generatedAt={input.generatedAt}
            />
        );
    }
    return (
        <ErrorBoundary fallback={<BriefingErrorCard />}>
            <Suspense fallback={<BriefingLoadingCard />}>
                <BriefingContent jobId={input.jobId} />
            </Suspense>
        </ErrorBoundary>
    );
}

export function MarketSummaryPanel() {
    const { data, isPending, sectorMap, indices, hasMissingQuotes, briefing } =
        useMarketSummary();
    const [noticeDismissed, setNoticeDismissed] = useState(false);

    if (isPending) return <MarketSummaryPanelSkeleton />;

    const isTotalFailure = data !== undefined && 'ok' in data;
    const showNotice = !noticeDismissed && (isTotalFailure || hasMissingQuotes);
    const dismissNotice = () => setNoticeDismissed(true);

    // 완전 실패(server_error)는 summary 자체가 없다 — 안내만 띄우고, 닫으면 기존처럼
    // 아무것도 렌더하지 않는다(빈 화면).
    if (isTotalFailure) {
        if (!showNotice) return null;
        return (
            <section
                aria-label="오늘의 미국 시장"
                className="px-6 py-10 lg:px-[15vw]"
            >
                <MarketDataErrorNotice onClose={dismissNotice} />
            </section>
        );
    }

    // aria-live="polite"는 카드/브리핑 갱신 announce용으로 데이터 div에만 둔다.
    // role="alert"(assertive)인 안내를 그 안에 중첩하면 라이브리전이 경쟁하므로,
    // 안내는 polite 영역 밖(제목 아래·그리드 위)에 렌더한다.
    return (
        <section
            aria-label="오늘의 미국 시장"
            className="px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase">
                오늘의 미국 시장
            </h2>
            {showNotice && (
                <MarketDataErrorNotice
                    onClose={dismissNotice}
                    className="mb-6"
                />
            )}
            <div className="flex flex-col gap-6" aria-live="polite">
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
                                    className={cn(
                                        'grid gap-2',
                                        groupSectors.length === 3
                                            ? 'grid-cols-3'
                                            : 'grid-cols-4'
                                    )}
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

                <BriefingRegion input={briefing} />
            </div>
        </section>
    );
}
