'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    PREFERS_LIGHT_QUERY,
    readThemePreference,
    resolveTheme,
    THEME_STORAGE_KEY,
    THEME_ATTRIBUTE,
    type ResolvedTheme,
    type ThemePreference,
    THEME_CHANGE_EVENT,
} from '@/shared/lib/theme';

export interface UseThemeResult {
    /**
     * 사용자가 **고른 것**. 적용된 테마가 아니다.
     *
     * 둘은 같지 않다 — `system`을 고른 사용자와 `dark`를 고른 사용자는 OS가
     * 다크일 때 화면이 완전히 동일하다. `<html data-theme>`만 봐서는 구분되지
     * 않으므로 메뉴는 이 값으로 현재 선택을 표시한다.
     *
     * 적용된 테마가 필요한 소비자는 없다. 화면은 CSS가, 차트는
     * [[useThemeVersion]]이 이미 처리한다 — 그래서 반환하지 않는다.
     */
    readonly preference: ThemePreference;
    readonly setTheme: (next: ThemePreference) => void;
}

/**
 * 테마 선택 읽기/쓰기 훅.
 *
 * **프로바이더가 없다.** 전역 컨텍스트를 두면 루트 레이아웃이 클라이언트
 * 경계가 되고, 이 코드베이스에는 deep-tree 컨텍스트 등록이 렌더 폭풍을
 * 일으킨 전례가 있다. 대신 각 소비자가 이 훅으로 `<html>` 속성과
 * `localStorage`를 직접 읽고 쓴다 — 진실의 원천이 그 둘이라 동기화할 상태가 없다.
 *
 * 첫 렌더는 항상 `system`을 반환한다. 인라인 스크립트가 이미 화면을 올바르게
 * 칠해놨지만, 서버 HTML과 다른 값을 첫 렌더에서 뱉으면 하이드레이션 불일치가
 * 난다. 실제 선택은 `useEffect`에서 한 박자 뒤에 채워진다.
 */
export function useTheme(): UseThemeResult {
    const [preference, setPreferenceState] =
        useState<ThemePreference>('system');

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
        setPreferenceState(next);
    }, []);

    useEffect(() => {
        const current = document.documentElement.getAttribute(THEME_ATTRIBUTE);
        if (current === 'light' || current === 'dark') {
            /* 마운트 때 한 번 meta를 맞춘다. `applyTheme`가 meta를 덮어쓰는 것은
               **선택을 바꿀 때뿐**이라, 저장된 선택으로 페이지를 열면 로드
               직후에는 어긋난 채였다. 근거는 [[syncThemeColorMeta]]. */
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
            applyTheme(e.matches ? 'light' : 'dark');
        };
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [preference]);

    return { preference, setTheme };
}

/**
 * `theme-color` meta를 적용 테마에 맞춘다.
 *
 * `viewport.themeColor`가 미디어 배열이라 meta 태그가 **두 개** 나온다
 * (light 조건 / dark 조건). 그 태그들은 언제나 **OS**를 따르는데 적용 테마는
 * 저장된 선택이 이기므로, OS와 반대를 고른 사용자는 페이지는 다크인데 모바일
 * 브라우저 상단 바만 밝은 상태가 된다(실측: 저장값 `dark` + OS light에서
 * themeColor가 `#f7f8fa`). 첫 번째 태그만 고치면 브라우저가 여전히 반대편
 * 태그를 적용하므로 **전부** 덮어쓴다.
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
function applyTheme(next: ResolvedTheme): void {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, next);
    root.style.colorScheme = next;
    syncThemeColorMeta(next);
    /* 차트는 CSS 변수를 못 읽으므로 JS로 색을 갈아끼워야 한다. 리스너를 등록한
       차트 인스턴스들이 이 이벤트를 받아 applyOptions를 호출한다. */
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
}
