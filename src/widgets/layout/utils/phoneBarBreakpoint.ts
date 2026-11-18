/**
 * 폰 폭 헤더 줄의 경계(30rem = 480px). 비회원의 테마(◐) 버튼은 이 폭 미만에서 헤더 줄을 비우고
 * 드로어로 옮긴다 — 헤더가 숨기는 쪽(`HIDE_BELOW_PHONE_BAR`)과 드로어가 보이는 쪽
 * (`SHOW_BELOW_PHONE_BAR`)이 **같은 경계**여야 한다. 어긋나면 어느 쪽에도 테마 컨트롤이 없는 폭이
 * 생긴다. Tailwind가 클래스를 정적으로 찾도록 완성된 리터럴로 둔다.
 */
export const HIDE_BELOW_PHONE_BAR = 'max-[30rem]:hidden';
export const SHOW_BELOW_PHONE_BAR = 'min-[30rem]:hidden';
