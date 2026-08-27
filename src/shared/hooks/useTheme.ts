'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_THEME,
    PREFERS_LIGHT_QUERY,
    readThemePreference,
    resolveTheme,
    THEME_STORAGE_KEY,
    THEME_ATTRIBUTE,
    type ResolvedTheme,
    type ThemePreference,
    THEME_CHANGE_EVENT,
} from '@/shared/lib/theme';

/**
 * 테마 읽기/쓰기 훅.
 *
 * **프로바이더가 없다.** 전역 컨텍스트를 두면 루트 레이아웃이 클라이언트
 * 경계가 되고, 이 코드베이스에는 deep-tree 컨텍스트 등록이 렌더 폭풍을
 * 일으킨 전례가 있다. 대신 각 소비자가 이 훅으로 `<html>` 속성을 직접
 * 읽고 쓴다 — 진실의 원천이 DOM 속성 하나라 동기화할 상태가 없다.
 *
 * 첫 렌더는 항상 `DEFAULT_THEME`을 반환한다. 인라인 스크립트가 이미 올바른
 * 값을 찍어놨지만, 서버 HTML과 다른 값을 첫 렌더에서 뱉으면 하이드레이션
 * 불일치가 난다. 실제 값은 `useEffect`에서 한 박자 뒤에 채워지며, 그때까지
 * 화면은 CSS가 이미 올바르게 칠해둔 상태다(토글 라벨만 잠깐 기본값).
 */
export function useTheme() {
    const [theme, setThemeState] = useState<ResolvedTheme>(DEFAULT_THEME);
    /* 선택은 적용값과 별개다 — `dark`가 명시적 선택인지 OS를 따른 결과인지
       `<html data-theme>`만 봐서는 구분되지 않는다. 첫 렌더는 하이드레이션
       불일치를 피하려 `system`(= 저장값 없음)으로 시작한다. */
    const [preference, setPreferenceState] =
        useState<ThemePreference>('system');

    useEffect(() => {
        const current = document.documentElement.getAttribute(THEME_ATTRIBUTE);
        if (current === 'light' || current === 'dark') {
            setThemeState(current);
            /* 마운트 때 한 번 meta를 맞춘다.
               `viewport.themeColor`는 미디어 쿼리 배열이라 **OS**를 따르는데,
               적용 테마는 저장된 선택이 이긴다. 그래서 OS와 반대를 고른
               사용자는 페이지는 다크인데 모바일 상단 바만 밝은 상태로 뜬다
               (실측: 저장값 dark + OS light에서 themeColor가 `#f7f8fa`).
               지금까지는 `applyTheme`가 **토글할 때만** meta를 덮어써서
               로드 직후에는 어긋난 채였다. */
            syncThemeColorMeta(current);
        }
        setPreferenceState(readThemePreference());
    }, []);

    /*
     * OS 선호도 변경을 따라간다 — **선택이 `system`일 때만.**
     *
     * 예전에 이 리스너가 제거된 적이 있는데, 그때는 `system`이 선택지로
     * 노출되지 않아 "아무것도 고르지 않은 사용자"가 OS를 바꾸는 순간 앱이
     * 뒤집혔고, 결과를 저장하지도 않아 새로고침하면 되돌아갔다. 지금은 다르다 —
     * `system`이 명시적 선택이고 키의 부재로 저장되므로, OS를 따라가는 것이
     * 사용자가 고른 동작이며 새로고침 후에도 같은 판정이 나온다.
     *
     * `light`/`dark`를 고른 사용자에게는 아무 일도 일어나지 않는다.
     */
    useEffect(() => {
        if (preference !== 'system') return;
        const mql = window.matchMedia?.(PREFERS_LIGHT_QUERY);
        if (!mql) return;
        const onChange = (e: MediaQueryListEvent) => {
            const next: ResolvedTheme = e.matches ? 'light' : 'dark';
            applyTheme(next);
            setThemeState(next);
        };
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [preference]);

    const setTheme = useCallback((next: ThemePreference) => {
        const prefersLight =
            window.matchMedia?.(PREFERS_LIGHT_QUERY).matches ?? false;
        const resolved = resolveTheme(next, prefersLight);
        try {
            if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
            else localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // 저장이 막혀도 이번 세션 적용은 되어야 한다.
        }
        applyTheme(resolved);
        setThemeState(resolved);
        setPreferenceState(next);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(
            document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'light'
                ? 'dark'
                : 'light'
        );
    }, [setTheme]);

    return { theme, preference, setTheme, toggleTheme };
}

/**
 * `theme-color` meta를 적용 테마에 맞춘다.
 *
 * `viewport.themeColor`가 미디어 배열이라 meta 태그가 **두 개** 나온다
 * (light 조건 / dark 조건). 첫 번째만 고치면 사용자가 시스템과 반대 테마를
 * 골랐을 때 브라우저는 여전히 반대편 태그를 적용한다 — 즉 이 함수가 존재하는
 * 이유였던 케이스가 그대로 깨져 있게 된다. 선택된 테마에서는 두 태그가 같은
 * 색을 가리켜야 하므로 전부 덮어쓴다.
 */
function syncThemeColorMeta(next: ResolvedTheme): void {
    const themeColor = next === 'light' ? '#f7f8fa' : '#09090b';
    document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach(meta => meta.setAttribute('content', themeColor));
}

/**
 * DOM 반영. `colorScheme`을 같이 세팅해야 네이티브 스크롤바·폼 컨트롤·
 * 날짜 피커가 테마를 따라간다(CSS 변수만으로는 브라우저 크롬이 안 바뀐다).
 *
 * `theme-color` meta도 함께 갱신한다 — 근거는 [[syncThemeColorMeta]].
 */
function applyTheme(next: ResolvedTheme) {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, next);
    root.style.colorScheme = next;
    /* `viewport.themeColor`가 미디어 배열이라 meta 태그가 **두 개** 나온다
       (light 조건 / dark 조건). 첫 번째만 고치면 사용자가 시스템과 반대
       테마를 골랐을 때 브라우저는 여전히 반대편 태그를 적용한다 — 즉 이
       함수가 존재하는 이유였던 케이스가 그대로 깨져 있게 된다.
       선택된 테마에서는 두 태그가 같은 색을 가리켜야 하므로 전부 덮어쓴다. */
    syncThemeColorMeta(next);
    /* 차트는 CSS 변수를 못 읽으므로 JS로 색을 갈아끼워야 한다. 리스너를 등록한
       차트 인스턴스들이 이 이벤트를 받아 applyOptions를 호출한다. */
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
}
