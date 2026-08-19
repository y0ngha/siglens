import { useTranslations } from 'next-intl';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import type { AssetClass } from '@/shared/config/marketProfile';

export interface NewsFactsSummaryProps {
    symbol: string;
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

function getHeadlineItems(items: readonly NewsDisplayItem[]): HeadlineItem[] {
    return items
        .flatMap(item => {
            const title = item.titleKo ?? item.titleEn ?? '';
            return title.length > 0 ? [{ id: item.id, title }] : [];
        })
        .slice(0, MAX_HEADLINES);
}

export function NewsFactsSummary({
    symbol,
    displayName,
    assetClass,
    items,
}: NewsFactsSummaryProps) {
    const t = useTranslations('widgets.news');
    const latestPublishedAt = getLatestPublishedAt(items);
    const analyzedCount = items.filter(item => item.sentiment !== null).length;
    const sentimentCounts = getSentimentCounts(items);
    const headlines = getHeadlineItems(items);
    const isCrypto = assetClass === 'crypto';

    return (
        <section
            aria-labelledby="news-facts-summary-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-5"
        >
            <h2
                id="news-facts-summary-heading"
                className="text-lg font-semibold tracking-tight"
            >
                {displayName} {t('NewsFactsSummary.438417')}
            </h2>

            {items.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                    {displayName} {t('NewsFactsSummary.2453b9')}
                </p>
            ) : (
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                    <p>
                        {displayName} ({symbol}
                        {t('NewsFactsSummary.2658c0')} {items.length}
                        {t('NewsFactsSummary.1519b2')}
                    </p>
                    {latestPublishedAt ? (
                        <p>
                            {t('NewsFactsSummary.306582')}{' '}
                            {formatNewsPublishedAt(latestPublishedAt)}{' '}
                            {t('NewsFactsSummary.615021')}
                        </p>
                    ) : null}
                    <p>
                        {t('NewsFactsSummary.fd7a75')} {analyzedCount}
                        {t('NewsFactsSummary.2da115')}
                    </p>
                    {analyzedCount > 0 ? (
                        <p>
                            {t('NewsFactsSummary.f36be5')}{' '}
                            {sentimentCounts.bullish}
                            {t('NewsFactsSummary.b9024e')}{' '}
                            {sentimentCounts.neutral}
                            {t('NewsFactsSummary.e3a052')}{' '}
                            {sentimentCounts.bearish}
                            {t('NewsFactsSummary.feb04c')}
                        </p>
                    ) : null}

                    {headlines.length > 0 ? (
                        <div>
                            <h3 className="text-sm font-semibold text-secondary-200">
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
