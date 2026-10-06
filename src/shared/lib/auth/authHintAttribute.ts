import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/**
 * `<html>`에 찍는 로그인 추정 표식. 값은 `AuthHintState`.
 *
 * WHY: 헤더 인증 영역은 정적(ISR) 셸이라 서버가 방문자를 모른다 — SSR은 늘 게스트 CTA
 * (로그인·회원가입, sm 이상 약 10.5rem)를 그리고, 회원은 하이드레이션 뒤에야 아바타
 * (2.5rem)로 바뀐다. 그 폭 차이만큼 헤더 왼쪽 요소(검색)가 옆으로 밀렸다(CLS). 첫 페인트
 * **전에** 힌트 쿠키를 읽어 이 속성을 찍으면, CSS(`globals.css`의 `[data-header-auth-slot]`
 * 규칙)가 처음부터 맞는 폭을 잡고 회원에게는 게스트 CTA를 그리지 않는다.
 *
 * 인증의 근거가 아니다 — 세션이 죽었는데 힌트만 남을 수 있다. 세션이 확정되면
 * `AuthSessionHeaderClient`가 실제 상태로 다시 찍는다.
 */
export const AUTH_HINT_ATTRIBUTE = 'data-auth-hint';

/** 로그인 추정 상태. `member`면 회원 폭(아바타)을, `guest`면 게스트 CTA 폭을 잡는다. */
export type AuthHintState = 'member' | 'guest';

/**
 * 첫 페인트 전에 `<html data-auth-hint>`를 찍는 인라인 스크립트(`beforeInteractive`).
 *
 * 판정은 `readAuthHintCookie`와 같다 — 이름이 일치하는 쿠키가 **값과 함께** 있으면 회원
 * 추정(로그아웃은 빈 값으로 지운다). 번들 밖에서 도는 문자열이라 그 함수를 import할 수
 * 없어 같은 규칙을 ES5로 다시 쓴다(테스트가 두 판정을 대조한다).
 *
 * `catch`에서 아무것도 찍지 않는 이유: 속성이 없으면 CSS 기본값(게스트 폭)이 적용된다 —
 * 서버 HTML이 그리는 것과 같은 상태라 가장 안전한 폴백이다.
 */
export const AUTH_HINT_INIT_SCRIPT = `(function(){try{
var p=${JSON.stringify(`${AUTH_HINT_COOKIE_NAME}=`)},c=document.cookie.split(';'),m=false;
for(var i=0;i<c.length;i++){var s=c[i].replace(/^\\s+|\\s+$/g,'');if(s.indexOf(p)===0&&s.length>p.length){m=true;break;}}
document.documentElement.setAttribute(${JSON.stringify(AUTH_HINT_ATTRIBUTE)},m?'member':'guest');
}catch(e){}})()`;

/**
 * 세션이 확정된 뒤 실제 상태로 `<html data-auth-hint>`를 갱신한다(브라우저 전용).
 * 로그인·로그아웃·세션 만료 뒤에도 헤더 폭 예약이 실제 렌더와 맞게 따라간다.
 */
export function setAuthHintAttribute(state: AuthHintState): void {
    document.documentElement.setAttribute(AUTH_HINT_ATTRIBUTE, state);
}
