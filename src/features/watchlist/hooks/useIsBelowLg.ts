'use client';

import { useSyncExternalStore } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';

function subscribe(callback: () => void): () => void {
    const list = window.matchMedia(BELOW_LG_MEDIA_QUERY);
    list.addEventListener('change', callback);
    return () => list.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
    return window.matchMedia(BELOW_LG_MEDIA_QUERY).matches;
}

/** 서버·하이드레이션 렌더에는 뷰포트가 없다 — 그동안은 "모른다"(null)로 둔다. */
function getServerSnapshot(): null {
    return null;
}

/**
 * 뷰포트가 `lg` 미만인가. 홈 카드가 PC 카드 목록과 모바일 행 목록 중 **한쪽만** 그리게 하려고
 * 쓴다 — 둘 다 그리고 CSS로 숨기면 숨은 쪽 카드도 시세를 요청한다(N-symbol 팬아웃).
 * 하이드레이션 전에는 null이라 어느 쪽도 그리지 않는다.
 */
export function useIsBelowLg(): boolean | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
