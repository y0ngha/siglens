'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
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
interface SymbolChatState {
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

interface SymbolChatContextValue extends SymbolChatState {
    publish: (next: SymbolChatState) => void;
    clear: () => void;
}

const SymbolChatContext = createContext<SymbolChatContextValue | null>(null);

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

    return (
        <SymbolChatContext.Provider value={value}>
            {children}
        </SymbolChatContext.Provider>
    );
}

export function useSymbolChat(): SymbolChatContextValue {
    const ctx = useContext(SymbolChatContext);
    if (!ctx)
        throw new Error('useSymbolChat must be used inside SymbolChatProvider');
    return ctx;
}

/**
 * Page-level publish helper. Each page (chart / fundamental / news / overall)
 * calls this once its analysis result is available. The cleanup clears the
 * context on unmount so a stale payload from the previous page doesn't leak
 * across navigations.
 */
export function usePublishSymbolChat(state: SymbolChatState): void {
    const { publish, clear } = useSymbolChat();
    useEffect(() => {
        publish(state);
        return () => {
            clear();
        };
    }, [state, publish, clear]);
}
