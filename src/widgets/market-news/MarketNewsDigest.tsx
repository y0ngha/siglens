'use client';

import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { useMarketNewsDigest } from './hooks/useMarketNewsDigest';

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

const VALID_SENTIMENTS = new Set<string>(['bullish', 'neutral', 'bearish']);

function isNewsSentiment(v: string): v is NewsSentiment {
    return VALID_SENTIMENTS.has(v);
}

/** Loading / generating status card. */
function DigestStatusCard() {
    return (
        <section
            aria-labelledby="market-news-digest-status-heading"
            aria-busy="true"
            className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <h2
                id="market-news-digest-status-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                시장 AI 다이제스트
            </h2>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="flex items-center gap-3"
            >
                <div
                    aria-hidden="true"
                    className="border-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                />
                <p className="text-secondary-400 text-sm">
                    AI 다이제스트 생성 중이에요…
                </p>
            </div>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="bg-secondary-700 h-4 w-[91%] animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-[67%] animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-[79%] animate-pulse rounded motion-reduce:animate-none" />
            </div>
        </section>
    );
}

interface DigestResultViewProps {
    result: NewsAnalysisResponse;
}

function DigestResultView({ result }: DigestResultViewProps) {
    return (
        <section
            aria-labelledby="market-news-digest-heading"
            className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2
                    id="market-news-digest-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    시장 AI 다이제스트
                </h2>
                {isNewsSentiment(result.overallSentiment) && (
                    <span
                        className={cn(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            SENTIMENT_CLASS[result.overallSentiment]
                        )}
                    >
                        {SENTIMENT_LABEL[result.overallSentiment]}
                    </span>
                )}
            </div>

            <p className="text-secondary-400 mb-4 text-sm leading-relaxed wrap-break-word">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold">핵심 흐름</h3>
                    <ul className="space-y-1.5" aria-label="핵심 흐름 목록">
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
                    <h3 className="mb-2 text-sm font-semibold">주목 일정</h3>
                    <ul className="space-y-1.5" aria-label="주목 일정 목록">
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

interface DigestErrorViewProps {
    error: Error;
    onRetry: () => void;
}

function DigestErrorView({ error, onRetry }: DigestErrorViewProps) {
    return (
        <section
            aria-labelledby="market-news-digest-error-heading"
            className="border-ui-danger/30 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6"
        >
            <h2
                id="market-news-digest-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                시장 AI 다이제스트
            </h2>
            <p role="alert" className="text-ui-danger text-sm wrap-break-word">
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

export interface MarketNewsDigestProps {
    category: NewsFeedCategory;
    /**
     * Whether the SSR snapshot already contains at least one AI-enriched card.
     * When `false`, the hook waits for background enrichment before submitting
     * the digest to avoid a `no_news` error being locked into the query cache.
     */
    hasEnrichedNews: boolean;
}

/**
 * Renders the category-level AI digest.
 *
 * Delegates to `useMarketNewsDigest` for the full lifecycle:
 * trigger ingestion → wait for ≥1 enriched card → submit digest → poll → display.
 *
 * The section is identified by `aria-labelledby="market-news-digest-heading"`
 * in both the result and error views; in the loading state it uses the
 * status-heading variant to give screen readers distinct context.
 */
export function MarketNewsDigest({
    category,
    hasEnrichedNews,
}: MarketNewsDigestProps) {
    const digest = useMarketNewsDigest(category, hasEnrichedNews);

    if (digest.status === 'error') {
        return <DigestErrorView error={digest.error} onRetry={digest.retry} />;
    }

    if (digest.status === 'loading') {
        return <DigestStatusCard />;
    }

    return <DigestResultView result={digest.result} />;
}
