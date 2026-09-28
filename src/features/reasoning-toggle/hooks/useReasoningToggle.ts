'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useState,
} from 'react';
import { LOCAL_STORAGE_REASONING_KEY } from '@/shared/lib/storageKeys';

/**
 * 저장된 토글 값을 읽는다. 저장소 접근이 막힌 브라우저(시크릿 모드·Safari 사생활
 * 보호 등)는 `localStorage` 접근에서 `SecurityError`를 던진다 — 마운트 effect에서
 * 던지면 트리가 죽으므로 기본값(`null` → OFF)으로 취급한다.
 */
function readStoredReasoning(): string | null {
    try {
        return localStorage.getItem(LOCAL_STORAGE_REASONING_KEY);
    } catch {
        return null;
    }
}

/**
 * Member "깊은 생각" (deep-thinking / reasoning) toggle state — persisted to
 * localStorage (member-reasoning-toggle spec Part A.2). Mirrors
 * `useSelectedModel`'s hydration pattern: SSR/first paint always renders the
 * default (`false`), then a `useEffect` reads the stored value so hydration
 * never mismatches server output.
 *
 * The *effective* value actually sent to the server is still tier-gated
 * elsewhere (`SymbolModelContext`/server `resolveReasoning`) — this hook only
 * tracks the member's raw persisted preference.
 *
 * @returns `[reasoning, setReasoning, isHydrated]`
 */
export function useReasoningToggle(): [
    boolean,
    (value: boolean) => void,
    boolean,
] {
    const [reasoning, setReasoningState] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const setReasoning = useCallback((value: boolean): void => {
        // SSR 가드 — jsdom에는 항상 window가 있어 단위 테스트로 실행할 수 없다.
        /* v8 ignore next */
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(
                    LOCAL_STORAGE_REASONING_KEY,
                    String(value)
                );
            } catch {
                // 저장소 차단(시크릿 모드·Safari 사생활 보호 등)은 `SecurityError`를
                // 던진다. 영속만 포기하고 이번 세션의 토글은 그대로 반영한다.
            }
        }
        setReasoningState(value);
    }, []);

    const readFromStorage = useEffectEvent((): void => {
        // SSR 가드 — 위와 같은 이유로 jsdom에서는 도달할 수 없다.
        /* v8 ignore next */
        if (typeof window === 'undefined') return;
        const stored = readStoredReasoning();
        startTransition(() => {
            setReasoningState(stored === 'true');
            setIsHydrated(true);
        });
    });

    useEffect(() => {
        readFromStorage();
    }, []);

    return [reasoning, setReasoning, isHydrated];
}
