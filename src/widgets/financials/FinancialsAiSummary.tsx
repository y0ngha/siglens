'use client';

import { useMemo } from 'react';
import type {
    FinancialsAnalysisResponse,
    FinancialsSentiment,
} from '@y0ngha/siglens-core';
import { useRegisterShareable, mapAnalysisStatus } from '@/features/share';
import { cn } from '@/shared/lib/cn';
import { AXIS_LABEL_KO } from './axisLabels';
import {
    useDefaultModelId,
    useDefaultReasoning,
    useAnalysisSettingsHydrated,
} from '@/features/symbol-model';
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

export function FinancialsAiSummaryView({
    result,
}: FinancialsAiSummaryViewProps) {
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
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * 이 경우 위젯은 **UI만 숨기고 마운트는 유지**한다. 페이지가 위젯을 아예
     * 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석 컨텍스트가
     * 비고, 그 결과 "분석이 완료된 후 질문할 수 있어요"로 입력이 잠긴다 —
     * 스냅샷(=분석 결과)이 있을수록 챗이 막히는 역전이 생긴다. 중복 텍스트를
     * 없애려던 원래 의도는 렌더만 건너뛰면 충족되므로, 훅은 그대로 돌려
     * 타입 완전한 분석 결과를 챗 컨텍스트로 publish한다.
     */
    hideView?: boolean;
}

export function FinancialsAiSummary({
    symbol,
    hideView = false,
}: FinancialsAiSummaryProps) {
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const state = useFinancialsAnalysis(
        symbol,
        modelId,
        reasoning,
        isSettingsHydrated
    );

    // bot_blocked/loading/error 시에도 chatState를 명시적으로 publish하여 챗봇이
    // 이전 페이지의 stale context를 그대로 들고 가지 않게 한다.
    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    const chatState = useMemo(() => buildChatState(state), [state]);
    usePublishSymbolChat(chatState);
    useRegisterShareable({
        kind: 'financials',
        status: mapAnalysisStatus(state.status),
        result: state.status === 'done' ? state.result : null,
        context: {
            symbol,
            displayName: symbol,
            // FinancialsAnalysisResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        trigger: state.trigger,
    });

    // 훅은 모두 실행된 뒤에 렌더만 건너뛴다 — publish는 유지된다.
    if (hideView) return null;

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
