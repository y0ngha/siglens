'use client';

import { useState } from 'react';
import type { NewsImpact, NewsSentiment } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import type { NewsDisplayItem } from '@/domain/types';
import { useNewsCardPolling } from '@/components/news/hooks/useNewsCardPolling';

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    bearish: '부정',
    neutral: '중립',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
    neutral: 'bg-secondary-700 text-secondary-400',
};

const IMPACT_LABEL: Record<NewsImpact, string> = {
    high: '주가영향 높음',
    medium: '주가영향 보통',
    low: '주가영향 낮음',
    negligible: '주가영향 미미',
};

const IMPACT_CLASS: Record<NewsImpact, string> = {
    high: 'bg-ui-warning/10 text-ui-warning',
    medium: 'bg-primary-500/10 text-primary-400',
    low: 'bg-secondary-700 text-secondary-400',
    negligible: 'bg-secondary-700/50 text-secondary-400',
};

const VALID_SENTIMENTS = new Set<string>(['bullish', 'bearish', 'neutral']);
const VALID_IMPACTS = new Set<string>(['high', 'medium', 'low', 'negligible']);
const PAGE_SIZE = 5;
const NEWS_LIST_SKELETON_COUNT = 3;
const NEWS_PUBLISHED_AT_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
});

function isNewsSentiment(value: string): value is NewsSentiment {
    return VALID_SENTIMENTS.has(value);
}

function isNewsImpact(value: string): value is NewsImpact {
    return VALID_IMPACTS.has(value);
}

function isPendingAnalysis(item: NewsDisplayItem): boolean {
    return item.sentiment === null || item.priceImpact === null;
}

export function formatNewsPublishedAt(publishedAt: string): string {
    return `${NEWS_PUBLISHED_AT_FORMATTER.format(new Date(publishedAt))} KST`;
}

function SentimentBadge({ value }: { value: string }) {
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {SENTIMENT_LABEL[value]}
        </span>
    );
}

function ImpactBadge({ value }: { value: string }) {
    if (!isNewsImpact(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                IMPACT_CLASS[value]
            )}
        >
            {IMPACT_LABEL[value]}
        </span>
    );
}

function AnalysisSkeleton() {
    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="bg-secondary-700 h-5 w-10 animate-pulse rounded motion-reduce:animate-none" />
            <div className="bg-secondary-700 h-5 w-20 animate-pulse rounded motion-reduce:animate-none" />
            <span className="text-secondary-500 text-xs">AI 분석 중…</span>
        </div>
    );
}

function SummarySkeletonLine() {
    return (
        <div className="mt-2 space-y-1.5">
            <div className="bg-secondary-700/70 h-3.5 w-full animate-pulse rounded motion-reduce:animate-none" />
            <div className="bg-secondary-700/70 h-3.5 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
        </div>
    );
}

interface NewsTextSectionProps {
    label: string;
    text: string;
}

function NewsTextSection({ label, text }: NewsTextSectionProps) {
    return (
        <section className="border-secondary-700/70 mt-3 border-t pt-3">
            <h4 className="text-secondary-300 mb-1 text-xs font-semibold">
                {label}
            </h4>
            <p className="text-secondary-400 text-sm leading-relaxed break-words">
                {text}
            </p>
        </section>
    );
}

function NewsCardSkeleton() {
    return (
        <article
            aria-hidden="true"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-4"
        >
            <div className="bg-secondary-700 h-5 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="bg-secondary-700 h-5 w-10 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-5 w-24 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-20 animate-pulse rounded motion-reduce:animate-none" />
            </div>
            <div className="mt-3 space-y-1.5">
                <div className="bg-secondary-700/70 h-3.5 w-full animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700/70 h-3.5 w-2/3 animate-pulse rounded motion-reduce:animate-none" />
            </div>
        </article>
    );
}

function NewsListLoadingState() {
    return (
        <section
            aria-labelledby="news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <div className="flex items-center justify-between gap-3">
                <h2
                    id="news-list-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    최근 뉴스
                </h2>
                <span className="text-secondary-400 text-xs" aria-live="polite">
                    뉴스 수집 중…
                </span>
            </div>
            <ul className="space-y-3">
                {Array.from({ length: NEWS_LIST_SKELETON_COUNT }).map(
                    (_, i) => (
                        <li key={i}>
                            <NewsCardSkeleton />
                        </li>
                    )
                )}
            </ul>
        </section>
    );
}

