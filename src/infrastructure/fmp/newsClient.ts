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

const HOURS_PER_DAY = 24;

/** Hours to subtract from `Date.now()` to compute the cutoff per `NewsTimeRange`. */
const RANGE_TO_HOURS: Record<NewsTimeRange, number> = {
    '24h': HOURS_PER_DAY,
    '7d': 7 * HOURS_PER_DAY,
    '30d': 30 * HOURS_PER_DAY,
};

const ZONELESS_DATE_TIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;
const FMP_NEWS_TIME_ZONE = 'America/New_York';
const FMP_NEWS_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: FMP_NEWS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/** Cutoff `Date` for filtering articles older than the given `NewsTimeRange`. */
export function computeCutoff(range: NewsTimeRange): Date {
    const hours = RANGE_TO_HOURS[range];
    return new Date(Date.now() - hours * MS_PER_HOUR);
}

/**
 * FMP stock news commonly returns `publishedDate` without a timezone
 * (`YYYY-MM-DD HH:mm:ss`). Those values are Eastern-market local time, so
 * normalize them through America/New_York before storing UTC in the DB.
 */
export function normalizeFmpPublishedDate(value: string): string {
    const match = ZONELESS_DATE_TIME_RE.exec(value);
    if (!match) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid FMP publishedDate: ${value}`);
        }
        return date.toISOString();
    }

    const [, year, month, day, hour, minute, second, ms = '0'] = match;
    const localUtcMs = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        Number(ms.padEnd(3, '0'))
    );
    const utcMs = convertEasternLocalToUtcMs(localUtcMs);
    return new Date(utcMs).toISOString();
}

function tryNormalizeFmpPublishedDate(value: string): string | null {
    try {
        return normalizeFmpPublishedDate(value);
    } catch {
        return null;
    }
}

function convertEasternLocalToUtcMs(localUtcMs: number): number {
    const firstPass = localUtcMs - getEasternOffsetMs(localUtcMs);
    const secondPass = localUtcMs - getEasternOffsetMs(firstPass);
    return secondPass;
}

function getEasternOffsetMs(utcMs: number): number {
    const parts = FMP_NEWS_TIME_FORMATTER.formatToParts(new Date(utcMs));
    const values = Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );

    const easternAsUtcMs = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );
    return easternAsUtcMs - utcMs;
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
            .map(n => ({
                raw: n,
                publishedAt: tryNormalizeFmpPublishedDate(n.publishedDate),
            }))
            .filter(
                (n): n is { raw: RawFmpNews; publishedAt: string } =>
                    n.publishedAt !== null && new Date(n.publishedAt) >= cutoff
            )
            .map(({ raw, publishedAt }) => ({
                id: hashUrlToId(raw.url),
                symbol: raw.symbol,
                source: raw.site,
                url: raw.url,
                publishedAt,
                titleEn: raw.title,
                bodyEn: raw.text,
            }));
    }

    // FMP stable calendar endpoint has no per-symbol filter; callers filter at the repository layer after DB caching.
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
