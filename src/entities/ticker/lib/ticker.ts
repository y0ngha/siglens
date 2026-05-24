import type { AssetInfo, TickerSearchResult } from '@/shared/lib/types';

const KOREAN_UNICODE_REGEX = /[ㄱ-ㅣ가-힣]/;

// 미국 주식 티커 형식: 1–5 대문자, 또는 BRK.A 형식(점 + 1–2 대문자)
const TICKER_FORMAT_REGEX = /^(?:[A-Z]{1,5}|[A-Z]{1,4}\.[A-Z]{1,2})$/;

/** Test whether a string matches the U.S. equity ticker format (1–5 uppercase letters or `BRK.A`-style dotted class). */
export function isValidTickerFormat(ticker: string): boolean {
    return TICKER_FORMAT_REGEX.test(ticker);
}

/** Detect whether a search query contains any Hangul (Korean) character; used to route between Korean-name store and FMP search. */
export function isKoreanInput(query: string): boolean {
    return KOREAN_UNICODE_REGEX.test(query);
}

/** Deduplicate ticker search results by symbol, preserving first occurrence (stable). */
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

/** Build the canonical display string for an asset, merging Korean and English names with the ticker symbol. */
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
