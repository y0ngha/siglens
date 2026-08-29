import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { NewsFeedCategoryId } from '@/entities/market-news';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { MarketNewsCardItem } from '@/entities/market-news';

import { cn } from '@/shared/lib/cn';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import {
    SENTIMENT_LABEL_KEY,
    SENTIMENT_CLASS,
    isNewsSentiment,
} from './utils/sentimentConstants';
import {
    IMPACT_LABEL_KEY,
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
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[value]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 파일이 속한 라우트의 클라이언트 번들에
    // 실린다(sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    if (!isNewsSentiment(value)) return null;
    return (
        <span
            data-testid="sentiment-badge"
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                SENTIMENT_CLASS[value]
            )}
        >
            {tLabel(SENTIMENT_LABEL_KEY[value])}
        </span>
    );
}

interface ImpactBadgeProps {
    value: string;
}

function ImpactBadge({ value }: ImpactBadgeProps) {
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

interface TickerChipsProps {
    category: NewsFeedCategoryId;
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
    const t = useTranslations('widgets.market-news');
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
                        aria-label={t('MarketNewsCard.goToSymbol', {
                            v0: ticker,
                        })}
                        // 뉴스 카드마다 티커 칩이 붙어 다수 렌더 —
                        // docs/architecture/CDN_CACHING.md §1
                        prefetch={false}
                        data-testid="ticker-chip"
                        className="inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
                    className="rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium text-secondary-300"
                >
                    {ticker}
                </span>
            ))}
        </div>
    );
}

/**
 * aria-hidden=true — 스크린리더는 로딩 중 애니메이션 마커를 읽지 않는다.
 * text-secondary-400 텍스트 컬러는 NewsList(text-secondary-500)와 의도적으로 다르다.
 */
function AnalysisSkeleton() {
    const t = useTranslations('widgets.market-news');
    return (
        <div
            aria-hidden="true"
            className="mt-1.5 flex flex-wrap items-center gap-2"
        >
            <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <span className="text-xs text-secondary-400">
                {t('MarketNewsCard.d12df8')}
            </span>
        </div>
    );
}

/** aria-hidden=true — 스크린리더는 본문 로딩 중 스켈레톤 줄을 읽지 않는다. */
function SummarySkeletonLine() {
    return (
        <div aria-hidden="true" className="mt-2 space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
        </div>
    );
}

export interface MarketNewsCardProps {
    category: NewsFeedCategoryId;
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
    const t = useTranslations('widgets.market-news');
    const locale = useResolvedLocale();
    const pending = isPending(item);
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
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                    {item.sentiment !== null && (
                        <SentimentBadge value={item.sentiment} />
                    )}
                    {item.priceImpact !== null && (
                        <ImpactBadge value={item.priceImpact} />
                    )}
                    {item.category !== null && (
                        <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-300">
                            {item.category}
                        </span>
                    )}
                    <time
                        dateTime={item.publishedAt}
                        className="text-xs text-secondary-400"
                    >
                        {publishedDate}
                    </time>
                    <span translate="no" className="text-xs text-secondary-400">
                        {item.source}
                    </span>
                </div>
            }
            tickerChipSlot={
                item.tickers.length > 0 ? (
                    <TickerChips category={category} tickers={item.tickers} />
                ) : undefined
            }
            bodySection={
                <>
                    {body !== null && (
                        <section className="mt-3 border-t border-secondary-700/70 pt-3">
                            <h4 className="mb-1 text-xs font-medium text-secondary-300">
                                {t('MarketNewsCard.c67b87')}
                            </h4>
                            <p className="text-sm leading-relaxed wrap-break-word text-secondary-400">
                                {body}
                            </p>
                        </section>
                    )}
                    {summary !== null && (
                        <section className="mt-3 border-t border-secondary-700/70 pt-3">
                            <h4 className="mb-1 text-xs font-medium text-secondary-300">
                                {t('MarketNewsCard.3ea27a')}
                            </h4>
                            <p className="text-sm leading-relaxed wrap-break-word text-secondary-400">
                                {summary}
                            </p>
                        </section>
                    )}
                </>
            }
            linkChildren={
                <>
                    {t('MarketNewsCard.adb2bb')}{' '}
                    <span aria-hidden="true">→</span>
                </>
            }
        />
    );
}
