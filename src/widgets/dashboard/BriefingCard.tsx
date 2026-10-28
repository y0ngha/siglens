/**
 * 시장 브리핑 카드 — 요약·테마·섹터·변동성·심리·생성 시각을 한 카드로 조립한다.
 */
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { BriefingSectors } from './ui/briefing/BriefingSectors';
import { BriefingThemes } from './ui/briefing/BriefingThemes';
import { BriefingTimestamp } from './ui/briefing/BriefingTimestamp';
import { BriefingVolatility } from './ui/briefing/BriefingVolatility';
import { filterKnownSectors } from './utils/briefingSectors';

interface BriefingCardProps {
    briefing: MarketBriefingResponse;
    generatedAt: string;
    /** 어느 시장의 브리핑인가. 근거 없는 항목을 걸러내는 데 쓴다. */
    scope: ClientDashboardScope;
}

/** 브리핑 본문 카드. 모델 출력의 섹터명은 이 시장에 있는 것만 보여 준다. */
export function BriefingCard({
    briefing,
    generatedAt,
    scope,
}: BriefingCardProps) {
    const {
        summary,
        dominantThemes,
        sectorAnalysis,
        volatilityAnalysis,
        riskSentiment,
    } = briefing;

    return (
        <div className={cn(SURFACE_CARD, 'flex flex-col gap-3 p-4')}>
            {summary && (
                <p className="text-sm leading-relaxed text-secondary-300">
                    {summary}
                </p>
            )}
            <BriefingThemes themes={dominantThemes} />
            <BriefingSectors
                leadingSectors={filterKnownSectors(
                    sectorAnalysis.leadingSectors,
                    scope
                )}
                laggingSectors={filterKnownSectors(
                    sectorAnalysis.laggingSectors,
                    scope
                )}
                performanceDescription={sectorAnalysis.performanceDescription}
            />
            {/* 이 시장에 변동성 지수가 없으면 숫자도 해설도 통째로 뺀다 — 해설 문장이
                그 숫자를 그대로 인용하므로 둘을 따로 살릴 수 없다. */}
            {scope.volatilityIndexSymbol !== null && (
                <BriefingVolatility
                    indexSymbol={scope.volatilityIndexSymbol}
                    analysis={volatilityAnalysis}
                />
            )}
            {riskSentiment && (
                <p className="text-xs text-secondary-500">{riskSentiment}</p>
            )}
            <BriefingTimestamp generatedAt={generatedAt} />
        </div>
    );
}
