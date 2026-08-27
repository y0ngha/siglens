/**
 * jsdom에는 `matchMedia`가 없다.
 *
 * 스텁을 두지 않으면 테마 코드가 전부 "선호도 판정 불가" 경로만 타고,
 * **기본값으로 떨어지는 폴백 하나만** 검증된다 — 시스템을 따라가는 동작은
 * 한 줄도 확인되지 않은 채 전부 초록이 된다. 그래서 명시적으로 심는다.
 *
 * 두 테스트 파일(`lib/__tests__/theme.test.tsx`,
 * `ui/__tests__/ThemeToggle.test.tsx`)이 같은 스텁을 각자 재구현하고 있어서
 * 여기로 모았다 — 한쪽만 고치면 두 파일의 전제가 갈린다.
 */

interface ThemeMatchMediaOptions {
    /** `change` 리스너를 잡아 둘 배열. OS 변경 시뮬레이션에 쓴다. */
    readonly listeners?: ((event: MediaQueryListEvent) => void)[];
}

/**
 * `prefers-color-scheme`에 답하는 `matchMedia`를 심는다.
 *
 * 질의 문자열에 `light`가 들어 있으면 `prefersLight`를, 아니면 그 반대를
 * 돌려준다 — 실제 브라우저에서 두 질의가 배타적인 것과 같은 성질이다.
 */
export function stubPrefersColorScheme(
    prefersLight: boolean,
    options: ThemeMatchMediaOptions = {}
): void {
    const { listeners } = options;
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: query.includes('light') ? prefersLight : !prefersLight,
            media: query,
            addEventListener: (
                _type: string,
                fn: (event: MediaQueryListEvent) => void
            ) => {
                listeners?.push(fn);
            },
            removeEventListener: (
                _type: string,
                fn: (event: MediaQueryListEvent) => void
            ) => {
                if (!listeners) return;
                const at = listeners.indexOf(fn);
                if (at >= 0) listeners.splice(at, 1);
            },
        }),
    });
}

/** `matchMedia` 자체가 없는 환경(구형 브라우저·일부 임베디드 웹뷰). */
export function removeMatchMedia(): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: undefined,
    });
}
