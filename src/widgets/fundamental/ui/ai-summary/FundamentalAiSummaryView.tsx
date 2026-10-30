/**
 * 펀더멘털 AI 분석 결과 뷰 — 공유 패널(`kindPanelRegistry`)과 종목 탭이 함께 쓴다.
 */
import { useTranslations } from 'next-intl';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { CategoryAssessmentList } from './CategoryAssessmentList';
import { RiskFactorList } from './RiskFactorList';
import { SentimentBadge } from './SentimentBadge';

interface FundamentalAiSummaryViewProps {
    result: FundamentalAnalysisResponse;
}

/** 종합 감성·결론·카테고리 평가·리스크를 한 카드로 보여 준다. */
export function FundamentalAiSummaryView({
    result,
}: FundamentalAiSummaryViewProps) {
    const t = useTranslations('widgets.fundamental');
    return (
        <section
            aria-labelledby="ai-summary-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="ai-summary-heading" className={HEADING_SECTION}>
                    {t('FundamentalAiSummary.17769c')}
                </h2>
                <SentimentBadge
                    sentiment={result.overallSentiment}
                    sizeClassName="px-2 py-0.5"
                />
            </div>

            <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                {result.overallConclusionKo}
            </p>

            <CategoryAssessmentList assessments={result.categoryAssessments} />
            <RiskFactorList risks={result.riskFactorsKo} />
        </section>
    );
}
