import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { SymbolChatState } from '@/components/chat/hooks/useSymbolChat';

interface BuildChatStateInput {
    analysis: AnalysisResponse;
    timeframe: Timeframe;
    displayAnalyzing: boolean;
    isBotBlocked: boolean;
    analysisError: string | null;
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
}: BuildChatStateInput): SymbolChatState {
    if (isBotBlocked || analysisError !== null) {
        return { context: null, timeframe, isAnalysisReady: false };
    }
    return {
        context: { kind: 'technical', payload: analysis },
        timeframe,
        isAnalysisReady: !displayAnalyzing,
    };
}
