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
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_REASONING_KEY, String(value));
        }
        setReasoningState(value);
    }, []);

    const readFromStorage = useEffectEvent((): void => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem(LOCAL_STORAGE_REASONING_KEY);
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
