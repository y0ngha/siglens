'use client';

import { useEffect } from 'react';

function subscribeHistoryRestore(onRestore: () => void): () => void {
    // bfcache 복원은 `persisted`인 pageshow로만 구분된다 — 첫 로드의 pageshow는 무시한다.
    const handlePageShow = (event: PageTransitionEvent): void => {
        if (event.persisted) onRestore();
    };
    const handlePopState = (): void => onRestore();
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('pageshow', handlePageShow);
        window.removeEventListener('popstate', handlePopState);
    };
}

/**
 * 뒤로가기로 회원가입 화면에 돌아오면 `onRestore`를 부른다. 두 경로를 함께 본다:
 * 브라우저 bfcache 복원(`pageshow` + `persisted`)과, Next.js router cache가
 * 컴포넌트를 메모리에 둔 채 일어나는 뒤로가기(`popstate`). 어느 쪽이든 이전
 * 단계의 액션 상태가 그대로 남아 있으므로 소비자가 1단계로 되돌린다.
 */
export function useRestartOnHistoryRestore(onRestore: () => void): void {
    useEffect(() => subscribeHistoryRestore(onRestore), [onRestore]);
}
