// Agent chat UI message shapes. They live in the slice's model segment rather
// than in the `useAgentStream` hook so `lib/` helpers and widgets can use them
// without importing the hook module (lib → hooks would invert the dependency).

export interface ToolActivityItem {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: 'running' | 'ok' | 'error';
    ms?: number;
    summary?: string;
    estimatedSeconds?: number;
}
export interface AgentUiMessage {
    id: string;
    seq?: number;
    role: 'user' | 'assistant';
    content: string;
    tools: ToolActivityItem[];
    status: 'complete' | 'streaming' | 'aborted' | 'error';
    truncated?: boolean;
    /**
     * An answer the model had already started writing when it decided to
     * fetch more data. Kept (dimmed, with a note) until the new answer's
     * first text arrives, so the reply is visibly being redone instead of
     * silently vanishing. Streaming-only; never persisted.
     */
    draft?: string;
    /**
     * 답변 끝줄에서 서버가 떼어 낸 후속 질문 칩 항목(SSE `done`의 `followUps`,
     * 저장된 대화는 `ChatMessageView.followUps`). `content`에는 그 마커 줄이 없다.
     */
    followUps?: readonly string[];
}
