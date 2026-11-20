/**
 * 종합 탭 SSR 엿보기(`loadOverallPeek`)의 데이터 캐시 태그.
 *
 * 프리웜이 종합 분석을 미리 만든 뒤 이 태그만 털어, 같은 심볼의 다른 캐시(봉·프로필·뉴스 목록)는
 * 두고 종합 엿보기 항목만 갱신한다. 엿보기가 MISS(`null`)로 12시간 캐시돼 있으면 새로 만든 결과가
 * 그 시간 동안 안 보이기 때문이다. 태그는 캐시 키에 들어가지 않는다 — 태그가 없던 기존 항목은
 * 12시간 안에 만료되고, 그 사이는 종전과 같다.
 */
export function overallPeekTag(symbol: string): string {
    return `overall-peek:${symbol.toUpperCase()}`;
}
