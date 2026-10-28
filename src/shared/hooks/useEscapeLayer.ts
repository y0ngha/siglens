'use client';

import { useEffect, useEffectEvent } from 'react';

/**
 * 쌓인 Escape 레이어. 마지막 원소가 가장 안쪽(가장 나중에 열린) 레이어다.
 *
 * 모듈 수준에 둔다 — 서로 다른 컴포넌트가 열어 둔 레이어들이 같은 스택을 봐야
 * "가장 안쪽 하나만 닫는다"를 판정할 수 있다.
 */
const layers: Array<() => void> = [];

function handleKeyDown(e: KeyboardEvent): void {
    // 한글 조합 중의 Escape는 IME의 취소 키다 — `useEscapeKey`와 같은 이유로 무시한다.
    if (e.key !== 'Escape' || e.isComposing) return;
    layers.at(-1)?.();
}

function pushLayer(onEscape: () => void): () => void {
    if (layers.length === 0)
        document.addEventListener('keydown', handleKeyDown);
    layers.push(onEscape);
    return () => {
        const at = layers.lastIndexOf(onEscape);
        if (at >= 0) layers.splice(at, 1);
        if (layers.length === 0)
            document.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * 겹쳐 열리는 팝오버·드로어를 위한 Escape 처리. `enabled`인 레이어 중 **가장 나중에
 * 활성화된 하나**만 `onEscape`를 받는다.
 *
 * `useEscapeKey`는 호출마다 독립된 `document` 리스너라, 드로어 안의 언어 팝오버처럼
 * 중첩된 레이어에서는 한 번의 Escape가 둘 다 닫는다. 안쪽이 닫힌 뒤 다시 누를 때
 * 바깥이 닫히도록 하고 싶은 호출부만 이 훅을 쓴다 — 기존 `useEscapeKey` 호출부의
 * 동작은 바뀌지 않는다.
 */
export function useEscapeLayer(onEscape: () => void, enabled: boolean): void {
    const handleEscape = useEffectEvent(onEscape);

    useEffect(() => {
        if (!enabled) return;
        return pushLayer(() => handleEscape());
    }, [enabled]);
}
