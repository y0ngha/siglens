/**
 * 떠 있는 SIGLENS AI 조작 요소의 공통 계약 — 표면(`ai-raised`, globals.css), 호버 시 밝아짐,
 * 포커스 링. 크기·배치·글자색은 호출부가 `cn()`으로 덧붙인다.
 *
 * 함께 쓰는 클래스에 `transition-*`(버튼 상수의 `transition-colors` 포함)·`shadow-*`
 * 유틸리티를 넣지 않는다 — 유틸리티 레이어가 `.ai-raised`의 전환·그림자 변수를 덮어 호버가
 * 툭 바뀌고 입체감이 사라진다. 그래서 `BUTTON_*` 상수 대신 이 상수를 쓴다.
 */
export const AI_RAISED_CONTROL =
    'ai-raised ai-raised-hover focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
