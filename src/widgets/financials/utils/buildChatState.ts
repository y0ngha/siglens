import type { SymbolChatState } from '@/features/symbol-chat';
import type { FinancialsAnalysisState } from '../hooks/useFinancialsAnalysis';

// 재무제표 페이지의 채팅 publish 페이로드.
// `done`이 아닌 상태(loading·bot_blocked·error)에서는 context를 null로 보내
// 챗봇이 stale 결과를 참조하지 않도록 하고 입력도 disabled 상태로 유지한다.
// timeframe은 재무제표 분석에서 의미가 없어 null — FloatingChatButton 측에서
// DEFAULT_TIMEFRAME으로 fallback 한다.
export function buildChatState(
    state: FinancialsAnalysisState
): SymbolChatState {
    if (state.status === 'done') {
        return {
            context: { kind: 'financials', payload: state.result },
            timeframe: null,
            isAnalysisReady: true,
        };
    }
    return { context: null, timeframe: null, isAnalysisReady: false };
}
