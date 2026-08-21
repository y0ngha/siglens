import { DIRECT_TICKER_RE } from './searchLabels';
import { resultDisplayNames } from './resultDisplay';
import type { TickerSearchResult } from '@/shared/lib/types';

export interface SubmitTarget {
    symbol: string;
    /** 최근 검색에 남길 표시 이름. */
    label: string;
}

/**
 * 검색 키(Enter·검색 버튼)를 눌렀을 때 **어디로 갈지**를 정한다. 오버레이와 데스크톱
 * 자동완성이 같은 규칙을 쓰도록 한곳에 둔다 — 같은 제품의 두 검색 표면이 같은 키에
 * 다르게 반응하던 자리다.
 *
 * ## 순서와 이유
 *
 * 1. **친 문자열과 심볼이 정확히 일치하는 결과**. 랭킹이 그 종목을 1위로 올리지
 *    못했더라도 사용자가 티커를 정확히 알고 친 경우다.
 * 2. **첫 결과**. 검색 엔진이 무언가를 알고 있다면 그 판단을 따른다.
 * 3. 결과가 **하나도 없을 때만** 친 문자열 자체. FMP가 색인하지 않는 종목에 닿는
 *    유일한 경로라 남겨 두지만, 친 문자열이 그대로 URL이 되므로 티커 형태가 아니면
 *    아무 데도 가지 않는다(`삼성전자`는 없는 페이지, `../`는 엉뚱한 라우트).
 *
 * 호출부는 **조회가 결착된 뒤에만** 이 함수를 불러야 한다. 아직 조회 중인 빈 결과는
 * "없다"가 아니라 "모른다"이고, 그 상태에서 3번으로 떨어지면 `apple`을 치고 곧바로
 * 검색 키를 누른 사용자가 AAPL이 아니라 `/APPLE`(404)로 간다.
 */
export function resolveSubmitTarget(
    query: string,
    results: readonly TickerSearchResult[]
): SubmitTarget | null {
    const typed = query.trim().toUpperCase();

    const exact = results.find(r => r.symbol.toUpperCase() === typed);
    const target = exact ?? results[0];
    if (target) {
        return {
            symbol: target.symbol,
            label: resultDisplayNames(target).primaryName,
        };
    }

    if (!typed || !DIRECT_TICKER_RE.test(typed)) return null;
    return { symbol: typed, label: typed };
}
