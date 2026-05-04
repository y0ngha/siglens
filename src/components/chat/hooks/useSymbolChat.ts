'use client';

import { useContext, useEffect } from 'react';
import {
    SymbolChatContext,
    type SymbolChatContextValue,
    type SymbolChatState,
} from '@/components/chat/SymbolChatContext';

export type { SymbolChatState };

export function useSymbolChat(): SymbolChatContextValue {
    const ctx = useContext(SymbolChatContext);
    if (!ctx)
        throw new Error('useSymbolChat must be used inside SymbolChatProvider');
    return ctx;
}

/**
 * Page-level publish helper. Each page (chart / fundamental / news / overall)
 * calls this once its analysis result is available.
 *
 * `publish` runs whenever `state` changes; `clear` is split into a separate
 * unmount-only effect so that intra-page state transitions (e.g. analysis
 * loading → done) do not flicker through `null` between publishes.
 */
export function usePublishSymbolChat(state: SymbolChatState): void {
    const { publish, clear } = useSymbolChat();
    useEffect(() => {
        publish(state);
    }, [state, publish]);
    useEffect(() => {
        return () => {
            clear();
        };
    }, [clear]);
}
