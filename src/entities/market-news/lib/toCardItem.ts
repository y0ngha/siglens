import type { MarketNewsRow } from '../model';

/**
 * Market-news display card — `NewsDisplayItem` plus `tickers` for display chips.
 * Intentionally narrow: only what the client needs for rendering; DB-internal
 * fields (bodyEn, symbol, analyzedAt) are excluded.
 *
 * This type is the allowlist contract between the server row and the RSC payload.
 * It is defined here (pure lib, no server-only deps) so both the Server Action
 * (`getMarketNewsCardsAction`) and the page's `loadCategorySnapshot` can share
 * the same projection without diverging.
 */
export type MarketNewsCardItem = Omit<
    MarketNewsRow,
    'bodyEn' | 'symbol' | 'analyzedAt'
>;

/**
 * Project a `MarketNewsRow` to the client-safe `MarketNewsCardItem` shape.
 *
 * Explicit allowlist: only fields declared in `MarketNewsCardItem` are copied.
 * DB-internal columns (`bodyEn`, `symbol`, `analyzedAt`) are intentionally
 * omitted so they are never serialised into the RSC payload or Server Action response.
 */
export function toMarketNewsCardItem(row: MarketNewsRow): MarketNewsCardItem {
    const {
        id,
        publishedAt,
        titleEn,
        titleKo,
        sentiment,
        category,
        bodyKo,
        summaryKo,
        priceImpact,
        url,
        source,
        tickers,
    } = row;

    return {
        id,
        publishedAt,
        titleEn,
        titleKo,
        sentiment,
        category,
        bodyKo,
        summaryKo,
        priceImpact,
        url,
        source,
        tickers,
    };
}
