import type { SymbolChatState } from '@/features/symbol-chat';
import type { OptionsAnalysisState } from '../hooks/useOptionsAnalysis';

// 옵션 페이지에서 채팅 컨텍스트로 publish할 페이로드를 만든다.
// `done`이 아닌 상태(로딩·에러·봇 차단)에서는 context를 null로 보내 챗봇이
// 불완전한 결과를 참조하지 않도록 하고 입력도 disabled 상태(isAnalysisReady=false)
// 로 유지한다. timeframe은 옵션 페이지에서 의미 없는 개념이라 null로 둔다 —
// FloatingChatButton 측에서 DEFAULT_TIMEFRAME으로 fallback 한다.
export function buildChatState(state: OptionsAnalysisState): SymbolChatState {
    if (state.status === 'done') {
        return {
            context: { kind: 'options', payload: state.result },
            timeframe: null,
            isAnalysisReady: true,
        };
    }
    return { context: null, timeframe: null, isAnalysisReady: false };
}
