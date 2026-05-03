import type { NewsSentiment } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

// Mirrors NewsRow fields without importing from infrastructure — structural compatibility guaranteed by shared field names.
export interface NewsDisplayItem {
    id: string;
    publishedAt: string;
    titleEn: string;
    titleKo: string | null;
    sentiment: string | null;
    category: string | null;
    summaryKo: string | null;
    url: string;
    source: string;
}

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

const VALID_SENTIMENTS = new Set<string>(['bullish', 'bearish', 'neutral']);

function isNewsSentiment(value: string): value is NewsSentiment {
    return VALID_SENTIMENTS.has(value);
}

interface SentimentBadgeProps {
    value: string;
}

function SentimentBadge({ value }: SentimentBadgeProps) {
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

interface NewsCardProps {
    item: NewsDisplayItem;
}

function NewsCard({ item }: NewsCardProps) {
    const publishedDate = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(item.publishedAt));

    return (
        <article className="border-secondary-700 bg-secondary-800 hover:border-primary-500/50 rounded-xl border p-4 transition-colors">
            <h3 className="leading-snug font-semibold text-balance">
                {item.titleKo ?? item.titleEn}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.sentiment !== null && (
                    <SentimentBadge value={item.sentiment} />
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
            {item.summaryKo !== null && (
                <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                    {item.summaryKo}
                </p>
            )}
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 focus-visible:ring-primary-500 mt-2 inline-block text-xs transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
            >
                원문 보기 →
            </a>
        </article>
    );
}

interface NewsListProps {
    items: NewsDisplayItem[];
}

export function NewsList({ items }: NewsListProps) {
    if (items.length === 0) {
        return (
            <section
                aria-labelledby="news-list-heading"
                className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
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

    return (
        <section aria-labelledby="news-list-heading" className="space-y-3">
            <h2
                id="news-list-heading"
                className="text-lg font-semibold tracking-tight"
            >
                최근 뉴스
            </h2>
            <ul className="space-y-3">
                {items.map(item => (
                    <li key={item.id}>
                        <NewsCard item={item} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
