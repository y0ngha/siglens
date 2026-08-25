import { beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_THEME,
    THEME_ATTRIBUTE,
    THEME_INIT_SCRIPT,
    THEME_STORAGE_KEY,
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

    it('저장된 값이 없으면 기본값으로 고정한다 — 시스템 선호도를 따르지 않는다', () => {
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            DEFAULT_THEME
        );
    });

    it('알 수 없는 값이 저장돼 있어도 기본값으로 떨어진다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
        runInitScript();
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            DEFAULT_THEME
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
