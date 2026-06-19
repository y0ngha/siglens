/**
 * FMP 이벤트명에서 마지막 괄호 접미사를 제거해 base 지표명을 반환한다.
 * 예: 'Core PCE Price Index YoY (May)' → 'Core PCE Price Index YoY'.
 *
 * 마지막 괄호 그룹만 제거한다 — 'Index (ex Food) MoM (Apr)'의 '(ex Food)'는 보존.
 * SP-B가 전체 정규화(기간 토큰 한국어화 등)를 소유하며, SP-A는 enumeration 덤프용
 * base명 추출만 필요하다.
 */
export function normalizeIndicatorBaseName(raw: string): string {
    return raw.replace(/\s*\([^()]*\)\s*$/, '').trim();
}
