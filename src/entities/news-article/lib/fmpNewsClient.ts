import { createHash } from 'crypto';
import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import type { RawFmpEarningsReport, RawFmpNews } from '@/shared/api/fmp/types';
import { MS_PER_HOUR } from '@/shared/config/time';

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

/**
 * Module-level flag that throttles `tryNormalizeFmpPublishedDate` warn logs
 * to a single occurrence per process. A bad FMP batch can contain dozens of
 * malformed rows in one response, and emitting a `console.warn` for each
 * would spam server logs without adding signal — one warning is enough to
 * surface the issue to operators.
 */
let hasWarnedNormalizeFailure = false;

function tryNormalizeFmpPublishedDate(value: string): string | null {
    try {
        return normalizeFmpPublishedDate(value);
    } catch {
        if (!hasWarnedNormalizeFailure) {
            hasWarnedNormalizeFailure = true;
            console.warn(`[newsClient] failed to normalize date: ${value}`);
        }
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

/**
 * Stable URL-safe 32-char ID from a news article URL via SHA-256.
 *
 * 이전 구현은 Buffer.from(url).toString('base64url').slice(0, 32) — base64url은
 * 3바이트 → 4자 단위로 인코딩하므로 앞 32자는 URL의 앞 24바이트에만 의존한다.
 * 같은 도메인 기사들(예: globenewswire.com, seekingalpha.com)이 모두 동일한
 * ID를 가져 DB에서 row를 덮어쓰고 엉뚱한 뉴스 내용이 저장되는 버그가 있었다.
 * SHA-256은 URL 전체를 해싱하므로 충돌이 사실상 불가능하다.
 */
export function hashUrlToId(url: string): string {
    return createHash('sha256').update(url).digest('base64url').slice(0, 32);
}

function toEarningsDate(value: RawFmpEarningsReport): string | null {
    return typeof value.date === 'string'
        ? value.date
        : typeof value.earningsDate === 'string'
          ? value.earningsDate
          : null;
}

/** Maximum article count for a single `fetchNewsForPeriod` request. */
const LONG_PERIOD_LIMIT = 1000;

/** Format a Date as YYYY-MM-DD (UTC). Used to build FMP `from` query param. */
export function toYyyyMmDd(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * FMP crypto news sometimes returns `site` as null despite the type declaration
 * (`site: string`). Provide a hostname-derived fallback so the NOT NULL `source`
 * DB column is always satisfied without requiring a schema migration.
 */
function resolveSource(raw: RawFmpNews): string {
    if (raw.site) return raw.site;
    try {
        return new URL(raw.url).hostname;
    } catch {
        return 'unknown';
    }
}

function mapRawToNewsItem(raw: RawFmpNews, publishedAt: string): NewsItem {
    return {
        id: hashUrlToId(raw.url),
        symbol: raw.symbol,
        source: resolveSource(raw),
        url: raw.url,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.text,
    };
}

/** FMP adapter for news and earnings data. Uses `fmpGet` for all HTTP calls. */
export class FmpNewsClient {
    /**
     * @param newsSource - FMP news path segment to use. 'stock' hits `news/stock` (default,
     * US equities). 'crypto' hits `news/crypto` (symbols-tagged, same response shape).
     */
    constructor(private readonly newsSource: 'stock' | 'crypto' = 'stock') {}

    /** Fetch news articles for a symbol within the given time window (most recent first). */
    async fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]> {
        const raw = await fmpGet<RawFmpNews[]>(`news/${this.newsSource}`, {
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
            .map(({ raw, publishedAt }) => mapRawToNewsItem(raw, publishedAt));
    }

    /**
     * Fetch news articles for a symbol going back `lookbackMs` milliseconds
     * from now. Uses FMP's `from` date parameter so periods longer than 30d
     * (e.g. 6 months) are fully covered in a single request.
     */
    async fetchNewsForPeriod(
        symbol: string,
        lookbackMs: number
    ): Promise<NewsItem[]> {
        const cutoff = new Date(Date.now() - lookbackMs);
        const raw = await fmpGet<RawFmpNews[]>(`news/${this.newsSource}`, {
            symbols: symbol,
            limit: String(LONG_PERIOD_LIMIT),
            from: toYyyyMmDd(cutoff),
        });
        return raw
            .map(n => ({
                raw: n,
                publishedAt: tryNormalizeFmpPublishedDate(n.publishedDate),
            }))
            .filter(
                (n): n is { raw: RawFmpNews; publishedAt: string } =>
                    n.publishedAt !== null && new Date(n.publishedAt) >= cutoff
            )
            .map(({ raw, publishedAt }) => mapRawToNewsItem(raw, publishedAt));
    }

    /** Fetch the latest earnings report for a symbol; returns `null` when unavailable. */
    async fetchEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const raw = await fmpGet<RawFmpEarningsReport[]>('earnings', {
            symbol,
        });
        const r = raw[0];
        if (!r) return null;
        const earningsDate = toEarningsDate(r);
        if (earningsDate === null) return null;
        return {
            symbol: r.symbol,
            earningsDate,
        };
    }
}
