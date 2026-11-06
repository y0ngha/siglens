/**
 * 떠 있는 SIGLENS AI 조작 요소의 공통 계약 — 표면(`surface-raised`, globals.css), 호버 시 밝아짐,
 * 포커스 링. 크기·배치·글자색은 호출부가 `cn()`으로 덧붙인다.
 *
 * 함께 쓰는 클래스에 `transition-*`(버튼 상수의 `transition-colors` 포함)·`shadow-*`
 * 유틸리티를 넣지 않는다 — 유틸리티 레이어가 `.surface-raised`의 전환·그림자 변수를 덮어 호버가
 * 툭 바뀌고 입체감이 사라진다. 그래서 `BUTTON_*` 상수 대신 이 상수를 쓴다.
 */
export const AI_RAISED_CONTROL =
    'surface-raised surface-raised-hover focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * SIGLENS AI 입력 필드(컴포저·메시지 편집·대화 검색·이름 바꾸기)의 터치 기기 글자 크기.
 *
 * iOS Safari는 글자 크기가 16px 미만인 입력에 포커스하면 화면을 자동 확대하고, 전송 후에도
 * 확대가 풀리지 않아 사용자가 직접 줄여야 한다. `maximum-scale=1`로 막으면 핀치 줌까지
 * 잠겨(Android) 접근성(WCAG 1.4.4)을 해치므로, 확대 조건 자체를 없앤다 — 터치 기기에서만
 * 16px로 올리고 마우스 기기에서는 호출부의 원래 크기를 유지한다.
 * 변형(variant) 유틸리티라 호출부의 기본 `text-*`와 함께 남고, 터치 기기에서만 CSS 순서상 뒤에
 * 생성되는 이쪽이 이긴다. 줄 높이는 호출부의 `leading-*`가 있으면 그대로 유지된다.
 */
export const AI_FIELD_TOUCH_TEXT = 'pointer-coarse:text-base';
