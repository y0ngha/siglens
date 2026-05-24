import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import type { SymbolChatState } from '@/features/symbol-chat';

// 공포 탐욕 페이지의 채팅 publish 페이로드.
// 다른 페이지와 달리 fear-greed 데이터는 챗봇 context에 포함되지 않으므로
// `context`는 항상 null이며, snapshot 존재 여부로 입력 활성화 여부(isAnalysisReady)만
// 토글한다. timeframe은 fear-greed가 일봉 고정이라 null —
// FloatingChatButton 측에서 DEFAULT_TIMEFRAME으로 fallback 한다.
export function buildChatState(
    snapshot: FearGreedSnapshot | null
): SymbolChatState {
    return {
        context: null,
        timeframe: null,
        isAnalysisReady: snapshot !== null,
    };
}
