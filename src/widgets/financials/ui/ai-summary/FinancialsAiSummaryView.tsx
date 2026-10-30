/**
 * 재무 AI 요약 결과 본문 — 전체 결론, 축별 평가, 위험 요인. 공유 페이지도 이 뷰를 그대로 쓴다.
 */
import { useTranslations } from 'next-intl';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { AxisAssessmentList } from './AxisAssessmentList';
import { RiskFactorList } from './RiskFactorList';
import { SentimentBadge } from './SentimentBadge';

interface FinancialsAiSummaryViewProps {
    result: FinancialsAnalysisResponse;
}

/** 분석 결과를 카드 하나로 그린다. */
export function FinancialsAiSummaryView({
    result,
}: FinancialsAiSummaryViewProps) {
    const t = useTranslations('widgets.financials');
    return (
        <section
            aria-labelledby="financials-ai-summary-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="financials-ai-summary-heading"
                    className={HEADING_SECTION}
                >
                    {t('FinancialsAiSummary.26f860')}
                </h2>
                <SentimentBadge
                    sentiment={result.overallSentiment}
                    sizeClassName="px-2 py-0.5"
                />
            </div>

            <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                {result.overallConclusionKo}
            </p>

            <AxisAssessmentList assessments={result.axisAssessments} />
            <RiskFactorList risks={result.riskFactorsKo} />
        </section>
    );
}
