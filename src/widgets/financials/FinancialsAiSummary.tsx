'use client';

import { useMemo } from 'react';
import type {
    FinancialsAnalysisResponse,
    FinancialsSentiment,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { AXIS_LABEL_KO } from './axisLabels';
import { useDefaultModelId } from '@/features/symbol-model';
import { useFinancialsAnalysis } from './hooks/useFinancialsAnalysis';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { buildChatState } from './utils/buildChatState';
import { FinancialsAiSummaryError } from './FinancialsAiSummaryError';
import { FinancialsAiSummarySkeleton } from './FinancialsAiSummarySkeleton';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';

const SENTIMENT_LABEL: Record<FinancialsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<FinancialsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

interface FinancialsAiSummaryViewProps {
    result: FinancialsAnalysisResponse;
}

function FinancialsAiSummaryView({ result }: FinancialsAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="financials-ai-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="financials-ai-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 재무제표 분석
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

            {result.axisAssessments.length > 0 && (
                <ul aria-label="축별 평가" className="mb-5 space-y-3">
                    {result.axisAssessments.map(a => (
                        <li
                            key={a.axis}
                            className="bg-secondary-800/40 rounded-lg p-3"
                        >
                            <div className="mb-1 flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    {AXIS_LABEL_KO[a.axis]}
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
                    ))}
                </ul>
            )}

            {result.riskFactorsKo.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">위험 요인</h3>
                    <ul className="space-y-1.5">
                        {result.riskFactorsKo.map((risk, i) => (
                            <li
                                key={`risk-${i}-${risk}`}
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

interface FinancialsAiSummaryProps {
    symbol: string;
}

export function FinancialsAiSummary({ symbol }: FinancialsAiSummaryProps) {
    const modelId = useDefaultModelId();
    const state = useFinancialsAnalysis(symbol, modelId);

    // bot_blocked/loading/error 시에도 chatState를 명시적으로 publish하여 챗봇이
    // 이전 페이지의 stale context를 그대로 들고 가지 않게 한다.
    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    const chatState = useMemo(() => buildChatState(state), [state]);
    usePublishSymbolChat(chatState);

    if (state.status === 'loading') {
        return <FinancialsAiSummarySkeleton />;
    }

    if (state.status === 'bot_blocked') {
        return <BotBlockedNotice />;
    }

    if (state.status === 'error') {
        return (
            <FinancialsAiSummaryError
                error={state.error}
                resetErrorBoundary={state.retry}
            />
        );
    }

    return <FinancialsAiSummaryView result={state.result} />;
}
