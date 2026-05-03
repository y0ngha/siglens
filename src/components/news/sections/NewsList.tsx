import type { NewsRow } from '@/infrastructure/db/newsRepository';
import type { NewsSentiment } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

// ─── Sentiment badge ──────────────────────────────────────────────────────────

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    bearish: '부정',
    neutral: '중립',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
    neutral: 'bg-muted text-muted-foreground',
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

// ─── News card ────────────────────────────────────────────────────────────────

interface NewsCardProps {
    item: NewsRow;
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
        <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
            <h3 className="text-[text-wrap:balance] font-semibold leading-snug">
                {item.titleKo ?? item.titleEn}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.sentiment !== null && (
                    <SentimentBadge value={item.sentiment} />
                )}
                {item.category !== null && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {item.category}
                    </span>
                )}
                <time
                    dateTime={item.publishedAt}
                    className="text-xs text-muted-foreground"
                >
                    {publishedDate}
                </time>
                <span className="text-xs text-muted-foreground">
                    {item.source}
                </span>
            </div>
            {item.summaryKo !== null && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.summaryKo}
                </p>
            )}
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-primary transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                원문 보기 →
            </a>
        </article>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface NewsListProps {
    items: NewsRow[];
}

/**
 * RSC section: renders the list of news cards for a symbol.
 *
 * Data is fetched by the parent RSC section wrapper in `page.tsx` and
 * passed as a typed prop — this component never touches infrastructure.
 */
export function NewsList({ items }: NewsListProps) {
    if (items.length === 0) {
        return (
            <section
                aria-labelledby="news-list-heading"
                className="rounded-xl border border-border bg-card p-6"
            >
                <h2
                    id="news-list-heading"
                    className="mb-3 text-lg font-semibold tracking-tight"
                >
                    최근 뉴스
                </h2>
                <p className="text-sm text-muted-foreground">
                    최근 7일간 뉴스가 없습니다.
                </p>
            </section>
        );
    }

    return (
        <section
            aria-labelledby="news-list-heading"
            className="space-y-3"
        >
            <h2
                id="news-list-heading"
                className="text-lg font-semibold tracking-tight"
            >
                최근 뉴스
            </h2>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.id}>
                        <NewsCard item={item} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
