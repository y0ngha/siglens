/**
 * 본문·카드 안의 강조 텍스트 링크(또는 링크처럼 보이는 텍스트 버튼): primary 글자색, hover에서 한 단계
 * 밝게, 키보드 포커스 링. 크기·여백·높이는 자리마다 달라 호출부가 `cn(LINK_ACCENT, 'min-h-11 …')`로
 * 붙인다(`buttonStyles`와 같은 방식).
 */
export const LINK_ACCENT =
    'font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
