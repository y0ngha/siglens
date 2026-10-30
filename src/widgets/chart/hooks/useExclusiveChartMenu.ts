'use client';

/**
 * 차트 헤더 팝오버 메뉴를 한 번에 하나만 열리게 하는 열림 상태 훅.
 */

import { useCallback, useState } from 'react';

/** 차트 헤더 띠의 팝오버 메뉴 id — 한 번에 하나만 열린다. */
export type ChartMenuId = 'indicators' | 'overlays' | 'settings';

const NO_UNAVAILABLE_MENUS: ReadonlySet<ChartMenuId> = new Set();

/** 메뉴 하나가 받는 열림 제어 — `useExclusiveChartMenu().bind(id)`가 만든다. */
export interface ChartMenuControl {
    isOpen: boolean;
    toggle: () => void;
    close: () => void;
}

/**
 * 헤더 띠 메뉴 셋(보조지표·차트 작도·차트 설정)의 열림 상태를 한 곳에서 쥔다 — 하나를 열면 나머지는 닫힌다.
 *
 * 갱신은 모두 함수형이다: 다른 메뉴 트리거를 누르면 `pointerdown` 바깥 클릭이 열려 있던 메뉴의 `close`를,
 * 이어 `click`이 새 메뉴의 `toggle`을 부르는데, `close`는 "내가 열려 있을 때만" 비우므로 순서와 무관하게
 * 새 메뉴가 이긴다.
 *
 * `unavailable`에 든 메뉴(내용이 없어 렌더되지 않는 메뉴)가 열려 있으면 렌더 중에 닫는다 — 그대로 두면
 * 열림 상태가 남아, 내용이 다시 생기는 순간 사용자가 누르지 않은 팝오버가 열리고 포커스 트랩이
 * 포커스를 가져간다. effect 대신 렌더 중 상태 조정(React의 "props 변화에 맞춘 state 조정")으로 한다.
 */
export function useExclusiveChartMenu(
    unavailable: ReadonlySet<ChartMenuId> = NO_UNAVAILABLE_MENUS
): {
    bind: (id: ChartMenuId) => ChartMenuControl;
} {
    const [openId, setOpenId] = useState<ChartMenuId | null>(null);
    if (openId !== null && unavailable.has(openId)) setOpenId(null);

    const bind = useCallback(
        (id: ChartMenuId): ChartMenuControl => ({
            isOpen: openId === id,
            toggle: () => setOpenId(prev => (prev === id ? null : id)),
            close: () => setOpenId(prev => (prev === id ? null : prev)),
        }),
        [openId]
    );

    return { bind };
}
