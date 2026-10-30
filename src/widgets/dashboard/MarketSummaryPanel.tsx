'use client';

/**
 * 시장 요약 패널 — 지수·섹터 그룹 카드와 AI 브리핑, 데이터 조회 실패 안내를 조립한다.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
    MarketBriefingResponse,
    MarketSectorData,
} from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { BriefingRegion } from './BriefingRegion';
import { useMarketBriefing } from './hooks/useMarketBriefing';
import { useMarketSummary } from './hooks/useMarketSummary';
import { MarketSummaryPanelSkeleton } from './MarketSummaryPanelSkeleton';
import { IndexGrid } from './ui/market-summary/IndexGrid';
import { MarketDataErrorNotice } from './ui/market-summary/MarketDataErrorNotice';
import { SectorGroupSection } from './ui/market-summary/SectorGroupSection';
import { panelHeadingKey } from './utils/marketLabelKeys';

interface MarketSummaryPanelProps {
    /** 어느 시장인가. 시세·브리핑 조회와 섹터 묶음, 섹션 제목이 전부 여기서 갈린다. */
    scope: ClientDashboardScope;
    peekSeed?: MarketBriefingResponse | null;
}

/**
 * 시세 조회가 끝나기 전에는 스켈레톤을, 요약이 아예 없으면 안내만(닫으면 빈 화면) 그린다.
 *
 * 라이브 영역(`aria-live="polite"`)은 지수·섹터 카드 갱신 낭독용으로 카드 그리드에만 둔다.
 * `role="alert"`(assertive)인 데이터 안내와 브리핑 영역(오류 카드 `role="alert"`, 로딩 카드
 * `role="status"`)을 그 안에 중첩하면 라이브리전이 경쟁하므로, 모두 polite 영역 밖에 렌더한다.
 */
export function MarketSummaryPanel({
    scope,
    peekSeed,
}: MarketSummaryPanelProps) {
    const t = useTranslations('widgets.dashboard');
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const { isPending, isTotalFailure, sectorMap, indices, hasMissingQuotes } =
        useMarketSummary(scope.id);
    const { input: briefing } = useMarketBriefing(scope.id, peekSeed);
    const headingKey = panelHeadingKey(scope.id);
    const heading = headingKey ? t(headingKey) : scope.marketLabel;

    if (isPending) return <MarketSummaryPanelSkeleton scope={scope} />;

    const showNotice = !noticeDismissed && (isTotalFailure || hasMissingQuotes);
    const dismissNotice = () => setNoticeDismissed(true);

    if (isTotalFailure) {
        if (!showNotice) return null;
        return (
            <section aria-label={heading} className="page-container py-10">
                <MarketDataErrorNotice
                    scopeId={scope.id}
                    variant="total"
                    onClose={dismissNotice}
                />
            </section>
        );
    }

    return (
        <section aria-label={heading} className="page-container py-10">
            <h2 className={cn('mb-6', HEADING_SECTION)}>{heading}</h2>
            {showNotice && (
                <MarketDataErrorNotice
                    scopeId={scope.id}
                    variant="partial"
                    onClose={dismissNotice}
                    className="mb-6"
                />
            )}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6" aria-live="polite">
                    <IndexGrid indices={indices} scope={scope} />
                    {/* 섹터 ETF — 그룹별 내부 링크 포함 (SEO) */}
                    <div className="flex flex-col gap-3">
                        {scope.sectorGroups.map(group => (
                            <SectorGroupSection
                                key={group.label}
                                label={group.label}
                                sectors={group.symbols
                                    .map(symbol => sectorMap.get(symbol))
                                    .filter(
                                        (sector): sector is MarketSectorData =>
                                            sector !== undefined
                                    )}
                                scope={scope}
                            />
                        ))}
                    </div>
                </div>
                <BriefingRegion input={briefing} scope={scope} />
            </div>
        </section>
    );
}
