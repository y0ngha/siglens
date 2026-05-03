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
import { MS_PER_HOUR } from '@/domain/constants/time';

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

/** Cutoff `Date` for filtering articles older than the given `NewsTimeRange`. */
export function computeCutoff(range: NewsTimeRange): Date {
    const hours = RANGE_TO_HOURS[range];
    return new Date(Date.now() - hours * MS_PER_HOUR);
}

/** Stable URL-safe 32-char ID from a news article URL (base64url, truncated). */
export function hashUrlToId(url: string): string {
    return Buffer.from(url).toString('base64url').slice(0, 32);
}

/** FMP adapter implementing `NewsProvider`. Uses `fmpGet` for all HTTP calls. */
export class FmpNewsClient implements NewsProvider {
    /** Fetch news articles for a symbol within the given time window (most recent first). */
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

    // FMP does not support per-symbol filtering on the stable calendar endpoint —
    // callers must filter by symbol at the repository layer after DB caching.
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
