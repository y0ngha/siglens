import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';

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
    const latestPublishedAt = getLatestPublishedAt(items);
    const analyzedCount = items.filter(item => item.sentiment !== null).length;
    const sentimentCounts = getSentimentCounts(items);
    const headlines = getHeadlineItems(items);
    const isCrypto = assetClass === 'crypto';

    return (
        <section
            aria-labelledby="news-facts-summary-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-5"
        >
            <h2 id="news-facts-summary-heading" className={HEADING_SECTION}>
                {displayName} 최근 뉴스 데이터 요약
            </h2>

            {items.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                    {displayName} 최신 뉴스 데이터가 아직 준비되지 않았습니다.
                    뉴스 카드가 분석되면 최근 기사와 분위기 요약이 이 영역에
                    표시됩니다.
                </p>
            ) : (
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                    <p>
                        {displayName} ({symbol}) 페이지는 최근 뉴스{' '}
                        {items.length}건을 표시합니다.
                    </p>
                    {latestPublishedAt ? (
                        <p>
                            최신 기사는{' '}
                            {formatNewsPublishedAt(latestPublishedAt)}{' '}
                            기준입니다.
                        </p>
                    ) : null}
                    <p>AI 뉴스 카드 분석은 {analyzedCount}건 완료됐습니다.</p>
                    {analyzedCount > 0 ? (
                        <p>
                            분위기 분포는 긍정 {sentimentCounts.bullish}건, 중립{' '}
                            {sentimentCounts.neutral}건, 부정{' '}
                            {sentimentCounts.bearish}건입니다.
                        </p>
                    ) : null}

                    {headlines.length > 0 ? (
                        <div>
                            <h3 className={HEADING_SUBSECTION}>
                                최근 기사 제목
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
                            ? '코인 뉴스의 핵심 이슈와 분위기를 함께 확인할 수 있습니다.'
                            : '뉴스 흐름과 함께 어닝 일정, 최근 실적, 애널리스트 등급 변경을 이어서 확인할 수 있습니다.'}
                    </p>
                </div>
            )}
        </section>
    );
}
