/**
 * FMP implementation of `NewsProvider`.
 *
 * Fetches news articles, earnings calendar entries, and earnings reports from
 * FMP `/stable/news/stock`, `/stable/earnings-calendar`, and `/stable/earnings`.
 *
 * Field-name mapping decisions (FMP → domain):
 * - `publishedDate` → `publishedAt`
 * - `site`          → `source`
 * - `title`         → `titleEn`
 * - `text`          → `bodyEn`
 * - `date`          → `earningsDate`          (earnings calendar)
 * - `eps`           → `epsActual`             (earnings calendar)
 * - `revenue`       → `revenueActual`         (earnings calendar)
 * - `updatedFromDate` → `lastUpdated`         (earnings calendar)
 *
 * The `id` for each news item is derived by base64url-encoding the article URL
 * and truncating to 32 characters — this makes IDs stable and URL-safe.
 */
import type {
    EarningsCalendarItem,
    EarningsReport,
    NewsItem,
    NewsProvider,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import { fmpGet } from '@/infrastructure/fmp/httpClient';
import type {
    RawFmpEarningsCalendarItem,
    RawFmpEarningsReport,
    RawFmpNews,
} from '@/infrastructure/fmp/types';

/** Maximum article count to request per `NewsTimeRange` value. */
const RANGE_TO_LIMIT: Record<NewsTimeRange, number> = {
    '24h': 30,
    '7d': 100,
    '30d': 300,
};

/** Hours to subtract from `Date.now()` to compute the cutoff per `NewsTimeRange`. */
const RANGE_TO_HOURS: Record<NewsTimeRange, number> = {
    '24h': 24,
    '7d': 168,
    '30d': 720,
};

/**
 * Compute the cutoff `Date` for a given `NewsTimeRange`.
 * Articles published before this date are excluded.
 *
 * @internal
 */
export function computeCutoff(range: NewsTimeRange): Date {
    const hours = RANGE_TO_HOURS[range];
    return new Date(Date.now() - hours * 60 * 60 * 1_000);
}

/**
 * Derive a stable, URL-safe 32-character ID from a news article URL.
 *
 * Uses base64url encoding so the result is safe to embed in query-strings
 * and database primary keys without further escaping.
 *
 * @internal
 */
export function hashUrlToId(url: string): string {
    return Buffer.from(url).toString('base64url').slice(0, 32);
}

/**
 * FMP adapter implementing `NewsProvider`.
 *
 * Uses the shared `fmpGet` helper (see `httpClient.ts`) for all HTTP calls.
 */
export class FmpNewsClient implements NewsProvider {
    /**
     * Fetch recent news articles for a symbol within the given time window.
     *
     * Requests up to `RANGE_TO_LIMIT[range]` articles from FMP, then filters
     * out any articles published before the computed cutoff date.
     *
     * @param symbol - Ticker symbol (e.g. `"AAPL"`).
     * @param range  - Lookback window (`'24h'` | `'7d'` | `'30d'`).
     * @returns Ordered list of news items (most recent first).
     */
    async fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]> {
        const raw = await fmpGet<RawFmpNews[]>('news/stock', {
            symbols: symbol,
            limit: String(RANGE_TO_LIMIT[range]),
        });
        const cutoff = computeCutoff(range);
        return raw
            .filter(n => new Date(n.publishedDate) >= cutoff)
            .map(n => ({
                id: hashUrlToId(n.url),
                symbol: n.symbol,
                source: n.site,
                url: n.url,
                publishedAt: n.publishedDate,
                titleEn: n.title,
                bodyEn: n.text,
            }));
    }

    /**
     * Fetch the full earnings calendar from FMP.
     *
     * FMP does not support per-symbol filtering on the stable calendar endpoint,
     * so the full result is returned — callers must filter by symbol at the
     * repository layer (e.g. after DB caching in Task 2.5).
     *
     * @returns All scheduled earnings events across all symbols.
     */
    async fetchEarningsCalendarAll(): Promise<EarningsCalendarItem[]> {
        const raw =
            await fmpGet<RawFmpEarningsCalendarItem[]>('earnings-calendar');
        return raw.map(r => ({
            symbol: r.symbol,
            earningsDate: r.date,
            epsActual: r.eps,
            epsEstimated: r.epsEstimated,
            revenueActual: r.revenue,
            revenueEstimated: r.revenueEstimated,
            lastUpdated: r.updatedFromDate,
        }));
    }

    /** Fetch the latest earnings report for a symbol; returns `null` when unavailable. */
    async fetchEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const raw = await fmpGet<RawFmpEarningsReport[]>('earnings', {
            symbol,
        });
        const r = raw[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            earningsDate: r.earningsDate,
        };
    }
}
