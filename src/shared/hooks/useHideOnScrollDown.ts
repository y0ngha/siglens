'use client';

import { useSyncExternalStore } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';

/** 크롬이 뒤집히기 전에 한 방향으로 움직여야 하는 픽셀 — 떨림을 무시한다. */
const SCROLL_DIRECTION_THRESHOLD_PX = 8;
/** 페이지 맨 위 근처에서는 크롬을 항상 보여 준다. */
const ALWAYS_VISIBLE_TOP_PX = 56;
/**
 * 마지막 터치·휠·키 입력 뒤 이 시간 안의 스크롤만 사용자 스크롤로 본다.
 * 손가락을 뗀 뒤 이어지는 iOS 관성 스크롤(≈1–1.5초)을 덮는다.
 */
const USER_SCROLL_WINDOW_MS = 1_500;
const USER_INPUT_EVENTS = [
    'touchstart',
    'touchmove',
    'wheel',
    'keydown',
] as const;

interface ScrollChromeState {
    readonly hidden: boolean;
    readonly belowLg: boolean;
}

const INITIAL_STATE: ScrollChromeState = { hidden: false, belowLg: false };

let state: ScrollChromeState = INITIAL_STATE;
const listeners = new Set<() => void>();
let stopListening: (() => void) | null = null;

function update(next: Partial<ScrollChromeState>): void {
    const merged = { ...state, ...next };
    if (merged.hidden === state.hidden && merged.belowLg === state.belowLg)
        return;
    state = merged;
    for (const listener of listeners) listener();
}

/** 모든 구독자를 위해 window 리스너를 한 번만 단다. */
function startListening(): () => void {
    // `lg` 경계여야 한다 — 호출부가 크롬을 숨기는 경계(`Header.tsx`의
    // `max-lg:-translate-y-full`, `ChatShell.tsx`의 `lg:hidden` 바)와 같아야 하기 때문이다.
    // 호출부는 `true`일 때 요소 전체에 `inert`를 거는데, `inert`는 미디어 쿼리로 범위를
    // 좁힐 수 없다. 데스크톱에서 "숨김"을 보고하면 멀쩡히 보이는 헤더가 조용히 먹통이
    // 된다. `MOBILE_VIEWPORT_MEDIA_QUERY`(md 768px)가 아닌 이유도 같다.
    const mediaQueryList = window.matchMedia(BELOW_LG_MEDIA_QUERY);
    const syncBreakpoint = () => update({ belowLg: mediaQueryList.matches });
    syncBreakpoint();
    mediaQueryList.addEventListener('change', syncBreakpoint);

    let anchorY = window.scrollY;
    let frame = 0;
    let scheduled = false;
    let lastUserInputAt = Number.NEGATIVE_INFINITY;
    const markUserInput = () => {
        lastUserInputAt = performance.now();
    };
    const evaluate = () => {
        scheduled = false;
        const y = window.scrollY;
        if (y < ALWAYS_VISIBLE_TOP_PX) {
            update({ hidden: false });
            anchorY = y;
            return;
        }
        if (performance.now() - lastUserInputAt > USER_SCROLL_WINDOW_MS) {
            // 프로그램이 일으킨 스크롤(스트리밍 중 자동 고정)은 상태를 바꾸지 않고
            // 따라가기만 해서, 다음 사용자 제스처가 여기서부터 거리를 잰다.
            anchorY = y;
            return;
        }
        const delta = y - anchorY;
        if (Math.abs(delta) < SCROLL_DIRECTION_THRESHOLD_PX) return;
        // `inert`가 걸린 요소 안에 포커스가 있으면 포커스가 풀린다. 사용자가 크롬 안의
        // 컨트롤(드로어 트리거, 헤더 링크)을 쓰는 도중에 숨기면 포커스를 빼앗게 되므로,
        // 아래로 스크롤해도 포커스가 크롬 밖에 있을 때만 숨긴다.
        if (
            delta > 0 &&
            document.activeElement?.closest('[data-scroll-chrome]')
        )
            return;
        update({ hidden: delta > 0 });
        anchorY = y;
    };
    const onScroll = () => {
        if (scheduled) return;
        scheduled = true;
        frame = requestAnimationFrame(evaluate);
    };
    for (const type of USER_INPUT_EVENTS)
        window.addEventListener(type, markUserInput, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
        mediaQueryList.removeEventListener('change', syncBreakpoint);
        for (const type of USER_INPUT_EVENTS)
            window.removeEventListener(type, markUserInput);
        window.removeEventListener('scroll', onScroll);
        if (scheduled) cancelAnimationFrame(frame);
    };
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    stopListening ??= startListening();
    return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || stopListening === null) return;
        stopListening();
        stopListening = null;
        state = INITIAL_STATE;
    };
}

// 리스너를 무시한다: 비활성 호출부는 window를 구독하지 않는다.
const subscribeNothing =
    (_onStoreChange: () => void): (() => void) =>
    () => {};
const getSnapshot = (): ScrollChromeState => state;
const getServerSnapshot = (): ScrollChromeState => INITIAL_STATE;

/**
 * 창이 아래로 스크롤되는 동안 `true`, 다시 위로 스크롤하거나 맨 위 근처면 `false`.
 * "내려갈 때 헤더를 숨기고 올릴 때 되돌린다" — 폰에서는 대화에 높이를 내주되 살짝
 * 위로 튕기면 내비게이션이 다시 나타난다.
 *
 * 창 스크롤만 본다: 채팅 대화록이 페이지를 키우고 입력창이 `sticky bottom-0`이라
 * 스크롤되는 것은 문서다.
 *
 * 사용자 입력에 이어진 스크롤만 상태를 뒤집는다. 대화록은 토큰이 스트리밍될 때마다
 * `scrollIntoView`로 맨 아래에 붙는데 이것도 창을 움직이므로, 이를 "아래로 스크롤"로
 * 세면 답변마다 헤더가 사라진다.
 *
 * `lg` 이상에서는 항상 `false` — `BELOW_LG_MEDIA_QUERY` 참고.
 *
 * **모든 호출부가 상태 하나를 공유한다.** 사이트 헤더(ai 레이아웃)와 ChatShell의
 * 대화 바는 함께 움직여야 하는데 마운트 시점이 다르다: 대화를 바꿀 때마다 ChatShell은
 * 다시 마운트되지만 헤더는 그대로다. 인스턴스별 상태면 새 바가 "보임"으로 시작해 아직
 * "숨김"인 헤더 아래에서 위에 아무것도 없이 대화록 위에 떠 있게 된다. 모듈 수준 스토어를
 * `useSyncExternalStore`로 읽으면 늦게 구독한 쪽도 현재 값을 받는다.
 */
export function useHideOnScrollDown({
    enabled = true,
}: { enabled?: boolean } = {}): boolean {
    const { hidden, belowLg } = useSyncExternalStore(
        // A disabled caller (the main-host header) attaches no listeners.
        enabled ? subscribe : subscribeNothing,
        enabled ? getSnapshot : getServerSnapshot,
        getServerSnapshot
    );
    return enabled && hidden && belowLg;
}
