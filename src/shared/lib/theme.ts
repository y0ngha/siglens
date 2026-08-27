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
 * 저장된 선택이 **없고 시스템 선호도도 읽을 수 없을 때**의 최종 폴백.
 *
 * 예전에는 이 값이 "선택하지 않은 사용자 전원의 테마"였다. 라이트가 아직
 * 실험적이던 시절, 시스템을 따르면 OS가 라이트인 사용자가 아무 동작도 안 했는데
 * 앱 외형이 뒤집히는 것을 막으려는 결정이었다. 라이트 테마가 1급으로 자리잡은
 * 지금은 기본이 `system`이고, 이 상수의 역할은 **`matchMedia`가 없는 환경**
 * (구형 브라우저, 일부 임베디드 웹뷰)으로 좁혀졌다.
 *
 * 이미 `light`/`dark`를 고른 사용자는 이 변경의 영향을 받지 않는다 —
 * `localStorage`에 값이 있으면 그것이 언제나 우선한다.
 */
export const DEFAULT_THEME: ResolvedTheme = 'dark';

/**
 * 시스템 선호도 질의. 인라인 스크립트·번들 쌍둥이·변경 리스너 **세 곳**이 쓴다.
 * 문자열이 흩어지면 한쪽만 오타가 나도 아무 테스트가 못 잡으므로 여기서만 정의한다.
 */
export const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)';

/** `<html>`이 이 두 값 중 하나를 항상 갖는다 — 미지정 상태를 만들지 않는다. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * 테마가 바뀔 때 쏘는 이벤트 이름.
 *
 * 차트는 CSS 변수를 못 읽어 JS로 색을 받는다. 이 문자열이 발신 1곳·수신 2곳에
 * **리터럴로 복제돼** 있었는데, 한쪽에 오타가 나면 라이트에서 차트만 검게 남고
 * 어떤 테스트도 그걸 못 본다(팔레트 테스트는 색만 증명하지 배선을 증명하지
 * 않는다). 한 곳에서 내보낸다.
 */
export const THEME_CHANGE_EVENT = 'siglens:themechange';

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
var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia(${JSON.stringify(PREFERS_LIGHT_QUERY)}).matches?'light':${JSON.stringify(DEFAULT_THEME)});
var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;
}catch(e){var r2=document.documentElement;r2.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});r2.style.colorScheme=${JSON.stringify(DEFAULT_THEME)};}})()`;

/**
 * 저장된 테마를 `<html>`에 적용한다. `THEME_INIT_SCRIPT`와 **같은 판정**이되,
 * 이쪽은 번들 안에서 호출된다.
 *
 * 왜 두 벌인가: 인라인 스크립트는 번들보다 먼저, 렌더 블로킹으로 돌아야
 * FOUC가 없다 — 함수를 import해서 부르는 순간 그 조건이 깨진다. 그래서
 * 판정이 문자열로도 한 벌 존재한다. 두 벌이 어긋나지 않는지는 테스트가
 * **양쪽을 실제로 실행해** 대조한다(한쪽만 보는 테스트는 드리프트를 못 잡는다).
 *
 * 쓰이는 곳은 동적 세그먼트의 `notFound()`가 만드는 에러 셸이다. 그 셸은
 * 루트 레이아웃을 거치지 않아 `<head>`의 스크립트가 아예 없다.
 */
/**
 * 저장값과 시스템 선호도를 접어 **실제 적용할 테마**를 고른다.
 *
 * `let` + 재할당 대신 이른 반환으로 쓴다 — 분기가 셋(저장값 / 시스템 / 폴백)이라
 * 재할당식은 "마지막에 무엇이 남는가"를 읽는 사람이 추적해야 한다(MISTAKES #14).
 */
function readEffectiveTheme(): ResolvedTheme {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia?.(PREFERS_LIGHT_QUERY).matches
            ? 'light'
            : DEFAULT_THEME;
    } catch {
        // Safari 프라이빗 모드는 접근 자체가 throw한다 — 기본값으로 간다.
        return DEFAULT_THEME;
    }
}

export function applyStoredTheme(): void {
    const theme = readEffectiveTheme();
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, theme);
    root.style.colorScheme = theme;
}

/** 저장된 선택 + 시스템 선호도를 실제 적용값으로 접는다. */
export function resolveTheme(
    preference: ThemePreference,
    prefersLight: boolean
): ResolvedTheme {
    if (preference === 'light' || preference === 'dark') return preference;
    return prefersLight ? 'light' : 'dark';
}

/**
 * 저장된 **선택**을 읽는다. 저장값이 없으면 `system`이다 — 키의 부재가 곧
 * "시스템을 따른다"는 표현이기 때문이다(`setTheme('system')`이 키를 지운다).
 *
 * `resolveTheme`이 "선택 + 선호도 → 적용값"을 접는다면, 이쪽은 그 앞 단계인
 * "무엇을 골랐는가"만 돌려준다. 테마 메뉴가 현재 선택을 표시하는 데 쓴다 —
 * `<html data-theme>`만 봐서는 `dark`가 명시적 선택인지 OS를 따른 결과인지
 * 구분할 수 없다.
 */
export function readThemePreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // 접근이 막힌 환경에서는 고른 적이 없는 것과 같게 다룬다.
    }
    return 'system';
}
