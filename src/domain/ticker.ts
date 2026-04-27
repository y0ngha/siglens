import type { AssetInfo, TickerSearchResult } from '@y0ngha/siglens-core';

const KOREAN_UNICODE_REGEX = /[\u3131-\u3163\uac00-\ud7a3]/;

// 미국 주식 티커 형식: 1–5 대문자, 또는 BRK.A 형식(점 + 1–2 대문자)
const TICKER_FORMAT_REGEX = /^(?:[A-Z]{1,5}|[A-Z]{1,4}\.[A-Z]{1,2})$/;

export function isValidTickerFormat(ticker: string): boolean {
    return TICKER_FORMAT_REGEX.test(ticker);
}

export function isKoreanInput(query: string): boolean {
    return KOREAN_UNICODE_REGEX.test(query);
}

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
