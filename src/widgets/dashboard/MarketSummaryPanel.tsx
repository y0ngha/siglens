'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION, LABEL_KO } from '@/shared/lib/typographyStyles';
import { IndexCard } from './IndexCard';
import {
    BriefingCard,
    BriefingErrorCard,
    BriefingLoadingCard,
} from './BriefingCard';
import { MarketDataErrorNotice } from './MarketDataErrorNotice';
import { useMarketSummary } from './hooks/useMarketSummary';
import { useMarketBriefing } from './hooks/useMarketBriefing';
import { MarketSummaryPanelSkeleton } from './MarketSummaryPanelSkeleton';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import type {
    MarketBriefingResponse,
    MarketSectorData,
    RunBriefingResult,
} from '@y0ngha/siglens-core';

interface BriefingRegionProps {
    input: RunBriefingResult | null | 'error' | undefined;
    scope: ClientDashboardScope;
}

function BriefingRegion({ input, scope }: BriefingRegionProps) {
    if (input === undefined) return null;
    if (input === null) return <BotBlockedNotice />;
    if (input === 'error') return <BriefingErrorCard />;
    // Both 'cached' and 'done' have briefing + generatedAt — no Suspense needed
    // because run* is blocking and always returns a complete result.
    if (input.status === 'cached' || input.status === 'done') {
        return (
            <BriefingCard
                briefing={input.briefing}
                generatedAt={input.generatedAt}
                scope={scope}
            />
        );
    }
    // Fallback: unexpected status — render loading skeleton (defensive)
    return <BriefingLoadingCard />;
}

interface MarketSummaryPanelProps {
    /** 어느 시장인가. 시세·브리핑 조회와 섹터 묶음, 섹션 제목이 전부 여기서 갈린다. */
    scope: ClientDashboardScope;
    peekSeed?: MarketBriefingResponse | null;
}

/**
 * 섹션 제목 겸 랜드마크 라벨. 지역 탭이 위에 있어도 "지금 보고 있는 게 어느 시장인지"를
 * 제목이 한 번 더 말해 줘야 한다 — 스크린리더는 탭의 활성 상태를 이 섹션과 함께
 * 읽어 주지 않는다.
 */
const PANEL_HEADING: Record<ClientDashboardScope['id'], string> = {
    us: '오늘의 미국 시장',
    kr: '오늘의 한국 시장',
};

export function MarketSummaryPanel({
    scope,
    peekSeed,
}: MarketSummaryPanelProps) {
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const { data, isPending, sectorMap, indices, hasMissingQuotes } =
        useMarketSummary(scope.id);
    const { input: briefing } = useMarketBriefing(scope.id, peekSeed);
    const heading = PANEL_HEADING[scope.id];

    if (isPending) return <MarketSummaryPanelSkeleton scope={scope} />;

    const isTotalFailure = data !== undefined && 'ok' in data;
    const showNotice = !noticeDismissed && (isTotalFailure || hasMissingQuotes);
    const dismissNotice = () => setNoticeDismissed(true);

    // 완전 실패(server_error)는 summary 자체가 없다 — 안내만 띄우고, 닫으면 기존처럼
    // 아무것도 렌더하지 않는다(빈 화면).
    if (isTotalFailure) {
        if (!showNotice) return null;
        return (
            <section aria-label={heading} className="page-container py-10">
                <MarketDataErrorNotice
                    marketLabel={scope.marketLabel}
                    variant="total"
                    onClose={dismissNotice}
                />
            </section>
        );
    }

    // aria-live="polite"는 카드/브리핑 갱신 announce용으로 데이터 div에만 둔다.
    // role="alert"(assertive)인 안내를 그 안에 중첩하면 라이브리전이 경쟁하므로,
    // 안내는 polite 영역 밖(제목 아래·그리드 위)에 렌더한다.
    return (
        <section aria-label={heading} className="page-container py-10">
            <h2 className={cn('mb-6', HEADING_SECTION)}>{heading}</h2>
            {showNotice && (
                <MarketDataErrorNotice
                    marketLabel={scope.marketLabel}
                    variant="partial"
                    onClose={dismissNotice}
                    className="mb-6"
                />
            )}
            <div className="flex flex-col gap-6" aria-live="polite">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {indices.map(idx => (
                        <IndexCard
                            key={idx.fmpSymbol}
                            data={idx}
                            currencySymbol={scope.currencySymbol}
                            tickerIsReadable={scope.tickerIsReadable}
                        />
                    ))}
                </div>

                {/* 섹터 ETF — 그룹별 내부 링크 포함 (SEO) */}
                <div className="flex flex-col gap-3">
                    {scope.sectorGroups.map(group => {
                        const groupSectors = group.symbols
                            .map(sym => sectorMap.get(sym))
                            .filter(
                                (s): s is MarketSectorData => s !== undefined
                            );

                        return (
                            <div key={group.label}>
                                <p className={cn('mb-1.5', LABEL_KO)}>
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
                                            currencySymbol={
                                                scope.currencySymbol
                                            }
                                            tickerIsReadable={
                                                scope.tickerIsReadable
                                            }
                                            {...(scope.linkSectorCards
                                                ? { href: `/${etf.symbol}` }
                                                : {})}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <BriefingRegion input={briefing} scope={scope} />
            </div>
        </section>
    );
}
