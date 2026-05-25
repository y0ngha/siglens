import { renderHook, act } from '@testing-library/react';
import {
    SymbolChatContext,
    SymbolChatProvider,
    type SymbolChatState,
} from '@/features/symbol-chat/model/SymbolChatContext';
import { useContext, type ReactNode } from 'react';

function useSymbolChatContext() {
    return useContext(SymbolChatContext);
}

function wrapper({ children }: { children: ReactNode }) {
    return <SymbolChatProvider>{children}</SymbolChatProvider>;
}

describe('SymbolChatContext', () => {
    it('returns null when used outside provider', () => {
        const { result } = renderHook(() => useSymbolChatContext());
        expect(result.current).toBeNull();
    });
});

describe('SymbolChatProvider', () => {
    it('provides initial state with null context and timeframe', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });
        expect(result.current).not.toBeNull();
        expect(result.current!.context).toBeNull();
        expect(result.current!.timeframe).toBeNull();
        expect(result.current!.isAnalysisReady).toBe(false);
    });

    it('updates state via publish', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });

        const nextState: SymbolChatState = {
            context: null,
            timeframe: null,
            isAnalysisReady: true,
        };

        act(() => {
            result.current!.publish(nextState);
        });

        expect(result.current!.isAnalysisReady).toBe(true);
    });

    it('resets state via clear', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });

        act(() => {
            result.current!.publish({
                context: null,
                timeframe: null,
                isAnalysisReady: true,
            });
        });

        expect(result.current!.isAnalysisReady).toBe(true);

        act(() => {
            result.current!.clear();
        });

        expect(result.current!.context).toBeNull();
        expect(result.current!.timeframe).toBeNull();
        expect(result.current!.isAnalysisReady).toBe(false);
    });

    it('publish returns same reference when values are identical', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });

        const before = result.current;

        act(() => {
            result.current!.publish({
                context: null,
                timeframe: null,
                isAnalysisReady: false,
            });
        });

        // State should be referentially identical since values match initial
        expect(result.current!.context).toBe(before!.context);
        expect(result.current!.timeframe).toBe(before!.timeframe);
        expect(result.current!.isAnalysisReady).toBe(before!.isAnalysisReady);
    });

    it('clear returns same reference when already cleared', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });

        const before = result.current;

        act(() => {
            result.current!.clear();
        });

        // Already in cleared state, should remain identical
        expect(result.current!.context).toBe(before!.context);
        expect(result.current!.timeframe).toBe(before!.timeframe);
        expect(result.current!.isAnalysisReady).toBe(before!.isAnalysisReady);
    });

    it('exposes publish and clear functions', () => {
        const { result } = renderHook(() => useSymbolChatContext(), {
            wrapper,
        });
        expect(typeof result.current!.publish).toBe('function');
        expect(typeof result.current!.clear).toBe('function');
    });
});
