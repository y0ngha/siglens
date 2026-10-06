'use client';

import { useSyncExternalStore } from 'react';

/** 구독할 외부 변화가 없다 — "클라이언트인가"는 마운트 동안 바뀌지 않는다. */
function subscribeNoop(): () => void {
    return () => {};
}

function getClientSnapshot(): boolean {
    return true;
}

function getServerSnapshot(): boolean {
    return false;
}

/**
 * SSR→CSR 하이드레이션이 끝났는지 알려 준다.
 *
 * - 서버 렌더와 **하이드레이션 렌더**는 `getServerSnapshot`(false)을 쓴다 — 서버 HTML과
 *   같은 결과라 하이드레이션 불일치가 없다. 하이드레이션 직후 React가 클라이언트
 *   스냅샷(true)과 다르다는 것을 보고 한 번 다시 렌더한다.
 * - 하이드레이션이 아닌 **클라이언트 마운트**(클라이언트 내비게이션으로 새로 생긴
 *   컴포넌트)는 첫 렌더부터 true다.
 *
 * 예전 구현(`useState(false)` + effect에서 `setState(true)`)은 클라이언트 내비게이션
 * 뒤에도 매번 false로 한 번 그린 다음 effect로 true를 다시 그렸다 — 이미 클라이언트인데
 * 렌더가 두 번이고, 그 사이 한 프레임은 게이트된 쿼리·UI가 꺼진 상태로 보였다.
 */
export function useHydrated(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        getClientSnapshot,
        getServerSnapshot
    );
}
