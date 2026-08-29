'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useNewsPollingWithInvalidation } from '../hooks/useNewsPollingWithInvalidation';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { NEWS_LIST_PERIOD_KEY } from '@/shared/lib/news/periodLabels';
import type { NewsImpact, NewsSentiment } from '@y0ngha/siglens-core';
import { useState } from 'react';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SENTIMENT_LABEL_KEY } from '@/shared/lib/sentimentDisplay';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
    neutral: 'bg-secondary-700 text-secondary-400',
};

// "가격 영향" is asset-neutral: works for both equity ("주가") and crypto ("코인 가격").
// NewsList is rendered on both equity and crypto news pages, so "주가" (stock-price)
// would be a misleading label on crypto pages. "가격" covers both without prop threading.
/**
 * 라벨 **키**만 담는다 — `t()`는 소비 컴포넌트에서 부른다.
 *
 * 예전에는 이 테이블이 두 벌 있었고(`market-news`는 `주가 영향`,
 * `news`는 `가격 영향`), 둘 다 한국어 리터럴이라 네 로케일 전부 한국어였다.
 * 문구는 자산 중립 쪽(`가격`)으로 통일한다 — 크립토 페이지에서 `주가`는
 * 틀린 말이다.
 */
const IMPACT_LABEL_KEY: Record<NewsImpact, string> = {
    high: 'newsImpact.high',
    medium: 'newsImpact.medium',
    low: 'newsImpact.low',
    negligible: 'newsImpact.negligible',
};

const IMPACT_CLASS: Record<NewsImpact, string> = {
    high: 'bg-ui-warning/10 text-ui-warning-text',
    medium: 'bg-primary-500/10 text-primary-400',
    low: 'bg-secondary-700 text-secondary-400',
    negligible: 'bg-secondary-700/50 text-secondary-400',
};

const VALID_SENTIMENTS = new Set<string>(['bullish', 'bearish', 'neutral']);
const VALID_IMPACTS = new Set<string>(['high', 'medium', 'low', 'negligible']);
const NEWS_LIST_SKELETON_COUNT = 3;

function isNewsSentiment(value: string): value is NewsSentiment {
    return VALID_SENTIMENTS.has(value);
}

function isNewsImpact(value: string): value is NewsImpact {
    return VALID_IMPACTS.has(value);
}

function isPendingAnalysis(item: NewsDisplayItem): boolean {
    return item.sentiment === null || item.priceImpact === null;
}

function SentimentBadge({ value }: { value: string }) {
    // extract.mjs의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는
    // 패턴만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {tLabel(SENTIMENT_LABEL_KEY[value])}
        </span>
    );
}

function ImpactBadge({ value }: { value: string }) {
    const tLabel = useTranslations('shared.enumLabel');
    // `SENTIMENT_LABEL_KEY`와 같은 이유로 키를 그대로 `tLabel`에 넣는다 —
    // 추출기가 이 파일에서 `shared.enumLabel`을 보게 해야 페이로드에 실린다.
    if (!isNewsImpact(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                IMPACT_CLASS[value]
            )}
        >
            {tLabel(IMPACT_LABEL_KEY[value])}
        </span>
    );
}

interface NewsTextSectionProps {
    label: string;
    text: string;
}

function NewsTextSection({ label, text }: NewsTextSectionProps) {
    return (
        <section className="mt-3 border-t border-secondary-700/70 pt-3">
            <h4 className="mb-1 text-xs font-medium text-secondary-300">
                {label}
            </h4>
            <p className="text-sm leading-relaxed wrap-break-word text-secondary-400">
                {text}
            </p>
        </section>
    );
}

function NewsCardSkeleton() {
    return (
        <article
            aria-hidden="true"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-4"
        >
            <div className="h-5 w-4/5 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-5 w-24 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            <div className="mt-3 space-y-1.5">
                <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            </div>
        </article>
    );
}

function NewsListLoadingState() {
    const t = useTranslations('widgets.news');
    const tPeriod = useTranslations('shared.lib.newsPeriod');
    return (
        <section
            aria-labelledby="news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <h2 id="news-list-heading" className={HEADING_SECTION}>
                        {t('NewsList.ac2367')}
                    </h2>
                    <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                        {tPeriod(NEWS_LIST_PERIOD_KEY)}
                    </span>
                </div>
                <span className="text-xs text-secondary-400" aria-live="polite">
                    {t('NewsList.b514aa')}
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
    const t = useTranslations('widgets.news');
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden rounded-lg border border-primary-500/30 bg-primary-500/5 p-4"
        >
            <div
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary-400 border-t-transparent motion-reduce:animate-none"
            />
            <div className="min-w-0">
                <p className="text-sm font-medium text-secondary-100">
                    {t('NewsList.17ecc6')}
                </p>
                <p className="mt-1 text-xs leading-relaxed wrap-break-word text-secondary-400">
                    {t('NewsList.a61f43')}
                </p>
            </div>
        </div>
    );
}

