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

/**
 * 영문 법인명을 표시할지 판정하는 단일 소스.
 *
 * `buildDisplayName`(문자열 하나 조립)과 `SymbolLayoutHeader`(같은 판정을 span
 * 두 개로 나눠 렌더)가 각자 이 규칙을 베껴 구현했다가 갈라졌다 — 헤더 쪽은
 * `name !== ''` 가드가 빠져 있어서 이름이 빈 문자열인 종목(예: 시세만 있고
 * 이름이 없는 크립토)에서 `한글명, (TICKER)`처럼 빈 span과 낙오된 쉼표가
 * 렌더됐다. 두 소비자가 이 함수 하나로 판정하면 같은 페이지의 메타와 헤더가
 * 다른 이름을 말하는 사고가 구조적으로 불가능해진다.
 *
 * - `name`이 비어 있거나 `ticker`·`koreanName`과 같으면 보탤 게 없으므로 false.
 * - 국내 상장 종목은 영문 법인명이 한국어 SERP·UI에 보태는 게 없으면서
 *   meta description 예산(120자)을 잠식한다(§ buildDisplayName 사용처 참고).
 */
export function shouldShowEnglishName(
    name: string,
    koreanName: string | undefined,
    ticker: string
): boolean {
    return (
        name !== '' &&
        name !== ticker &&
        name !== koreanName &&
        !isKrEquitySymbol(ticker)
    );
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
        const showEnglishName = shouldShowEnglishName(name, koreanName, ticker);
        return showEnglishName
            ? `${koreanName}, ${name} (${ticker})`
            : `${koreanName} (${ticker})`;
    }
    return nameIsDifferent ? `${name} (${ticker})` : ticker;
}
