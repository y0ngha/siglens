/** 접힌 인기 종목 패널에서 보이는 카드 수 — 모바일(1열) 3, `md`(2열) 4, `lg`(3열) 6. */
export const COLLAPSED_VISIBLE = { base: 3, md: 4, lg: 6 } as const;

/**
 * "모든 업종 보기" 버튼에 붙일 반응형 클래스. 카드가 모두 이미 보이는 너비에서는 숨긴다.
 * 어느 너비에서도 숨는 카드가 없으면(`null`) 버튼을 그리지 않는다. Tailwind가 소스에서 클래스를
 * 찾으므로 문자열은 리터럴로 둔다.
 */
export function expandButtonVisibility(cardCount: number): string | null {
    if (cardCount > COLLAPSED_VISIBLE.lg) return '';
    if (cardCount > COLLAPSED_VISIBLE.md) return 'lg:hidden';
    if (cardCount > COLLAPSED_VISIBLE.base) return 'md:hidden';
    return null;
}
