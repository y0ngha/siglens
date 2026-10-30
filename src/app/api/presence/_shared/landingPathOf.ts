/**
 * 비콘이 뜬 페이지의 경로. 비콘은 same-origin `fetch`라 `Referer`에 현재 페이지
 * URL이 그대로 실린다 — 클라이언트가 본문을 보낼 필요가 없다.
 *
 * 쿼리스트링은 버린다. 검색어·추천 코드 같은 것이 섞여 들어오면 400일짜리
 * 통계 테이블이 그걸 같이 보관하게 된다. 헤더가 없거나 URL로 해석되지 않으면 `null`이다.
 */
export function landingPathOf(referer: string | null): string | null {
    if (referer === null || !URL.canParse(referer)) return null;
    return new URL(referer).pathname;
}
