import Link from 'next/link';
import type { MarketNewsCardItem } from '@/entities/market-news';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsCardShell } from '@/widgets/news/ui/NewsCardShell';
import {
    SENTIMENT_LABEL,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from './utils/sentimentConstants';
import {
    IMPACT_LABEL,
    IMPACT_CLASS,
    isNewsImpact,
} from './utils/impactConstants';

function isPending(item: MarketNewsCardItem): boolean {
    return item.sentiment === null || item.priceImpact === null;
}

interface SentimentBadgeProps {
    value: string;
}

function SentimentBadge({ value }: SentimentBadgeProps) {
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            data-testid="sentiment-badge"
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {SENTIMENT_LABEL[value]}
        </span>
    );
}

interface ImpactBadgeProps {
    value: string;
}

function ImpactBadge({ value }: ImpactBadgeProps) {
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

interface TickerChipsProps {
    category: NewsFeedCategory;
    tickers: string[];
}

/**
 * Renders ticker chips for market-news cards.
 *
 * - `stock` category: each chip is an `<a>` linking to `/${ticker}` so
 *   users can navigate directly to the symbol page.
 * - All other categories: each chip is a plain `<span>` (display only —
 *   no per-symbol page exists for crypto sentinels like `BTCUSD`).
 * - Empty `tickers`: the container is NOT rendered (callers must guard on
 *   `tickers.length > 0`).
 */
function TickerChips({ category, tickers }: TickerChipsProps) {
    if (category === 'stock') {
        return (
            <div
                data-testid="ticker-chips"
                className="mt-1.5 flex flex-wrap gap-1.5"
            >
                {tickers.map(ticker => (
                    <Link
                        key={ticker}
                        href={`/${ticker}`}
                        aria-label={`${ticker} 종목 페이지로 이동`}
                        data-testid="ticker-chip"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        {ticker}
                    </Link>
                ))}
            </div>
        );
    }

    return (
        <div
            data-testid="ticker-chips"
            className="mt-1.5 flex flex-wrap gap-1.5"
        >
            {tickers.map(ticker => (
                <span
                    key={ticker}
                    data-testid="ticker-chip"
                    className="bg-secondary-700 text-secondary-300 rounded px-1.5 py-0.5 text-xs font-medium"
                >
                    {ticker}
                </span>
            ))}
        </div>
    );
}

export interface MarketNewsCardProps {
    category: NewsFeedCategory;
    item: MarketNewsCardItem;
}

/**
 * Renders a single market-news card with optional AI analysis badges,
 * ticker chips (stock: deep-link; others: display-only), and a source link.
 *
 * `priceImpact === 'high'` adds a left amber accent border matching the
 * per-symbol NewsCard treatment. Pending (no `sentiment`) cards show
 * skeleton placeholders while the background LLM pass completes.
 */
export function MarketNewsCard({ category, item }: MarketNewsCardProps) {
    const pending = isPending(item);
    const isHighImpact = !pending && item.priceImpact === 'high';
    const publishedDate = formatNewsPublishedAt(item.publishedAt);

    return (
        <NewsCardShell
            title={item.titleKo ?? item.titleEn}
            isHighImpact={isHighImpact}
            pending={pending}
            url={item.url}
            // MarketNewsCard의 AnalysisSkeleton: aria-hidden=true, text-secondary-400 텍스트
            analysisSkeleton={
                <div
                    aria-hidden="true"
                    className="mt-1.5 flex flex-wrap items-center gap-2"
                >
                    <div className="bg-secondary-700 h-5 w-10 animate-pulse rounded motion-reduce:animate-none" />
                    <div className="bg-secondary-700 h-5 w-20 animate-pulse rounded motion-reduce:animate-none" />
                    <span className="text-secondary-400 text-xs">
                        AI 분석 중…
                    </span>
                </div>
            }
            // MarketNewsCard의 SummarySkeletonLine: aria-hidden=true
            summarySkeletonLine={
                <div aria-hidden="true" className="mt-2 space-y-1.5">
                    <div className="bg-secondary-700/70 h-3.5 w-full animate-pulse rounded motion-reduce:animate-none" />
                    <div className="bg-secondary-700/70 h-3.5 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
                </div>
            }
            // MarketNewsCard 배지 행: min-w-0 포함, text-secondary-300 카테고리, translate="no" source
            badgeRow={
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                    <SentimentBadge value={item.sentiment!} />
                    <ImpactBadge value={item.priceImpact!} />
                    {item.category !== null && (
                        <span className="bg-secondary-700 text-secondary-300 rounded px-2 py-0.5 text-xs">
                            {item.category}
                        </span>
                    )}
                    <time
                        dateTime={item.publishedAt}
                        className="text-secondary-400 text-xs"
                    >
                        {publishedDate}
                    </time>
                    <span translate="no" className="text-secondary-400 text-xs">
                        {item.source}
                    </span>
                </div>
            }
            // 티커 칩 슬롯: tickers가 있을 때만 렌더한다.
            tickerChipSlot={
                item.tickers.length > 0 ? (
                    <TickerChips category={category} tickers={item.tickers} />
                ) : undefined
            }
            // 본문/요약 섹션: section 엘리먼트를 직접 인라인으로 사용한다.
            bodySection={
                <>
                    {item.bodyKo !== null && (
                        <section className="border-secondary-700/70 mt-3 border-t pt-3">
                            <h4 className="text-secondary-300 mb-1 text-xs font-semibold">
                                본문
                            </h4>
                            <p className="text-secondary-400 text-sm leading-relaxed wrap-break-word">
                                {item.bodyKo}
                            </p>
                        </section>
                    )}
                    {item.summaryKo !== null && (
                        <section className="border-secondary-700/70 mt-3 border-t pt-3">
                            <h4 className="text-secondary-300 mb-1 text-xs font-semibold">
                                요약
                            </h4>
                            <p className="text-secondary-400 text-sm leading-relaxed wrap-break-word">
                                {item.summaryKo}
                            </p>
                        </section>
                    )}
                </>
            }
            // MarketNewsCard 링크: aria-hidden span으로 감싼 화살표
            linkChildren={
                <>
                    원문 보기 <span aria-hidden="true">→</span>
                </>
            }
        />
    );
}
