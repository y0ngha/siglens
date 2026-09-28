import type { NewsItem } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import type { RawFmpNews } from '@/shared/api/fmp/types';
import { detectTruncatedBody } from '@/shared/lib/news/detectTruncatedBody';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';
import { normalizeFmpPublishedDate } from '@/shared/api/fmp/normalizeFmpPublishedDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

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

/** Maximum article count for a single `fetchNewsForPeriod` request. */
const LONG_PERIOD_LIMIT = 1000;

/**
 * Sentinel string used when `site` is absent/null and the `url` cannot be
 * parsed as a valid URL. Exported so tests can assert against the constant
 * rather than a duplicated literal (§13.5).
 */
export const SOURCE_UNKNOWN_FALLBACK = 'unknown';

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
        return SOURCE_UNKNOWN_FALLBACK;
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
        // FMP도 전문이 아니라 리드 조각을 주는 일이 잦다 — 실측(2026-08-17)에서
        // `news/stock` 10건 중 8건이 문장 중간에서 끊겼다(`…during the quarter. Apple makes`).
        // 네이버와 달리 `...` 표식이 없어 눈에 띄지 않았을 뿐이다.
        bodyTruncated: detectTruncatedBody(raw.text),
    };
}

/** FMP adapter for news data. Uses `fmpGet` for all HTTP calls. */
export class FmpNewsClient {
    /**
     * @param newsSource - FMP news path segment to use. 'stock' hits `news/stock` (default,
     * US equities). 'crypto' hits `news/crypto` (symbols-tagged, same response shape).
     */
    constructor(private readonly newsSource: 'stock' | 'crypto' = 'stock') {}

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
            from: toUtcIsoDate(cutoff),
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
}