/**
 * aria-hidden 없음 — NewsList는 스크린리더가 로딩 상태를 읽도록 허용한다.
 * text-secondary-500 텍스트 컬러는 MarketNewsCard(text-secondary-400)와 의도적으로 다르다.
 */
function AnalysisSkeleton() {
    const t = useTranslations('widgets.news');
    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <span className="text-xs text-secondary-500">
                {t('NewsList.d12df8')}
            </span>
        </div>
    );
}

/** aria-hidden 없음 — NewsList는 스크린리더가 본문 로딩 중 스켈레톤을 읽도록 허용한다. */
function SummarySkeletonLine() {
    return (
        <div className="mt-2 space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
        </div>
    );
}

function NewsCard({ item }: { item: NewsDisplayItem }) {
    const t = useTranslations('widgets.news');
    const locale = useCurrentLocale();
    const pending = isPendingAnalysis(item);
    const isHighImpact = !pending && item.priceImpact === 'high';

    const publishedDate = formatNewsPublishedAt(item.publishedAt, locale);
    // 제목만 로케일을 타면 번역된 헤드라인 아래 한국어 본문이 붙는다.
    const body = resolveNewsBody(item);
    const summary = resolveNewsSummary(item);

    return (
        <NewsCardShell
            title={resolveNewsTitle(item, locale)}
            isHighImpact={isHighImpact}
            pending={pending}
            url={item.url}
            analysisSkeleton={<AnalysisSkeleton />}
            summarySkeletonLine={<SummarySkeletonLine />}
            badgeRow={
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.sentiment !== null && (
                        <SentimentBadge value={item.sentiment} />
                    )}
                    {item.priceImpact !== null && (
                        <ImpactBadge value={item.priceImpact} />
                    )}
                    {item.category !== null && (
                        <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                            {item.category}
                        </span>
                    )}
                    <time
                        dateTime={item.publishedAt}
                        className="text-xs text-secondary-400"
                    >
                        {publishedDate}
                    </time>
                    <span className="text-xs text-secondary-400">
                        {item.source}
                    </span>
                </div>
            }
            bodySection={
                <>
                    {body !== null && (
                        <NewsTextSection
                            label={t('NewsList.c67b87')}
                            text={body}
                        />
                    )}
                    {summary !== null && (
                        <NewsTextSection
                            label={t('NewsList.3ea27a')}
                            text={summary}
                        />
                    )}
                </>
            }
            linkChildren={t('NewsList.850458')}
        />
    );
}

interface NewsListProps {
    items: NewsDisplayItem[];
    symbol: string;
}

export function NewsList({ items: initialItems, symbol }: NewsListProps) {
    const tPeriod = useTranslations('shared.lib.newsPeriod');
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(NEWS_LIST_PAGE_SIZE);
    // Tracks the last rendered symbol for the render-time reset below.
    // Client-side navigation keeps the component mounted while delivering new
    // initialItems for the new symbol, so we must re-baseline explicitly.
    const [prevSymbol, setPrevSymbol] = useState(symbol);

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setVisibleCount(NEWS_LIST_PAGE_SIZE);
    }

    const { items, isPolling, pollError } = useNewsPollingWithInvalidation(
        symbol,
        initialItems
    );

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
                className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            >
                <div className="mb-3 flex items-center gap-2">
                    <h2 id="news-list-heading" className={HEADING_SECTION}>
                        {t('NewsList.ac2367')}
                    </h2>
                    <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                        {tPeriod(NEWS_LIST_PERIOD_KEY)}
                    </span>
                </div>
                <p className="text-sm text-secondary-400">
                    {t('NewsList.b75118', {
                        v0: tPeriod(NEWS_LIST_PERIOD_KEY),
                    })}
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
            <div className="flex items-center gap-2">
                <h2 id="news-list-heading" className={HEADING_SECTION}>
                    {t('NewsList.ac2367')}
                </h2>
                <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                    {tPeriod(NEWS_LIST_PERIOD_KEY)}
                </span>
            </div>
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
                    onClick={() =>
                        setVisibleCount(c => c + NEWS_LIST_PAGE_SIZE)
                    }
                    className="w-full rounded-lg border border-border-control py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('NewsList.8e5a3a', { v0: items.length - visibleCount })}
                </button>
            )}
        </section>
    );
}
