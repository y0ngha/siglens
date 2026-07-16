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

// 차트(technical) 페이지의 채팅 publish 페이로드. 세 가지 케이스로 나뉜다.
// 1) bot_blocked 또는 error인 경우: 채팅 자체를 쓸 수 없는 상태다. context를
//    null로 보내 챗봇이 stale analysis를 참조하지 않도록 하고 입력도 잠근다
//    (isAnalysisReady=false).
// 2) lockedInfoDepth가 비어있지 않은 경우(free/locked 사용자): 잠긴 분석
//    상세는 챗봇에 노출되면 안 되므로 context는 null로 유지한다(no-leak).
//    다만 채팅 자체는 막을 이유가 없으므로 isAnalysisReady는 일반 케이스와
//    동일하게 displayAnalyzing만 따른다. free 사용자도 일반 대화는 가능하다.
// 3) 그 외(unlocked)인 경우: 현재 analysis와 timeframe을 그대로 publish하며,
//    displayAnalyzing 중에는 isAnalysisReady만 false로 떨어뜨려 입력을 잠근다.
export function buildChatState({
    analysis,
    timeframe,
    displayAnalyzing,
    isBotBlocked,
    analysisError,
    lockedInfoDepth,
}: BuildChatStateInput): SymbolChatState {
    if (isBotBlocked || analysisError !== null) {
        return { context: null, timeframe, isAnalysisReady: false };
    }
    if (lockedInfoDepth.length > 0) {
        return { context: null, timeframe, isAnalysisReady: !displayAnalyzing };
    }
    return {
        context: { kind: 'technical', payload: analysis },
        timeframe,
        isAnalysisReady: !displayAnalyzing,
    };
}
