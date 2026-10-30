'use client';

import { useEffect, useEffectEvent } from 'react';

/**
 * `enabled`인 동안 `Escape`를 누르면 `onEscape`를 부른다. IME 조합 중의 `Escape`는 무시한다.
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean): void {
    const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
        // 한글 조합 중의 Escape는 IME의 **취소 키**다. 그대로 닫으면 반쯤 조합한
        // 음절을 물리려던 사용자가 검색창째로 잃는다 — 한국어 입력이 이 오버레이의
        // 주 사용자다. 조합 중이 아닌 Escape만 닫기로 본다.
        if (e.key === 'Escape' && !e.isComposing) onEscape();
    });

    useEffect(() => {
        if (!enabled) return;
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
}
