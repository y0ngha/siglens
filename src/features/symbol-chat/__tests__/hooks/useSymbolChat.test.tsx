import { renderHook } from '@testing-library/react';
import {
    useSymbolChat,
    usePublishSymbolChat,
} from '@/features/symbol-chat/hooks/useSymbolChat';
import {
    SymbolChatContext,
    type SymbolChatContextValue,
    type SymbolChatState,
} from '@/features/symbol-chat/model/SymbolChatContext';
import { createElement, type ReactNode } from 'react';

const INITIAL_STATE: SymbolChatState = {
    context: null,
    timeframe: null,
    isAnalysisReady: false,
};

function createWrapper(value: SymbolChatContextValue) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return createElement(SymbolChatContext.Provider, { value }, children);
    };
}

describe('useSymbolChat', () => {
    it('throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useSymbolChat());
        }).toThrow('useSymbolChat must be used inside SymbolChatProvider');
    });

    it('returns context value when used inside provider', () => {
        const mockValue: SymbolChatContextValue = {
            ...INITIAL_STATE,
            publish: vi.fn(),
            clear: vi.fn(),
        };
        const { result } = renderHook(() => useSymbolChat(), {
            wrapper: createWrapper(mockValue),
        });
        expect(result.current).toBe(mockValue);
    });
});

describe('usePublishSymbolChat', () => {
    it('calls publish with the provided state on mount', () => {
        const publish = vi.fn();
        const clear = vi.fn();
        const contextValue: SymbolChatContextValue = {
            ...INITIAL_STATE,
            publish,
            clear,
        };

        const state: SymbolChatState = {
            context: null,
            timeframe: null,
            isAnalysisReady: true,
        };

        renderHook(() => usePublishSymbolChat(state), {
            wrapper: createWrapper(contextValue),
        });

        expect(publish).toHaveBeenCalledWith(state);
    });

    it('calls clear on unmount', () => {
        const publish = vi.fn();
        const clear = vi.fn();
        const contextValue: SymbolChatContextValue = {
            ...INITIAL_STATE,
            publish,
            clear,
        };

        const state: SymbolChatState = {
            context: null,
            timeframe: null,
            isAnalysisReady: true,
        };

        const { unmount } = renderHook(() => usePublishSymbolChat(state), {
            wrapper: createWrapper(contextValue),
        });

        unmount();
        expect(clear).toHaveBeenCalled();
    });

    it('calls publish again when state changes', () => {
        const publish = vi.fn();
        const clear = vi.fn();
        const contextValue: SymbolChatContextValue = {
            ...INITIAL_STATE,
            publish,
            clear,
        };

        const state1: SymbolChatState = {
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        };
        const state2: SymbolChatState = {
            context: null,
            timeframe: null,
            isAnalysisReady: true,
        };

        const { rerender } = renderHook(
            ({ state }) => usePublishSymbolChat(state),
            {
                wrapper: createWrapper(contextValue),
                initialProps: { state: state1 },
            }
        );

        expect(publish).toHaveBeenCalledWith(state1);
        publish.mockClear();

        rerender({ state: state2 });
        expect(publish).toHaveBeenCalledWith(state2);
    });
});
