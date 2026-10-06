'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useNewsPollingWithInvalidation } from '../hooks/useNewsPollingWithInvalidation';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { NEWS_LIST_PERIOD_KEY } from '@/shared/lib/news/periodLabels';
import { useState } from 'react';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';
import { NewsCategoryBadge } from '@/shared/ui/NewsCategoryBadge';
import { Spinner } from '@/shared/ui/Spinner';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
// 배지 색·라벨 키·가드는 `MarketNewsCard`와 같은 공유 테이블을 쓴다 — 예전에는
// 여기 로컬 사본이 있었고 neutral/low/negligible이 `text-secondary-400`으로
// 남아 AA 대비 보정(`-300`)이 빠져 있었다.
import {
    SENTIMENT_CLASS,
    SENTIMENT_LABEL_KEY,
    isNewsSentiment,
} from '@/shared/lib/sentimentDisplay';
import {
    IMPACT_CLASS,
    IMPACT_LABEL_KEY,
    isNewsImpact,
} from '@/shared/lib/news/impactDisplay';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

const NEWS_LIST_SKELETON_COUNT = 3;

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

/** 본문 자리 줄 폭 — 마지막 줄이 짧아 실제 문단처럼 보인다. */
const NEWS_BODY_SKELETON_LINE_WIDTHS = ['w-full', 'w-full', 'w-3/5'] as const;

/**
 * 분석이 끝나면 들어오는 본문 섹션(`NewsTextSection` — 구분선 + 라벨 + `text-sm
 * leading-relaxed` 문단)과 **같은 골격**의 자리 표시. 예전 두 줄짜리 막대는 본문이 도착하는
 * 순간 카드가 섹션 하나만큼 자라 아래 카드들을 밀었다.
 *
 * 문단 세 줄은 **추정치**다 — 실제 본문 줄 수는 기사·화면 폭마다 다르다.
 *
 * 텍스트가 없는 순수 장식이라 여기서는 `aria-hidden`을 걸지 않는다. 로딩 안내는 카드의
 * 분석 스켈레톤 문구가 맡고, `NewsCardSkeleton`은 자기 `<article aria-hidden>` 안에서 이
 * 골격을 재사용한다(그쪽의 장식 의미는 그대로다).
 */
function NewsBodySkeleton() {
    return (
        <div className="mt-3 border-t border-secondary-700/70 pt-3">
            {/* 라벨(h4, text-xs = 16px 줄) */}
            <div className="mb-1 flex h-4 items-center">
                <div className="h-3 w-12 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            {/* 문단(text-sm leading-relaxed ≈ 22.75px 줄) */}
            {NEWS_BODY_SKELETON_LINE_WIDTHS.map((width, i) => (
                <div key={i} className="flex h-5.5 items-center">
                    <div
                        className={cn(
                            'h-3.5 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none',
                            width
                        )}
                    />
                </div>
            ))}
        </div>
    );
}

function NewsCardSkeleton() {
    return (
        <article aria-hidden="true" className={cn(SURFACE_CARD, 'p-4')}>
            <div className="h-5 w-4/5 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-5 w-24 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            <NewsBodySkeleton />
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
            <Spinner className="mt-0.5 shrink-0" />
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
            fallbackTitle={item.source}
            isHighImpact={isHighImpact}
            pending={pending}
            url={item.url}
            analysisSkeleton={<AnalysisSkeleton />}
            summarySkeletonLine={<NewsBodySkeleton />}
            badgeRow={
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.sentiment !== null && (
                        <SentimentBadge value={item.sentiment} />
                    )}
                    {item.priceImpact !== null && (
                        <ImpactBadge value={item.priceImpact} />
                    )}
                    <NewsCategoryBadge
                        value={item.category}
                        className="text-secondary-400"
                    />
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
                className={cn(
                    SURFACE_CARD,
                    'w-full max-w-full min-w-0 overflow-hidden p-6'
                )}
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
