'use client';

/**
 * 탭이 숨겨져 있던 시간을 재는 훅 — 폴링 상한을 "보이는 시간"으로 세기 위해 쓴다.
 */
import { useEffect, useRef } from 'react';

function isDocumentHidden(): boolean {
    return document.visibilityState === 'hidden';
}

/**
 * `resetKey`가 바뀐 시점부터 지금까지 탭이 숨겨져 있던 누적 시간(ms)을 돌려주는 getter를 반환한다.
 *
 * 폴러는 숨은 탭에서 멈추지만 경과 시간은 벽시계로 흐른다. 탭을 오래 숨겼다 돌아오면 그
 * 시간까지 상한에 합쳐져 대기가 즉시 실패하므로, 호출부가 `경과 - 숨은 시간`을 판정에 쓴다.
 * 폴링이 다시 시작될 때(카테고리·재시도)는 `resetKey`를 바꿔 이전 숨김 시간을 기준선으로 뺀다.
 */
export function useHiddenDuration(resetKey: string): () => number {
    const hiddenTotalRef = useRef(0);
    const hiddenSinceRef = useRef<number | null>(null);
    const baselineRef = useRef(0);
    const readTotalRef = useRef<() => number>(() => 0);

    useEffect(() => {
        const readTotal = (): number =>
            hiddenTotalRef.current +
            (hiddenSinceRef.current === null
                ? 0
                : Date.now() - hiddenSinceRef.current);
        readTotalRef.current = readTotal;

        const onVisibilityChange = (): void => {
            if (isDocumentHidden()) {
                if (hiddenSinceRef.current === null) {
                    hiddenSinceRef.current = Date.now();
                }
                return;
            }
            hiddenTotalRef.current = readTotal();
            hiddenSinceRef.current = null;
        };

        if (isDocumentHidden()) hiddenSinceRef.current = Date.now();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () =>
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange
            );
    }, []);

    useEffect(() => {
        baselineRef.current = readTotalRef.current();
    }, [resetKey]);

    return () => readTotalRef.current() - baselineRef.current;
}
