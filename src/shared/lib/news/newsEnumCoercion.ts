import type {
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';

/**
 * Canonical enum values for the news analysis columns. The DB stores these
 * fields as raw text (no DB-level CHECK constraint), so we validate at the
 * read boundary instead of trusting the writer.
 *
 * The `Record<T, true>` shape forces compile-time exhaustiveness against the
 * source-of-truth types in `@y0ngha/siglens-core` — if the core adds a new
 * `NewsSentiment` / `NewsCategory` / `NewsImpact` member, TypeScript will
 * reject this file until the new member is mirrored here, preventing the
 * silent "valid value gets coerced to null at the boundary" failure.
 */
const NEWS_SENTIMENT_RECORD: Record<NewsSentiment, true> = {
    bullish: true,
    bearish: true,
    neutral: true,
};
const NEWS_CATEGORY_RECORD: Record<NewsCategory, true> = {
    earnings: true,
    m_and_a: true,
    guidance: true,
    regulation: true,
    macro: true,
    product: true,
    other: true,
};
const NEWS_IMPACT_RECORD: Record<NewsImpact, true> = {
    high: true,
    medium: true,
    low: true,
    negligible: true,
};

export function isNewsSentiment(value: string): value is NewsSentiment {
    return value in NEWS_SENTIMENT_RECORD;
}
export function isNewsCategory(value: string): value is NewsCategory {
    return value in NEWS_CATEGORY_RECORD;
}
export function isNewsImpact(value: string): value is NewsImpact {
    return value in NEWS_IMPACT_RECORD;
}

export function toNewsSentiment(value: unknown): NewsSentiment | null {
    if (typeof value !== 'string') return null;
    return isNewsSentiment(value) ? value : null;
}

export function toNewsCategory(value: unknown): NewsCategory | null {
    if (typeof value !== 'string') return null;
    return isNewsCategory(value) ? value : null;
}

export function toNewsImpact(value: unknown): NewsImpact | null {
    if (typeof value !== 'string') return null;
    return isNewsImpact(value) ? value : null;
}
