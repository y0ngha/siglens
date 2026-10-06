'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 미디어 쿼리 일치 여부. 서버 렌더와 하이드레이션 렌더는 항상 `false`이고, 마운트 뒤
 * 실제 값으로 맞춘다 — 그래서 "맞을 때만 그리는" 요소는 SSR HTML에 없고 하이드레이션
 * 불일치도 없다. `matchMedia`가 없는 환경(일부 웹뷰·테스트)은 `false`로 본다.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void): (() => void) => {
            const list = window.matchMedia?.(query);
            if (!list) return () => {};
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query]
    );
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia?.(query).matches ?? false,
        () => false
    );
}
