import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    hashUrlToId,
    normalizeFmpPublishedDate,
} from '@/entities/news-article/lib/fmpNewsClient';
import { CATEGORY_CONFIG } from './categoryConfig';
import type {
    MarketNewsClientPort,
    MarketNewsItem,
} from './marketNewsClientPort';
import { FMP_NEWS_FETCH_LIMIT } from './marketNewsConstants';

/** Raw shape returned by FMP `/stable/news/{general,stock,crypto,forex}-latest`. */
interface RawFmpLatestNews {
    symbol: string | null;
    publishedDate: string;
    publisher?: string | null;
    title: string;
    site: string;
    text?: string | null;
    url: string;
}

/** Raw shape returned by FMP `/stable/fmp-articles`. */
interface RawFmpArticle {
    title: string;
    date: string;
    content?: string | null;
    tickers?: string | null;
    link: string;
    author?: string | null;
    site: string;
}

/** A raw FMP latest-news item paired with a successfully normalized date string. */
interface DatedLatestRaw {
    raw: RawFmpLatestNews;
    publishedAt: string;
}

/** A raw FMP article item paired with a successfully normalized date string. */
interface DatedArticleRaw {
    raw: RawFmpArticle;
    publishedAt: string;
}

/**
 * Parse the `tickers` string from FMP articles into bare ticker symbols.
 *
 * FMP articles return tickers as a comma-separated string with optional
 * exchange prefix (`"NASDAQ:AAPL,NYSE:MSFT"`). This strips the prefix and
 * returns only the bare symbol. Empty/missing input returns `[]`.
 */
export function parseArticleTickers(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(t => {
            const trimmed = t.trim();
            const colonIdx = trimmed.indexOf(':');
            return colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : trimmed;
        })
        .filter(t => t.length > 0);
}

/** Warn log deduplication flag — one warning per process is enough to surface failures. */
let hasWarnedNormalizeFailure = false;

function tryNormalizeFmpPublishedDate(value: string): string | null {
    try {
        return normalizeFmpPublishedDate(value);
    } catch {
        if (!hasWarnedNormalizeFailure) {
            hasWarnedNormalizeFailure = true;
            console.warn(
                `[marketNewsClient] failed to normalize date: ${value}`
            );
        }
        return null;
    }
}

function mapLatestRawToItem(
    raw: RawFmpLatestNews,
    publishedAt: string,
    sentinel: string
): MarketNewsItem {
    return {
        id: hashUrlToId(raw.url),
        symbol: sentinel,
        source: raw.publisher ?? raw.site,
        url: raw.url,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.text ?? null,
        tickers: raw.symbol ? [raw.symbol] : [],
    };
}

function mapArticleRawToItem(
    raw: RawFmpArticle,
    publishedAt: string,
    sentinel: string
): MarketNewsItem {
    return {
        id: hashUrlToId(raw.link),
        symbol: sentinel,
        source: raw.site,
        url: raw.link,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.content ?? null,
        tickers: parseArticleTickers(raw.tickers),
    };
}

/** FMP adapter for market-wide category news feeds. */
export class FmpMarketNewsClient implements MarketNewsClientPort {
    /**
     * Fetch the category's market-wide feed and return items published within
     * the given lookback window. The sentinel symbol from `CATEGORY_CONFIG` is
     * applied to every returned item so the repository can bucket correctly.
     *
     * Two distinct FMP response shapes are handled:
     * - **latest** (`general`/`stock`/`crypto`/`forex`): `{ symbol, publishedDate, publisher, title, site, text, url }`.
     * - **articles**: `{ title, date, content, tickers, link, author, site }`.
     */
    async fetchCategoryNews(
        category: NewsFeedCategory,
        lookbackMs: number
    ): Promise<MarketNewsItem[]> {
        const { sentinel, fmpEndpoint } = CATEGORY_CONFIG[category];
        const cutoff = new Date(Date.now() - lookbackMs);

        if (category === 'articles') {
            const raw = await fmpGet<RawFmpArticle[]>(fmpEndpoint, {
                limit: String(FMP_NEWS_FETCH_LIMIT),
            });
            return raw
                .map(r => ({
                    raw: r,
                    publishedAt: tryNormalizeFmpPublishedDate(r.date),
                }))
                .filter(
                    (n): n is DatedArticleRaw =>
                        n.publishedAt !== null &&
                        new Date(n.publishedAt) >= cutoff
                )
                .map(({ raw, publishedAt }) =>
                    mapArticleRawToItem(raw, publishedAt, sentinel)
                );
        }

        const raw = await fmpGet<RawFmpLatestNews[]>(fmpEndpoint, {
            limit: String(FMP_NEWS_FETCH_LIMIT),
        });
        return raw
            .map(r => ({
                raw: r,
                publishedAt: tryNormalizeFmpPublishedDate(r.publishedDate),
            }))
            .filter(
                (n): n is DatedLatestRaw =>
                    n.publishedAt !== null && new Date(n.publishedAt) >= cutoff
            )
            .map(({ raw, publishedAt }) =>
                mapLatestRawToItem(raw, publishedAt, sentinel)
            );
    }
}
