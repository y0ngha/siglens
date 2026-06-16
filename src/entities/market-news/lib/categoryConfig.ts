import type { NewsFeedCategory } from '@y0ngha/siglens-core';

export interface CategoryConfig {
    /** DB bucket symbol — never shown in a URL. */
    sentinel: string;
    /** FMP `/stable/<path>` for this category's market-wide feed (confirmed in Phase 0). */
    fmpEndpoint: string;
    /** URL slug at /news/<slug>. */
    slug: NewsFeedCategory;
    /** Korean display label for headings + the digest prompt. */
    koLabel: string;
}

export const CATEGORY_CONFIG: Record<NewsFeedCategory, CategoryConfig> = {
    general: {
        sentinel: '__NEWS_GENERAL__',
        fmpEndpoint: 'news/general-latest',
        slug: 'general',
        koLabel: '미국 일반 시장',
    },
    stock: {
        sentinel: '__NEWS_STOCK__',
        fmpEndpoint: 'news/stock-latest',
        slug: 'stock',
        koLabel: '미국 주식',
    },
    crypto: {
        sentinel: '__NEWS_CRYPTO__',
        fmpEndpoint: 'news/crypto-latest',
        slug: 'crypto',
        koLabel: '미국 암호화폐',
    },
    forex: {
        sentinel: '__NEWS_FOREX__',
        fmpEndpoint: 'news/forex-latest',
        slug: 'forex',
        koLabel: '미국 외환',
    },
    articles: {
        sentinel: '__NEWS_ARTICLES__',
        fmpEndpoint: 'fmp-articles',
        slug: 'articles',
        koLabel: '미국 마켓 아티클',
    },
};

const VALID_SLUGS: ReadonlySet<string> = new Set(Object.keys(CATEGORY_CONFIG));

/** Narrow an arbitrary route param to a NewsFeedCategory, or null if invalid. */
export function categoryFromSlug(slug: string): NewsFeedCategory | null {
    // safe: VALID_SLUGS is Object.keys(CATEGORY_CONFIG), so has(slug) proves slug ∈ NewsFeedCategory
    return VALID_SLUGS.has(slug) ? (slug as NewsFeedCategory) : null;
}
