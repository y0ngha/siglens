import { type Timeframe } from '@y0ngha/siglens-core';
import { type OverallAnalysisState } from '@/components/overall/types';
import { type SymbolChatState } from '@/features/symbol-chat';

// Publish the overall result to the chat context only when it's available.
// For non-done states we return `null` context so the chatbot doesn't reference
// partial/stale data (and the input stays disabled via isAnalysisReady).
export function buildChatState(
    state: OverallAnalysisState,
    timeframe: Timeframe
): SymbolChatState {
    if (state.status === 'done') {
        return {
            context: { kind: 'overall', payload: state.result } as const,
            timeframe,
            isAnalysisReady: true,
        };
    }
    return { context: null, timeframe, isAnalysisReady: false };
}
