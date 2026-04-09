import type { TickerSearchResult } from '@/domain/types';

const KOREAN_UNICODE_REGEX = /[\u3131-\u3163\uac00-\ud7a3]/;

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
