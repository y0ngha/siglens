import type { AssetInfo, TickerSearchResult } from '@/shared/lib/types';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

const KOREAN_UNICODE_REGEX = /[ㄱ-ㅣ가-힣]/;

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
        // 국내 상장 종목은 영문 법인명을 붙이지 않는다. 한국어 SERP·UI에서 보태는 게
        // 없으면서 meta description 예산(120자)을 크게 먹는다 — `삼성전자, Samsung
        // Electronics Co., Ltd. (005930.KS)`가 47자로, 고정 후미(90자)와 합치면 137자라
        // 모든 국내 종목 페이지에서 설명 끝문장이 잘려 나갔다.
        //
        // `name === koreanName` 배제는 종목 마스터 시드 때문이다. 시드는 영문명을 주지
        // 않아 `name`에 한글명을 넣어 두므로, 방문 전 종목은 `삼성전자, 삼성전자 (…)`가 된다.
        const showEnglishName =
            nameIsDifferent && name !== koreanName && !isKrEquitySymbol(ticker);
        return showEnglishName
            ? `${koreanName}, ${name} (${ticker})`
            : `${koreanName} (${ticker})`;
    }
    return nameIsDifferent ? `${name} (${ticker})` : ticker;
}
