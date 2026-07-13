import type {
    AnalysisResponse,
    TierInfoDepth,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { SymbolChatState } from '@/features/symbol-chat';

interface BuildChatStateInput {
    analysis: AnalysisResponse;
    timeframe: Timeframe;
    displayAnalyzing: boolean;
    isBotBlocked: boolean;
    analysisError: string | null;
    lockedInfoDepth: readonly TierInfoDepth[];
}

// 차트(technical) 페이지의 채팅 publish 페이로드.
// bot_blocked 또는 error 상태에서는 context를 null로 보내 챗봇이 stale
// analysis를 참조하지 않도록 하고 입력도 disabled(isAnalysisReady=false).
// 그 외에는 현재 analysis와 timeframe을 publish하며, displayAnalyzing 중에는
// isAnalysisReady만 false로 떨어뜨려 입력을 잠근다.
export function buildChatState({
    analysis,
    timeframe,
    displayAnalyzing,
    isBotBlocked,
    analysisError,
    lockedInfoDepth,
}: BuildChatStateInput): SymbolChatState {
    if (isBotBlocked || analysisError !== null || lockedInfoDepth.length > 0) {
        return { context: null, timeframe, isAnalysisReady: false };
    }
    return {
        context: { kind: 'technical', payload: analysis },
        timeframe,
        isAnalysisReady: !displayAnalyzing,
    };
}