function NewsRefreshStatusCard() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="border-primary-500/30 bg-primary-500/5 flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden rounded-xl border p-4"
        >
            <div
                aria-hidden="true"
                className="border-primary-400 mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
            />
            <div className="min-w-0">
                <p className="text-secondary-100 text-sm font-medium">
                    최신 뉴스 확인 중…
                </p>
                <p className="text-secondary-400 mt-1 text-xs leading-relaxed break-words">
                    기존 뉴스는 먼저 보여드리고, 새로 들어온 기사가 있으면
                    자동으로 추가합니다.
                </p>
            </div>
        </div>
    );
}

function NewsCard({ item }: { item: NewsDisplayItem }) {
    const pending = isPendingAnalysis(item);
    const isHighImpact = !pending && item.priceImpact === 'high';

    const publishedDate = formatNewsPublishedAt(item.publishedAt);

    return (
        <article
            className={cn(
                'border-secondary-700 bg-secondary-800 hover:border-primary-500/50 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-4 transition-[colors,transform] hover:-translate-y-px',
                // Bump left padding so content doesn't sit flush against the 3px accent strip.
                isHighImpact && 'border-l-ui-warning border-l-[3px] pl-5'
            )}
        >
            <h3
                className={cn(
                    'leading-snug font-semibold text-balance break-words',
                    pending && 'opacity-80'
                )}
            >
                {item.titleKo ?? item.titleEn}
            </h3>

            {pending ? (
                <AnalysisSkeleton />
            ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.sentiment !== null && (
                        <SentimentBadge value={item.sentiment} />
                    )}
                    {item.priceImpact !== null && (
                        <ImpactBadge value={item.priceImpact} />
                    )}
                    {item.category !== null && (
                        <span className="bg-secondary-700 text-secondary-400 rounded px-2 py-0.5 text-xs">
                            {item.category}
                        </span>
                    )}
                    <time
                        dateTime={item.publishedAt}
                        className="text-secondary-400 text-xs"
                    >
                        {publishedDate}
                    </time>
                    <span className="text-secondary-400 text-xs">
                        {item.source}
                    </span>
                </div>
            )}

            {pending ? (
                <SummarySkeletonLine />
            ) : (
                <>
                    {item.bodyKo !== null && (
                        <NewsTextSection label="본문" text={item.bodyKo} />
                    )}
                    {item.summaryKo !== null && (
                        <NewsTextSection label="요약" text={item.summaryKo} />
                    )}
                </>
            )}

            {!pending && (
                <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 focus-visible:ring-primary-500 mt-2 inline-block text-xs transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
                >
                    원문 보기 →
                </a>
            )}
        </article>
    );
}

interface NewsListProps {
    items: NewsDisplayItem[];
    symbol: string;
}

export function NewsList({ items: initialItems, symbol }: NewsListProps) {
    const { items, isPolling, pollError } = useNewsCardPolling(
        symbol,
        initialItems
    );
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Surface persistent polling errors to the nearest error boundary so a
    // dedicated fallback UI can render instead of an indefinitely empty list.
    if (pollError !== null) {
        throw pollError;
    }

    if (items.length === 0) {
        if (isPolling) {
            return <NewsListLoadingState />;
        }

        return (
            <section
                aria-labelledby="news-list-heading"
                className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6"
            >
                <h2
                    id="news-list-heading"
                    className="mb-3 text-lg font-semibold tracking-tight"
                >
                    최근 뉴스
                </h2>
                <p className="text-secondary-400 text-sm">
                    최근 7일간 뉴스가 없습니다.
                </p>
            </section>
        );
    }

    const visible = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    return (
        <section
            aria-labelledby="news-list-heading"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <h2
                id="news-list-heading"
                className="text-lg font-semibold tracking-tight"
            >
                최근 뉴스
            </h2>
            {isPolling ? <NewsRefreshStatusCard /> : null}
            <ul className="space-y-3">
                {visible.map(item => (
                    <li key={item.id}>
                        <NewsCard item={item} />
                    </li>
                ))}
            </ul>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="border-secondary-700 text-secondary-400 hover:text-secondary-100 focus-visible:ring-primary-500 w-full rounded-lg border py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    더보기 ({items.length - visibleCount}개 남음)
                </button>
            )}
        </section>
    );
}
