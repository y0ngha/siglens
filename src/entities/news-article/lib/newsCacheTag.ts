/**
 * 종목별 뉴스 캐시 태그(`news:{SYMBOL}`)의 **유일한** 생성기.
 *
 * 뉴스 목록·실적 캘린더·애널리스트 액션 캐시(`staticSymbolCache` extraTags)가 이 태그를 달고,
 * 새 기사 적재 시 `revalidateTag`가 같은 태그로 무효화한다. 두 쪽이 태그를 각자 조립하면
 * 대소문자 정규화가 갈라져(`news:aapl` vs `news:AAPL`) 무효화가 조용히 빗나가고 ISR이
 * 최대 revalidate 상한(12h)까지 stale하게 남는다. 그래서 정규화 규칙(대문자)을 여기 한 곳에만 둔다.
 */
export function newsCacheTag(symbol: string): string {
    return `news:${symbol.toUpperCase()}`;
}
