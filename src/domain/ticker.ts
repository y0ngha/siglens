import type { AssetInfo, TickerSearchResult } from '@/domain/types';

const KOREAN_UNICODE_REGEX = /[ㄱ-ㅣ가-힣]/;

// 미국 주식 티커 형식: 1–5 대문자, 또는 BRK.A 형식(점 + 1–2 대문자)
const TICKER_FORMAT_REGEX = /^(?:[A-Z]{1,5}|[A-Z]{1,4}\.[A-Z]{1,2})$/;

/**
 * Test whether a string matches the U.S. equity ticker format.
 *
 * Accepts 1–5 uppercase letters (e.g. `"AAPL"`) or the dotted class form
 * (e.g. `"BRK.A"`, with 1–4 letters before the dot and 1–2 after).
 * Lowercase and other characters always fail — uppercase the input before
 * calling.
 *
 * @param ticker - Candidate ticker string.
 * @returns `true` when the format matches, `false` otherwise.
 *
 * @example
 * ```ts
 * isValidTickerFormat('AAPL'); // true
 * isValidTickerFormat('BRK.A'); // true
 * isValidTickerFormat('aapl'); // false
 * isValidTickerFormat('TOOLONG'); // false
 * ```
 */
export function isValidTickerFormat(ticker: string): boolean {
    return TICKER_FORMAT_REGEX.test(ticker);
}

/**
 * Detect whether a search query contains any Hangul (Korean) character.
 *
 * Used by `searchTicker` to choose between the Korean-name store and the
 * FMP symbol/name search. Returns `true` as soon as one Hangul codepoint
 * is present anywhere in the string.
 *
 * @param query - Free-text search query.
 * @returns `true` when the string contains at least one Hangul character.
 *
 * @example
 * ```ts
 * isKoreanInput('애플'); // true
 * isKoreanInput('apple'); // false
 * isKoreanInput('AAPL 애플'); // true
 * ```
 */
export function isKoreanInput(query: string): boolean {
    return KOREAN_UNICODE_REGEX.test(query);
}

/**
 * Deduplicate ticker search results by symbol, preserving first occurrence.
 *
 * Stable: the first hit for each symbol wins, downstream duplicates are
 * filtered. Used to merge symbol-search and name-search results into a
 * single cohesive list.
 *
 * @param results - Search results, possibly containing duplicate symbols.
 * @returns A new array with each symbol appearing at most once.
 */
export function deduplicateResults(
    results: TickerSearchResult[]
): TickerSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
        if (seen.has(result.symbol)) return false;
        seen.add(result.symbol);
        return true;
    });
}

/**
 * Build the canonical display string for an asset, merging Korean and English
 * names with the ticker symbol.
 *
 * @param assetInfo - Asset metadata, or `null` when no info is available.
 * @param ticker - Canonical ticker symbol.
 */
export function buildDisplayName(
    assetInfo: AssetInfo | null,
    ticker: string
): string {
    if (!assetInfo) return ticker;

    const { name, koreanName } = assetInfo;
    const nameIsDifferent = name !== '' && name !== ticker;

    if (koreanName) {
        return nameIsDifferent
            ? `${koreanName}, ${name} (${ticker})`
            : `${koreanName} (${ticker})`;
    }
    return nameIsDifferent ? `${name} (${ticker})` : ticker;
}
