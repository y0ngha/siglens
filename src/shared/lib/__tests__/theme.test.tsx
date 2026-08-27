import { beforeEach, describe, expect, it } from 'vitest';

import {
    removeMatchMedia,
    stubPrefersColorScheme,
} from '@/shared/test-utils/matchMedia';

import {
    DEFAULT_THEME,
    THEME_ATTRIBUTE,
    THEME_INIT_SCRIPT,
    THEME_STORAGE_KEY,
    applyStoredTheme,
    readThemePreference,
    resolveTheme,
} from '../theme';

/**
 * 이 파일이 생긴 이유: 테마는 이 리디자인의 간판 기능인데 테스트가 **0건**이었다.
 * 특히 `THEME_INIT_SCRIPT`는 문자열로 조립돼 `<head>`에 그대로 주입되는
 * 렌더 블로킹 스크립트라, 오타가 나도 tsc·oxlint·빌드 어디에서도 신호가 없다.
 * 그 상태로 배포되면 전 사용자의 테마가 조용히 죽는다.
 */

function runInitScript(): void {
    // 실제 `<head>`가 하는 일과 같게 — 문자열을 그대로 실행한다.
    new Function(THEME_INIT_SCRIPT)();
}

describe('resolveTheme', () => {
    it('명시적 선택은 시스템 선호도를 무시한다', () => {
        expect(resolveTheme('light', false)).toBe('light');
        expect(resolveTheme('dark', true)).toBe('dark');
    });

    it('system일 때만 시스템 선호도를 따른다', () => {
        expect(resolveTheme('system', true)).toBe('light');
        expect(resolveTheme('system', false)).toBe('dark');
    });
});

describe('THEME_INIT_SCRIPT', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        document.documentElement.style.colorScheme = '';
    });

    it('저장된 선택을 그대로 적용한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('저장된 값이 없으면 시스템 선호도를 따른다', () => {
        stubPrefersColorScheme(true);
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );

        stubPrefersColorScheme(false);
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'dark'
        );
    });

    it('명시적 선택은 시스템 선호도를 이긴다', () => {
        // 이미 다크를 고른 사용자가 OS를 라이트로 바꿔도 앱은 다크로 남아야 한다.
        stubPrefersColorScheme(true);
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'dark'
        );
    });

    it('matchMedia가 없는 환경에서는 기본값으로 떨어진다', () => {
        // 구형 브라우저·일부 임베디드 웹뷰. 스크립트가 throw하면 `data-theme`이
        // 아예 안 붙어 페이지가 스타일 없이 뜬다.
        removeMatchMedia();
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            DEFAULT_THEME
        );
    });

    it('알 수 없는 값이 저장돼 있으면 고르지 않은 것과 같게 다룬다', () => {
        stubPrefersColorScheme(true);
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );
    });

    it('localStorage가 막혀 있어도 테마를 적용한다', () => {
        // Safari 프라이빗 모드에서 실제로 throw한다. catch가 없으면 이 스크립트가
        // 죽고 `data-theme`이 아예 안 붙어 페이지가 스타일 없이 뜬다.
        const original = Object.getOwnPropertyDescriptor(
            window,
            'localStorage'
        );
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('blocked');
            },
        });
        try {
            runInitScript();
            expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
                DEFAULT_THEME
            );
            expect(document.documentElement.style.colorScheme).toBe(
                DEFAULT_THEME
            );
        } finally {
            if (original) {
                Object.defineProperty(window, 'localStorage', original);
            }
        }
    });
});

/**
 * 같은 판정이 **문자열 한 벌, 함수 한 벌**로 존재한다. 인라인 스크립트는
 * 번들보다 먼저 렌더 블로킹으로 돌아야 하고, 에러 셸에는 그 스크립트가
 * 아예 없어 번들 쪽 함수가 필요하다.
 *
 * 그래서 한쪽만 검사하면 안 된다 — 어느 한쪽만 고치는 편집이 어떤 게이트에도
 * 안 걸린다. 양쪽을 **실제로 실행해** 결과를 대조한다.
 */
describe('applyStoredTheme와 THEME_INIT_SCRIPT의 판정이 같다', () => {
    const cases = ['light', 'dark', 'sepia', ''] as const;
    /* 저장값만 돌리면 두 구현이 **시스템 선호도에서** 갈리는 경우를 못 잡는다 —
       실제로 이번 변경이 건드린 부분이 정확히 그 분기다. */
    const preferences = [true, false] as const;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        document.documentElement.style.colorScheme = '';
    });

    function observe(run: () => void, stored: string): [string, string] {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        document.documentElement.style.colorScheme = '';
        if (stored !== '') localStorage.setItem(THEME_STORAGE_KEY, stored);
        run();
        return [
            document.documentElement.getAttribute(THEME_ATTRIBUTE) ?? '',
            document.documentElement.style.colorScheme,
        ];
    }

    it.each(
        cases.flatMap(stored => preferences.map(pl => [stored, pl] as const))
    )(
        '저장값 %s · 시스템 라이트=%s에서 두 구현이 같다',
        (stored, prefersLight) => {
            stubPrefersColorScheme(prefersLight);
            const a = observe(applyStoredTheme, stored);
            stubPrefersColorScheme(prefersLight);
            const b = observe(runInitScript, stored);
            expect(a).toEqual(b);
        }
    );

    it('matchMedia가 없어도 두 구현이 같은 결과를 낸다', () => {
        removeMatchMedia();
        expect(observe(applyStoredTheme, '')).toEqual(
            observe(runInitScript, '')
        );
    });

    it('localStorage가 막혀도 두 구현이 같은 결과를 낸다', () => {
        const original = Object.getOwnPropertyDescriptor(
            window,
            'localStorage'
        );
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('blocked');
            },
        });
        try {
            document.documentElement.removeAttribute(THEME_ATTRIBUTE);
            applyStoredTheme();
            const viaFn =
                document.documentElement.getAttribute(THEME_ATTRIBUTE);
            document.documentElement.removeAttribute(THEME_ATTRIBUTE);
            runInitScript();
            expect(viaFn).toBe(
                document.documentElement.getAttribute(THEME_ATTRIBUTE)
            );
            expect(viaFn).toBe(DEFAULT_THEME);
        } finally {
            if (original) {
                Object.defineProperty(window, 'localStorage', original);
            }
        }
    });
});

describe('readThemePreference', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('저장값이 없으면 system이다 — 키의 부재가 곧 그 선택이다', () => {
        expect(readThemePreference()).toBe('system');
    });

    it('저장된 명시적 선택을 그대로 돌려준다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        expect(readThemePreference()).toBe('light');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        expect(readThemePreference()).toBe('dark');
    });

    it('알 수 없는 값은 고르지 않은 것과 같게 다룬다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
        expect(readThemePreference()).toBe('system');
    });

    it('localStorage 접근이 막혀도 system으로 떨어진다', () => {
        // Safari 프라이빗 모드는 접근 자체가 throw한다. catch가 없으면 이
        // 함수를 부르는 컴포넌트가 마운트에서 통째로 죽는다.
        const original = Object.getOwnPropertyDescriptor(
            window,
            'localStorage'
        );
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('blocked');
            },
        });
        try {
            expect(readThemePreference()).toBe('system');
        } finally {
            if (original)
                Object.defineProperty(window, 'localStorage', original);
        }
    });
});
