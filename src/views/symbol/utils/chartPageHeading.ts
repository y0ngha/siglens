/**
 * 차트 라우트 h1 텍스트의 단일 소스.
 *
 * `page.tsx`의 SSR 크롤용 sr-only h1과 `SymbolPageClient`의 가시 h1은 반드시 동일해야
 * 한다 — 둘이 다르면 크롤러가 받는 h1 ≠ 사용자가 보는 h1, 즉 cloaking이 된다(SEO 위험).
 * 두 파일에 리터럴을 각각 두면 한쪽만 수정될 때 조용히 drift하므로 여기서 한 번만 만든다.
 */
export function buildChartPageHeading(displayName: string): string {
    return `${displayName} 차트 분석`;
}
