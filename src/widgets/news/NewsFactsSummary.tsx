import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { Locale } from '@/shared/i18n/locales';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';

export interface NewsFactsSummaryProps {
    displayName: string;
    assetClass: AssetClass;
    items: readonly NewsDisplayItem[];
}

interface SentimentCounts {
    bullish: number;
    neutral: number;
    bearish: number;
}

interface HeadlineItem {
    id: string;
    title: string;
}

const MAX_HEADLINES = 5;

function getLatestPublishedAt(
    items: readonly NewsDisplayItem[]
): string | null {
    let latestMs = Number.NEGATIVE_INFINITY;
    let latestPublishedAt: string | null = null;

    for (const item of items) {
        const publishedMs = Date.parse(item.publishedAt);
        if (!Number.isFinite(publishedMs) || publishedMs <= latestMs) continue;
        latestMs = publishedMs;
        latestPublishedAt = item.publishedAt;
    }

    return latestPublishedAt;
}

function getSentimentCounts(
    items: readonly NewsDisplayItem[]
): SentimentCounts {
    return items.reduce<SentimentCounts>(
        (counts, item) => {
            if (item.sentiment === 'bullish') {
                return { ...counts, bullish: counts.bullish + 1 };
            }
            if (item.sentiment === 'neutral') {
                return { ...counts, neutral: counts.neutral + 1 };
            }
            if (item.sentiment === 'bearish') {
                return { ...counts, bearish: counts.bearish + 1 };
            }
            return counts;
        },
        { bullish: 0, neutral: 0, bearish: 0 }
    );
}

function getHeadlineItems(
    items: readonly NewsDisplayItem[],
    locale: Locale
): HeadlineItem[] {
    return items
        .flatMap(item => {
            const title = resolveNewsTitle(item, locale);
            return title.length > 0 ? [{ id: item.id, title }] : [];
        })
        .slice(0, MAX_HEADLINES);
}

export function NewsFactsSummary({
    displayName,
    assetClass,
    items,
}: NewsFactsSummaryProps) {
    const t = useTranslations('widgets.news');
    const locale = useResolvedLocale();
    const latestPublishedAt = getLatestPublishedAt(items);
    const analyzedCount = items.filter(item => item.sentiment !== null).length;
    const sentimentCounts = getSentimentCounts(items);
    const headlines = getHeadlineItems(items, locale);
    const isCrypto = assetClass === 'crypto';

    return (
        <section
            aria-labelledby="news-facts-summary-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-5"
        >
            <h2 id="news-facts-summary-heading" className={HEADING_SECTION}>
                {displayName} {t('NewsFactsSummary.438417')}
            </h2>

            {items.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                    {t('NewsFactsSummary.3ed34b', { v0: displayName })}
                </p>
            ) : (
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                    <p>
                        {/* 티커를 따로 넘기지 않는다 — `displayName`이 이미
                            `Apple Inc. (AAPL)`처럼 티커를 품어서
                            `(AAPL) (AAPL)`로 두 번 나갔다. */}
                        {t('NewsFactsSummary.34b3fc', {
                            v0: displayName,
                            v1: items.length,
                        })}
                    </p>
                    {latestPublishedAt ? (
                        <p>
                            {t('NewsFactsSummary.d54f8a', {
                                v0: formatNewsPublishedAt(
                                    latestPublishedAt,
                                    locale
                                ),
                            })}
                        </p>
                    ) : null}
                    <p>{t('NewsFactsSummary.630450', { v0: analyzedCount })}</p>
                    {analyzedCount > 0 ? (
                        <p>
                            {t('NewsFactsSummary.0a451a', {
                                v0: sentimentCounts.bullish,
                                v1: sentimentCounts.neutral,
                                v2: sentimentCounts.bearish,
                            })}
                        </p>
                    ) : null}

                    {headlines.length > 0 ? (
                        <div>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('NewsFactsSummary.fc9900')}
                            </h3>
                            <ol className="mt-2 list-decimal space-y-1 pl-5">
                                {headlines.map(headline => (
                                    <li key={headline.id}>{headline.title}</li>
                                ))}
                            </ol>
                        </div>
                    ) : null}

                    <p>
                        {isCrypto
                            ? t('NewsFactsSummary.5a1c5f')
                            : t('NewsFactsSummary.c154a3')}
                    </p>
                </div>
            )}
        </section>
    );
}
