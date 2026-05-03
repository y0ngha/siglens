'use client';

import {
    type FundamentalAnalysisResponse,
    type FundamentalCategory,
    type FundamentalCategoryAssessment,
    type FundamentalSentiment,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import { useDefaultModelId } from '@/components/symbol-page/hooks/useDefaultModelId';
import { useFundamentalAnalysis } from '@/components/fundamental/hooks/useFundamentalAnalysis';

const SENTIMENT_LABEL: Record<FundamentalSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<FundamentalSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-ui-warning/10 text-ui-warning',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

const CATEGORY_LABEL: Record<FundamentalCategory, string> = {
    valuation: '밸류에이션',
    profitability: '수익성',
    growth: '성장성',
    health: '재무 건전성',
    futureDirection: '미래 방향',
};

interface FundamentalAiSummaryViewProps {
    result: FundamentalAnalysisResponse;
}

function FundamentalAiSummaryView({ result }: FundamentalAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="ai-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="ai-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 펀더멘털 분석
                </h2>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {SENTIMENT_LABEL[result.overallSentiment]}
                </span>
            </div>

            <p className="text-secondary-400 mb-5 text-sm leading-relaxed">
                {result.overallConclusionKo}
            </p>

            {result.categoryAssessments.length > 0 && (
                <ul aria-label="카테고리별 평가" className="mb-5 space-y-3">
                    {result.categoryAssessments.map(
                        (a: FundamentalCategoryAssessment) => (
                            <li
                                key={a.category}
                                className="bg-secondary-800/40 rounded-lg p-3"
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                        {CATEGORY_LABEL[a.category] ??
                                            a.category}
                                    </span>
                                    <span
                                        className={cn(
                                            'rounded px-1.5 py-0.5 text-xs font-medium',
                                            SENTIMENT_CLASS[a.sentiment]
                                        )}
                                    >
                                        {SENTIMENT_LABEL[a.sentiment]}
                                    </span>
                                </div>
                                <p className="text-secondary-400 text-sm leading-relaxed">
                                    {a.rationaleKo}
                                </p>
                            </li>
                        )
                    )}
                </ul>
            )}

            {result.riskFactorsKo.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">위험 요인</h3>
                    <ul className="space-y-1.5">
                        {result.riskFactorsKo.map((risk, i) => (
                            <li
                                key={i}
                                className="text-secondary-400 flex gap-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                {risk}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

interface FundamentalAiSummaryProps {
    symbol: string;
}

export function FundamentalAiSummary({ symbol }: FundamentalAiSummaryProps) {
    const modelId = useDefaultModelId();
    const result = useFundamentalAnalysis(symbol, modelId);

    return <FundamentalAiSummaryView result={result} />;
}
