'use client';

import type { NewsFeedCategoryId } from '@/entities/market-news';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { useMarketNewsDigest } from './hooks/useMarketNewsDigest';
import {
    SENTIMENT_LABEL,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from './utils/sentimentConstants';

/** Loading / generating status card. */
function DigestStatusCard() {
    return (
        <section
            aria-labelledby="market-news-digest-status-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
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
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent motion-reduce:animate-none"
                />
                <p className="text-sm text-secondary-400">
                    AI 다이제스트 생성 중이에요…
                </p>
            </div>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="h-4 w-[91%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[67%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[79%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
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
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
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

            <p className="mb-4 text-sm leading-relaxed wrap-break-word text-secondary-400">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold">핵심 흐름</h3>
                    <ul className="space-y-1.5" aria-label="핵심 흐름 목록">
                        {result.keyEventsKo.map(event => (
                            <li
                                key={event}
                                className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
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
                        {result.upcomingEventsKo.map(event => (
                            <li
                                key={event}
                                className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-ui-warning"
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
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-ui-danger/30 bg-secondary-800 p-6"
        >
            <h2
                id="market-news-digest-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                시장 AI 다이제스트
            </h2>
            <div
                role="alert"
                className="text-sm wrap-break-word text-ui-danger-text"
            >
                {error.message}
            </div>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}

export interface MarketNewsDigestProps {
    category: NewsFeedCategoryId;
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
