/**
 * "시그렌즈 AI가 답변 한 턴을 끝냈다" 신호. 채팅 세션(`ChatSession`)이 `useAgentStream`의
 * `onTurnComplete`에서 발행하고, 레이아웃의 VOC 호스트가 구독한다 - 호스트는 채팅 트리 밖(프로바이더)에
 * 있어 props나 컨텍스트로 닿지 않는다(`symbolAnalyzedSignal`과 같은 구조).
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function publishAgentTurnCompleted(): void {
    listeners.forEach(listener => listener());
}

export function subscribeAgentTurnCompleted(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
