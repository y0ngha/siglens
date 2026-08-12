'use client';

import {
    createContext,
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import type { CurrentAnalysisContext, Timeframe } from '@y0ngha/siglens-core';

/**
 * Layout-scoped chat context — each of the 4 symbol pages publishes its in-view
 * analysis result here so the layout-mounted FloatingChatButton can render a chat
 * panel that survives navigation. The `context` field is core's tagged union
 * `CurrentAnalysisContext`, so the chat layer can distinguish technical /
 * fundamental / news / overall payloads and forward the right one to core's
 * `requestChatCompletion`.
 *
 * On a page that hasn't published yet (analysis still loading, or page has no
 * AI summary), `context` stays `null`; the chat input is disabled via
 * `isAnalysisReady=false` and the panel still renders previously persisted
 * messages from localStorage.
 */
export interface SymbolChatState {
    /** In-view analysis result tagged by page kind. `null` until publish. */
    context: CurrentAnalysisContext | null;
    /**
     * Chart timeframe — set by the chart page. Other pages publish `null`
     * because timeframe is a chart-only concept; the launcher falls back to
     * `DEFAULT_TIMEFRAME` so the chat panel always has a timeframe to forward
     * to core (core's `requestChatCompletion` requires one).
     */
    timeframe: Timeframe | null;
    isAnalysisReady: boolean;
}

export interface SymbolChatContextValue extends SymbolChatState {
    publish: (next: SymbolChatState) => void;
    clear: () => void;
}

/**
 * Dispatch-only half of the chat context (`{ publish, clear }`).
 *
 * **Split on purpose.** `usePublishSymbolChat` writes into this context; if it
 * also *subscribed* to the state half it would re-render on its own write, and
 * the analysis hooks return a fresh state object every render — so the memoized
 * chat state gets a new identity, the `===` dedupe in `publish` misses, and the
 * publisher loops until React throws "Maximum update depth exceeded"
 * (reproduced: 400+ renders with the real provider before this split).
 *
 * Both values here are `useCallback`-stable for the provider's lifetime, so
 * this context never changes identity and publishers never re-render because of
 * a publish.
 */
export const SymbolChatDispatchContext =
    createContext<SymbolChatDispatch | null>(null);

/** Publisher-facing API — stable for the provider's lifetime. */
export interface SymbolChatDispatch {
    publish: (next: SymbolChatState) => void;
    clear: () => void;
}

export const SymbolChatContext = createContext<SymbolChatContextValue | null>(
    null
);

interface SymbolChatProviderProps {
    children: ReactNode;
}

export function SymbolChatProvider({ children }: SymbolChatProviderProps) {
    const [state, setState] = useState<SymbolChatState>({
        context: null,
        timeframe: null,
        isAnalysisReady: false,
    });

    const publish = useCallback((next: SymbolChatState) => {
        setState(prev => {
            if (
                prev.context === next.context &&
                prev.timeframe === next.timeframe &&
                prev.isAnalysisReady === next.isAnalysisReady
            ) {
                return prev;
            }
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setState(prev => {
            if (
                prev.context === null &&
                prev.timeframe === null &&
                !prev.isAnalysisReady
            ) {
                return prev;
            }
            return { context: null, timeframe: null, isAnalysisReady: false };
        });
    }, []);

    const value = useMemo(
        () => ({ ...state, publish, clear }),
        [state, publish, clear]
    );

    // `publish`/`clear`는 useCallback으로 고정돼 있으므로 이 객체는 provider가
    // 사는 동안 identity가 바뀌지 않는다 — publisher가 publish 때문에 재렌더되지
    // 않게 하는 핵심.
    const dispatch = useMemo(() => ({ publish, clear }), [publish, clear]);

    return (
        <SymbolChatDispatchContext.Provider value={dispatch}>
            <SymbolChatContext.Provider value={value}>
                {children}
            </SymbolChatContext.Provider>
        </SymbolChatDispatchContext.Provider>
    );
}
