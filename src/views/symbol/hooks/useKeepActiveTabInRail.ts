'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { railScrollLeftFor } from '../utils/tabRailScroll';

interface UseKeepActiveTabInRailResult {
    /** 가로 스크롤 컨테이너(`<nav>`)에 단다. */
    railRef: RefObject<HTMLElement | null>;
    /** 활성 탭 링크에만 단다. */
    activeRef: RefObject<HTMLAnchorElement | null>;
}

/**
 * 경로가 바뀔 때마다 활성 탭을 가로 스크롤 레일 안으로 끌어온다.
 *
 * 탭이 9개라 모바일 폭에서 레일이 넘친다. 그 라우트로 직접 들어온 사용자는 활성 탭이
 * 화면 밖에 있으면 자기가 어느 탭에 있는지 볼 수 없다(`aria-current`는 AT에만 들린다).
 *
 * `scrollIntoView`를 쓰지 않는다 — 그 API는 조상 스크롤 컨테이너까지 함께 움직여 페이지가
 * 세로로 튄다. 레일의 `scrollLeft`만 직접 옮긴다.
 */
export function useKeepActiveTabInRail(
    pathname: string
): UseKeepActiveTabInRailResult {
    const railRef = useRef<HTMLElement>(null);
    const activeRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const rail = railRef.current;
        const active = activeRef.current;
        if (rail === null || active === null) return;
        const next = railScrollLeftFor(
            { left: active.offsetLeft, width: active.offsetWidth },
            { scrollLeft: rail.scrollLeft, clientWidth: rail.clientWidth }
        );
        if (next !== null) rail.scrollLeft = next;
    }, [pathname]);

    return { railRef, activeRef };
}
