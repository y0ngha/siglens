'use client';

import { useTranslations } from 'next-intl';
import type {
    FinancialsAnalysisResponse,
    FinancialsSentiment,
} from '@y0ngha/siglens-core';
import { useRegisterShareable, mapAnalysisStatus } from '@/features/share';
import { cn } from '@/shared/lib/cn';
import { AXIS_LABEL_KEY } from './axisLabels';
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
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';

/** FinancialsSentiment → `shared.enumLabel.sentiment` 카탈로그 키. */
const SENTIMENT_LABEL_KEY: Record<FinancialsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
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
    const t = useTranslations('widgets.financials');
    // extract.mjs의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는
    // 패턴만 본다 — `SENTIMENT_LABEL_KEY[...]`/`AXIS_LABEL_KEY[...]`를 그대로
    // `tLabel(...)`에 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트
    // 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <section
            aria-labelledby="financials-ai-summary-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="financials-ai-summary-heading"
                    className={HEADING_SECTION}
                >
                    {t('FinancialsAiSummary.26f860')}
                </h2>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {tLabel(SENTIMENT_LABEL_KEY[result.overallSentiment])}
                </span>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                {result.overallConclusionKo}
            </p>

            {result.axisAssessments.length > 0 && (
                <ul
                    aria-label={t('FinancialsAiSummary.4f0caa')}
                    className="mb-5 space-y-3"
                >
                    {result.axisAssessments.map(a => (
                        <li
                            key={a.axis}
                            className="rounded-lg bg-secondary-800/40 p-3"
                        >
                            <div className="mb-1 flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    {tLabel(AXIS_LABEL_KEY[a.axis])}
                                </span>
                                <span
                                    className={cn(
                                        'rounded px-1.5 py-0.5 text-xs font-medium',
                                        SENTIMENT_CLASS[a.sentiment]
                                    )}
                                >
                                    {tLabel(SENTIMENT_LABEL_KEY[a.sentiment])}
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-secondary-400">
                                {a.rationaleKo}
                            </p>
                        </li>
                    ))}
                </ul>
            )}

            {result.riskFactorsKo.length > 0 && (
                <div>
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        {t('FinancialsAiSummary.af0480')}
                    </h3>
                    <ul className="space-y-1.5">
                        {result.riskFactorsKo.map((risk, i) => (
                            <li
                                key={`risk-${i}-${risk}`}
                                className="flex gap-2 text-sm text-secondary-400"
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
    const chatState = buildChatState(state);
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
