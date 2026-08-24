/**
 * 테마 상수와 페인트 전 적용 스크립트.
 *
 * 모든 라우트가 ISR 정적이라 서버는 사용자의 테마 선택을 알 수 없다. 쿠키로
 * 해결하면 공유 셸이 dynamic으로 바뀌어 **전 라우트 ISR이 깨지고**(축 0 규약),
 * `Vary`에 얹으면 CDN 캐시가 테마별로 쪼개진다. 따라서 테마는 오직 클라이언트가
 * 첫 페인트 직전에 적용하며, SSR HTML은 두 테마에서 바이트 단위로 동일하다.
 */

export const THEME_STORAGE_KEY = 'siglens-theme';

/** 사용자가 고를 수 있는 값. `system`은 저장하지 않고 키를 지우는 것으로 표현한다. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** 실제로 화면에 적용되는 값. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * 저장된 선택이 없을 때의 기본.
 *
 * **시스템 선호도를 따르지 않고 다크로 고정한다.** 이 앱은 오랫동안 다크 전용이었고,
 * 시스템 선호를 따르게 하면 OS가 라이트인 사용자 전원이 아무 동작도 하지 않았는데
 * 앱 전체 외형이 바뀐다. 라이트는 사용자가 토글을 눌렀을 때만 적용한다.
 *
 * `system` 선택지를 노출하게 되면 그때는 `resolveTheme`이 선호도를 반영한다 —
 * 그 경로는 이미 구현돼 있고, 여기서 막는 것은 "선택하지 않은 사용자"뿐이다.
 */
export const DEFAULT_THEME: ResolvedTheme = 'dark';

/** `<html>`이 이 두 값 중 하나를 항상 갖는다 — 미지정 상태를 만들지 않는다. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * `<head>`에 인라인으로 박히는 렌더 블로킹 스크립트.
 *
 * 블로킹이 의도된 유일한 자리다. `defer`거나 번들로 빠지면 다크 셸이 먼저
 * 칠해진 뒤 라이트로 바뀌는 깜빡임(FOUC)이 난다. next-themes 같은 프로바이더를
 * 쓰지 않는 이유도 같다 — 3KB 클라이언트 컨텍스트가 33개 라우트 first-load에
 * 들어가는데, 이 앱은 모바일 CPU에서 react-dom eval만 1.8초라 여유가 없다.
 *
 * `catch`에서 기본값을 강제하는 이유: Safari 프라이빗 모드는 localStorage
 * 접근 자체가 throw한다. 그때도 속성은 반드시 찍혀야 스타일이 결정된다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},s=localStorage.getItem(k);
var t=(s==='light'||s==='dark')?s:${JSON.stringify(DEFAULT_THEME)};
var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;
}catch(e){var r2=document.documentElement;r2.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});r2.style.colorScheme=${JSON.stringify(DEFAULT_THEME)};}})()`;

/** 저장된 선택 + 시스템 선호도를 실제 적용값으로 접는다. */
export function resolveTheme(
    preference: ThemePreference,
    prefersLight: boolean
): ResolvedTheme {
    if (preference === 'light' || preference === 'dark') return preference;
    return prefersLight ? 'light' : 'dark';
}
