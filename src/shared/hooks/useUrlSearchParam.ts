'use client';

import { useState, useSyncExternalStore } from 'react';

/**
 * `popstate`(뒤로/앞으로)가 몇 번 일어났는가. 모듈 하나가 창 하나를 나타내므로 전역이다.
 *
 * 구독자가 하나라도 있을 때만 리스너가 붙어 있고, 카운터는 그 리스너가 올린다 —
 * 구독자마다 리스너를 따로 달면 한 번의 `popstate`에 카운터가 구독자 수만큼 오른다.
 */
let popstateCount = 0;
const listeners = new Set<() => void>();

function handlePopstate(): void {
    popstateCount += 1;
    listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
    if (listeners.size === 0) {
        window.addEventListener('popstate', handlePopstate);
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            window.removeEventListener('popstate', handlePopstate);
        }
    };
}

function getServerParamSnapshot(): null {
    return null;
}

/**
 * 지금까지의 `popstate` 횟수. 선택을 저장할 때(이벤트 핸들러 시점)와 구독 스냅샷이 같은 값을
 * 읽는다. 구독자가 몇이든 한 번의 `popstate`에 1만 오른다(테스트가 고정한다).
 */
export function readPopstateCount(): number {
    return popstateCount;
}

function getServerPopstateCountSnapshot(): number {
    return 0;
}

/**
 * URL 쿼리 파라미터 하나를 읽는다 — `useSearchParams` 대체.
 *
 * WHY: Next의 `useSearchParams`는 정적(ISR) 라우트에서 가장 가까운 Suspense 경계까지
 * 서브트리를 **CSR bailout**시킨다. 그래서 차트 탭·`/market` 섹터 패널·종합 탭이 서버
 * HTML에 스켈레톤만 남기고, 하이드레이션 뒤에야 처음 그려졌다(LCP·CLS 손해). 이 훅은
 * `useSyncExternalStore`로 읽고 **서버 스냅샷을 `null`**로 둔다 — 서버와 하이드레이션
 * 렌더는 "파라미터 없음"(= 기본값)으로 같은 HTML을 만들고, 하이드레이션 직후 React가
 * 실제 URL 값으로 다시 렌더한다. 정적 HTML은 모든 방문자에게 같으므로 ISR도 유지된다.
 *
 * 구독은 `popstate`(뒤로/앞으로)만 한다. `history.replaceState`/`pushState`는 이벤트가
 * 없다 — 사용자가 고른 값은 호출부가 로컬 상태(`usePickUntilPopstate`)로 들고 URL보다
 * 우선하므로, URL 쓰기를 따로 알릴 필요가 없다. 리렌더 때마다 스냅샷을 다시 읽으므로
 * 다른 이유로 렌더되면 최신 URL이 반영된다.
 */
export function useUrlSearchParam(name: string): string | null {
    return useSyncExternalStore(
        subscribe,
        () => new URLSearchParams(window.location.search).get(name),
        getServerParamSnapshot
    );
}

/**
 * URL보다 우선하는 "사용자가 고른 값" — 다음 `popstate`가 오면 자동으로 무효가 된다.
 *
 * WHY: 사용자의 선택은 `history.replaceState`로 URL에도 쓰지만 그 쓰기는 구독자에게
 * 알려지지 않으므로, 선택 자체를 로컬 상태로 들고 URL 값보다 앞세운다. 그런데 그
 * 상태를 영원히 앞세우면 뒤로/앞으로 가기가 화면을 못 바꾼다(URL은 바뀌었는데 화면은
 * 마지막 선택에 머문다). 그래서 선택에 "그때의 `popstate` 횟수"를 함께 저장하고, 횟수가
 * 달라지면 렌더 중에 무효로 본다 — effect에서 `setState(null)`로 지우지 않으므로
 * 지워지기 전 한 프레임 동안 낡은 선택이 보이는 일도 없다.
 *
 * @returns `[현재 유효한 선택(없으면 null), 선택 setter]`
 */
export function usePickUntilPopstate<T>(): [T | null, (value: T) => void] {
    const [pick, setPick] = useState<{ value: T; at: number } | null>(null);
    const currentPopstateCount = useSyncExternalStore(
        subscribe,
        readPopstateCount,
        getServerPopstateCountSnapshot
    );
    const activePick =
        pick !== null && pick.at === currentPopstateCount ? pick.value : null;
    // setter는 이벤트 핸들러에서 불린다 — 그 시점의 전역 카운터를 함께 저장한다.
    const choose = (value: T): void =>
        setPick({ value, at: readPopstateCount() });
    return [activePick, choose];
}
