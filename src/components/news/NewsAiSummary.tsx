'use client';

import { usePublishSymbolChat } from '@/components/chat/hooks/useSymbolChat';
import { useNewsAnalysis } from '@/components/news/hooks/useNewsAnalysis';
import { useWaitForNewsCards } from '@/components/news/hooks/useWaitForNewsCards';
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';
import { useDefaultModelId } from '@/components/symbol-page/hooks/useDefaultModelId';
import { cn } from '@/lib/cn';
import {
    type NewsAnalysisResponse,
    type NewsSentiment,
} from '@y0ngha/siglens-core';
import { useMemo } from 'react';
import { NEWS_ANALYSIS_PERIOD_LABEL } from '@/lib/news/periodLabels';

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

interface StatusCardProps {
    phase: 'fetching' | 'analyzing';
}

function StatusCard({ phase }: StatusCardProps) {
    const isFetching = phase === 'fetching';

    return (
        <section
            aria-labelledby="news-ai-summary-status-heading"
            aria-busy="true"
            className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <div className="mb-4 flex items-center gap-2">
                <h2
                    id="news-ai-summary-status-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 뉴스 종합 분석
                </h2>
                <span className="bg-secondary-700 text-secondary-400 rounded px-2 py-0.5 text-xs">
                    {NEWS_ANALYSIS_PERIOD_LABEL}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className={cn(
                        'h-4 w-4 animate-spin rounded-full border-2 motion-reduce:animate-none',
                        isFetching
                            ? 'border-primary-400'
                            : 'border-primary-500',
                        'border-t-transparent'
                    )}
                />
                <p
                    className="text-secondary-400 text-sm"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {isFetching
                        ? '뉴스 데이터를 수집하고 있어요…'
                        : 'AI 종합 분석 중이에요…'}
                </p>
            </div>
            <p className="text-secondary-500 mt-2 text-xs">
                {isFetching
                    ? '최신 뉴스를 가져온 후 AI 분석을 시작합니다.'
                    : '수집된 뉴스를 종합 분석하고 있습니다. 잠시만 기다려 주세요.'}
            </p>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="bg-secondary-700 h-4 w-[91%] animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-[67%] animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-[79%] animate-pulse rounded motion-reduce:animate-none" />
            </div>
        </section>
    );
}

interface NewsAiSummaryViewProps {
    result: NewsAnalysisResponse;
}

function NewsAiSummaryView({ result }: NewsAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-heading"
            className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <h2
                        id="news-ai-summary-heading"
                        className="text-lg font-semibold tracking-tight"
                    >
                        AI 뉴스 종합 분석
                    </h2>
                    <span className="bg-secondary-700 text-secondary-400 shrink-0 rounded px-2 py-0.5 text-xs">
                        {NEWS_ANALYSIS_PERIOD_LABEL}
                    </span>
                </div>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {SENTIMENT_LABEL[result.overallSentiment]}
                </span>
            </div>

            <p className="text-secondary-400 mb-4 text-sm leading-relaxed wrap-break-word">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold">핵심 이벤트</h3>
                    <ul className="space-y-1.5" aria-label="핵심 이벤트 목록">
                        {result.keyEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="text-secondary-400 flex min-w-0 gap-2 text-sm wrap-break-word"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                <span className="min-w-0 wrap-break-word">
                                    {event}
                                </span>
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
                    <ul
                        className="space-y-1.5"
                        aria-label="향후 주의 이벤트 목록"
                    >
                        {result.upcomingEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="text-secondary-400 flex min-w-0 gap-2 text-sm wrap-break-word"
                            >
                                <span
                                    aria-hidden="true"
                                    className="text-ui-warning mt-0.5 shrink-0"
                                >
                                    ⚠
                                </span>
                                <span className="min-w-0 wrap-break-word">
                                    {event}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

interface NewsAiSummaryInlineErrorProps {
    error: Error;
    onRetry: () => void;
}

function NewsAiSummaryInlineError({
    error,
    onRetry,
}: NewsAiSummaryInlineErrorProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-error-heading"
            className="border-ui-danger/30 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6"
        >
            <div className="mb-2 flex items-center gap-2">
                <h2
                    id="news-ai-summary-error-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 뉴스 종합 분석
                </h2>
                <span className="bg-secondary-700 text-secondary-400 rounded px-2 py-0.5 text-xs">
                    {NEWS_ANALYSIS_PERIOD_LABEL}
                </span>
            </div>
            <p className="text-ui-danger text-sm wrap-break-word" role="alert">
                {error.message}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 rounded px-3 py-1.5 text-xs text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}

interface NewsAiSummaryContentProps {
    symbol: string;
    companyName: string;
}

function NewsAiSummaryContent({
    symbol,
    companyName,
}: NewsAiSummaryContentProps) {
    const modelId = useDefaultModelId();
    const analysis = useNewsAnalysis(symbol, companyName, modelId);

    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    //
    // `analysis`는 discriminated union이라 `analysis.result`는 narrowing 후에만
    // 접근 가능하므로 deps에는 객체 전체를 둔다. React Query가 `query.data`를
    // memoize하므로 동일 분석에 대한 reference는 안정적 — 실제 데이터가 바뀔
    // 때만 재계산된다.
    const chatState = useMemo(() => {
        const result = analysis.status === 'done' ? analysis.result : null;
        return result !== null
            ? ({
                  context: {
                      kind: 'news',
                      payload: result,
                  } as const,
                  timeframe: null,
                  isAnalysisReady: true,
              } as const)
            : ({
                  context: null,
                  timeframe: null,
                  isAnalysisReady: false,
              } as const);
    }, [analysis]);
    usePublishSymbolChat(chatState);

    if (analysis.status === 'error') {
        return (
            <NewsAiSummaryInlineError
                error={analysis.error}
                onRetry={analysis.retry}
            />
        );
    }

    if (analysis.status === 'bot_blocked') {
        return <BotBlockedNotice />;
    }

    if (analysis.status === 'loading') {
        return <StatusCard phase="analyzing" />;
    }

    return <NewsAiSummaryView result={analysis.result} />;
}

interface NewsAiSummaryProps {
    symbol: string;
    companyName: string;
    /**
     * Whether the SSR snapshot already contained at least one AI-enriched
     * news card. When `false`, the component waits for background enrichment
     * to produce the first enriched card before triggering aggregate analysis.
     */
    hasEnrichedNews: boolean;
}

export function NewsAiSummary({
    symbol,
    companyName,
    hasEnrichedNews,
}: NewsAiSummaryProps) {
    const { isReady: isCardsReady, pollError } = useWaitForNewsCards(
        symbol,
        hasEnrichedNews
    );

    // Surface persistent polling errors to the surrounding error boundary
    // (NewsAiSummaryErrorBoundary) so the fallback UI takes over.
    if (pollError !== null) {
        throw pollError;
    }

    if (!isCardsReady) {
        return <StatusCard phase="fetching" />;
    }

    return <NewsAiSummaryContent symbol={symbol} companyName={companyName} />;
}
