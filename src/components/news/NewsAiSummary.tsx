'use client';

import { type CSSProperties, useMemo } from 'react';
import {
    getAllowedModels,
    type NewsAnalysisResponse,
    type NewsSentiment,
} from '@y0ngha/siglens-core';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import { resolveDefaultModelForProvider } from '@/domain/llm/providerDefaults';
import { cn } from '@/lib/cn';
import { useNewsAnalysis } from './hooks/useNewsAnalysis';

const DEFAULT_TIER = 'free' as const;

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-ui-warning/10 text-ui-warning',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

// ─── Result view ──────────────────────────────────────────────────────────────

interface NewsAiSummaryViewProps {
    result: NewsAnalysisResponse;
}

function NewsAiSummaryView({ result }: NewsAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-heading"
            className="rounded-xl border border-border bg-card p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="news-ai-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 뉴스 종합 분석
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

            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold">핵심 이벤트</h3>
                    <ul className="space-y-1.5" aria-label="핵심 이벤트 목록">
                        {result.keyEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="flex gap-2 text-sm text-muted-foreground"
                            >
                                <span aria-hidden="true" className="mt-0.5 shrink-0">
                                    •
                                </span>
                                {event}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.upcomingEventsKo.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">
                        향후 주의 이벤트
                    </h3>
                    <ul className="space-y-1.5" aria-label="향후 주의 이벤트 목록">
                        {result.upcomingEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="flex gap-2 text-sm text-muted-foreground"
                            >
                                <span aria-hidden="true" className="mt-0.5 shrink-0">
                                    •
                                </span>
                                {event}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NewsAiSummaryProps {
    symbol: string;
}

/**
 * Client component: triggers news AI analysis on mount, polls for
 * completion, and renders the result.
 *
 * Uses `useSelectedProvider` to pick the model.
 * All polling/state logic is delegated to `useNewsAnalysis`.
 */
export function NewsAiSummary({ symbol }: NewsAiSummaryProps) {
    const [selectedProvider] = useSelectedProvider();
    const allowedModels = useMemo(() => getAllowedModels(DEFAULT_TIER), []);
    const modelId = useMemo(
        () =>
            resolveDefaultModelForProvider(selectedProvider, allowedModels) ??
            'claude-haiku-3-5',
        [selectedProvider, allowedModels]
    );

    const state = useNewsAnalysis(symbol, modelId);

    if (state.status === 'done') {
        return <NewsAiSummaryView result={state.result} />;
    }

    if (state.status === 'error') {
        return (
            <section
                aria-labelledby="news-ai-summary-error-heading"
                className="rounded-xl border border-destructive/30 bg-card p-6"
            >
                <h2
                    id="news-ai-summary-error-heading"
                    className="mb-2 text-lg font-semibold tracking-tight"
                >
                    AI 뉴스 종합 분석
                </h2>
                <p className="text-sm text-destructive" role="alert">
                    {state.error ?? '분석 중 오류가 발생했습니다.'}
                </p>
            </section>
        );
    }

    const loadingLabel =
        state.status === 'submitting'
            ? 'AI 분석 요청 중…'
            : 'AI 뉴스 분석 진행 중…';

    return (
        <section
            aria-labelledby="news-ai-summary-loading-heading"
            aria-busy="true"
            className="rounded-xl border border-border bg-card p-6"
        >
            <h2
                id="news-ai-summary-loading-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                AI 뉴스 종합 분석
            </h2>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
                />
                <p
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {loadingLabel}
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="h-4 w-[var(--skeleton-w)] animate-pulse rounded bg-muted"
                        style={
                            {
                                '--skeleton-w': `${85 - i * 12}%`,
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    />
                ))}
            </div>
        </section>
    );
}
