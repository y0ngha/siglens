/**
 * 누르는 순간의 촉감. ai 레이아웃은 iOS 탭 하이라이트(회색 사각형)를 끄므로, 그 대신 눌린
 * 버튼이 살짝 작아진다. `hover:`는 hover 가능한 기기에서만 켜져(Tailwind v4) 터치에는 이것이
 * 유일한 눌림 신호다. `transition-*`를 붙이지 않는다 — 아래 `AI_RAISED_CONTROL` 주석 참조.
 */
export const AI_PRESS_FEEDBACK =
    'active:scale-[0.97] motion-reduce:active:scale-100';

/**
 * 떠 있는 SIGLENS AI 조작 요소의 공통 계약 — 표면(`surface-raised`, globals.css), 호버 시 밝아짐,
 * 포커스 링. 크기·배치·글자색은 호출부가 `cn()`으로 덧붙인다.
 *
 * 함께 쓰는 클래스에 `transition-*`(버튼 상수의 `transition-colors` 포함)·`shadow-*`
 * 유틸리티를 넣지 않는다 — 유틸리티 레이어가 `.surface-raised`의 전환·그림자 변수를 덮어 호버가
 * 툭 바뀌고 입체감이 사라진다. 그래서 `BUTTON_*` 상수 대신 이 상수를 쓴다.
 */
export const AI_RAISED_CONTROL = `surface-raised surface-raised-hover focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${AI_PRESS_FEEDBACK}`;

/**
 * 마우스 기기의 넓은 화면에서만 "hover/focus 때 떠오르는" 보조 동작(메시지 복사·편집, 대화
 * 행 ✎·🗑). `sm:`만 걸면 iPad처럼 넓지만 hover가 없는 기기에서 버튼이 영영 보이지 않는다 —
 * `pointer-fine`을 함께 걸어 터치 기기에서는 항상 보이게 한다. 호출부가 `group`을 단다.
 */
export const AI_HOVER_REVEAL =
    'sm:pointer-fine:opacity-0 sm:pointer-fine:group-hover:opacity-100 sm:pointer-fine:group-focus-within:opacity-100';

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
