'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_THEME,
    resolveTheme,
    THEME_STORAGE_KEY,
    type ResolvedTheme,
    type ThemePreference,
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

    useEffect(() => {
        const current = document.documentElement.getAttribute('data-theme');
        if (current === 'light' || current === 'dark') setThemeState(current);
    }, []);

    /**
     * 시스템 선호도 변경 추적. 사용자가 명시적으로 고른 상태(localStorage에
     * 값이 있음)에서는 OS 변경을 따라가지 않는다 — 명시적 선택이 우선이다.
     */
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = (e: MediaQueryListEvent) => {
            let stored: string | null = null;
            try {
                stored = localStorage.getItem(THEME_STORAGE_KEY);
            } catch {
                // Safari 프라이빗 모드 등 — 저장된 선택이 없는 것으로 본다.
            }
            if (stored === 'light' || stored === 'dark') return;
            const next: ResolvedTheme = e.matches ? 'light' : 'dark';
            applyTheme(next);
            setThemeState(next);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const setTheme = useCallback((preference: ThemePreference) => {
        const prefersLight = window.matchMedia(
            '(prefers-color-scheme: light)'
        ).matches;
        const next = resolveTheme(preference, prefersLight);
        try {
            if (preference === 'system')
                localStorage.removeItem(THEME_STORAGE_KEY);
            else localStorage.setItem(THEME_STORAGE_KEY, preference);
        } catch {
            // 저장이 막혀도 이번 세션 적용은 되어야 한다.
        }
        applyTheme(next);
        setThemeState(next);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(
            document.documentElement.getAttribute('data-theme') === 'light'
                ? 'dark'
                : 'light'
        );
    }, [setTheme]);

    return { theme, setTheme, toggleTheme };
}

/**
 * DOM 반영. `colorScheme`을 같이 세팅해야 네이티브 스크롤바·폼 컨트롤·
 * 날짜 피커가 테마를 따라간다(CSS 변수만으로는 브라우저 크롬이 안 바뀐다).
 *
 * `theme-color` meta도 함께 갱신한다. `viewport` export는 미디어 쿼리 배열이라
 * 시스템 선호도만 따르는데, 사용자가 명시적으로 반대 테마를 골랐을 때
 * 모바일 브라우저 상단 바가 페이지와 어긋나기 때문이다.
 */
function applyTheme(next: ResolvedTheme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    /* `viewport.themeColor`가 미디어 배열이라 meta 태그가 **두 개** 나온다
       (light 조건 / dark 조건). 첫 번째만 고치면 사용자가 시스템과 반대
       테마를 골랐을 때 브라우저는 여전히 반대편 태그를 적용한다 — 즉 이
       함수가 존재하는 이유였던 케이스가 그대로 깨져 있게 된다.
       선택된 테마에서는 두 태그가 같은 색을 가리켜야 하므로 전부 덮어쓴다. */
    const themeColor = next === 'light' ? '#f7f8fa' : '#09090b';
    document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach(meta => meta.setAttribute('content', themeColor));
    /* 차트는 CSS 변수를 못 읽으므로 JS로 색을 갈아끼워야 한다. 리스너를 등록한
       차트 인스턴스들이 이 이벤트를 받아 applyOptions를 호출한다. */
    window.dispatchEvent(
        new CustomEvent('siglens:themechange', { detail: next })
    );
}
