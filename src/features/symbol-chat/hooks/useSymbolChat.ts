'use client';

import { useContext, useEffect } from 'react';
import {
    SymbolChatContext,
    SymbolChatDispatchContext,
    type SymbolChatContextValue,
    type SymbolChatDispatch,
    type SymbolChatState,
} from '../model/SymbolChatContext';

export type { SymbolChatState };

export function useSymbolChat(): SymbolChatContextValue {
    const ctx = useContext(SymbolChatContext);
    if (!ctx)
        throw new Error('useSymbolChat must be used inside SymbolChatProvider');
    return ctx;
}

/** Publisher-facing accessor — deliberately does NOT subscribe to chat state. */
export function useSymbolChatDispatch(): SymbolChatDispatch {
    const ctx = useContext(SymbolChatDispatchContext);
    if (!ctx)
        throw new Error(
            'useSymbolChatDispatch must be used inside SymbolChatProvider'
        );
    return ctx;
}

/**
 * Page-level publish helper. Each page (chart / fundamental / news / overall)
 * calls this once its analysis result is available.
 *
 * `publish` runs whenever `state` changes; `clear` is split into a separate
 * unmount-only effect so that intra-page state transitions (e.g. analysis
 * loading → done) do not flicker through `null` between publishes.
 *
 * Reads the **dispatch-only** context on purpose. Subscribing to the state half
 * here would make every publisher re-render on its own publish; since the
 * analysis hooks return a fresh object each render, the published state would
 * get a new identity, the `===` dedupe in `publish` would miss, and the
 * publisher would loop until React aborts with "Maximum update depth exceeded".
 */
export function usePublishSymbolChat(state: SymbolChatState): void {
    const { publish, clear } = useSymbolChatDispatch();
    useEffect(() => {
        publish(state);
    }, [state, publish]);
    useEffect(() => {
        return () => {
            clear();
        };
    }, [clear]);
}
