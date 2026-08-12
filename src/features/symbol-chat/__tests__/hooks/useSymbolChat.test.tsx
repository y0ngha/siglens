import { renderHook } from '@testing-library/react';
import {
    useSymbolChat,
    usePublishSymbolChat,
} from '@/features/symbol-chat/hooks/useSymbolChat';
import {
    SymbolChatContext,
    SymbolChatDispatchContext,
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

/**
 * `usePublishSymbolChat`은 state 절반을 **구독하지 않는다** — dispatch 전용
 * 컨텍스트만 읽는다(publish로 자기 자신을 재렌더시키면 렌더 루프가 된다).
 * 그래서 publisher 테스트는 두 Provider를 모두 감싸야 한다.
 */
function createPublisherWrapper(value: SymbolChatContextValue) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return createElement(
            SymbolChatDispatchContext.Provider,
            { value: { publish: value.publish, clear: value.clear } },
            createElement(SymbolChatContext.Provider, { value }, children)
        );
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
            wrapper: createPublisherWrapper(contextValue),
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
            wrapper: createPublisherWrapper(contextValue),
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
                wrapper: createPublisherWrapper(contextValue),
                initialProps: { state: state1 },
            }
        );

        expect(publish).toHaveBeenCalledWith(state1);
        publish.mockClear();

        rerender({ state: state2 });
        expect(publish).toHaveBeenCalledWith(state2);
    });
});
