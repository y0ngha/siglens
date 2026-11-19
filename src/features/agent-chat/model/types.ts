// Agent chat UI message shapes. They live in the slice's model segment rather
// than in the `useAgentStream` hook so `lib/` helpers and widgets can use them
// without importing the hook module (lib → hooks would invert the dependency).

import type { ChatBlock } from '@/entities/chat-conversation/types';

/** `useAgentStream`'s turn state: no turn running, a turn streaming, or the last turn failed. */
export type AgentStreamStatus = 'idle' | 'streaming' | 'error';

/** One tool call shown as a chip under an assistant bubble. */
export interface ToolActivityItem {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: 'running' | 'ok' | 'error';
    ms?: number;
    summary?: string;
    estimatedSeconds?: number;
    /** 이 도구가 만든 차트 블록(SSE `chart` 프레임, 저장된 대화는 그 tool 행의 `chart`). */
    chart?: ChatBlock;
}

/** 브라우저가 서버로 보내는 이미지 한 장 — `POST /api/ai/chat/stream`의 `images` 항목과 같은 모양. */
export interface ChatImagePayload {
    mediaType: string;
    /** base64, `data:` 접두사 없음. */
    data: string;
}

/**
 * 사용자 말풍선·입력창 썸네일의 이미지 한 장. `src`가 어디를 가리키는지가 두 경우를 가른다.
 * - 방금 첨부한 것: `src`는 object URL이고 `payload`가 메모리에 남는다 — 게스트는 서버에 저장되지 않아
 *   다시 생성할 때 이 payload를 다시 보낸다.
 * - 저장된 대화에서 읽은 것: `src`는 `/api/ai/chat/images/<id>`이고 `payload`는 없다(서버가 보관한다).
 */
export interface ChatImageAttachment {
    id: string;
    src: string;
    width: number;
    height: number;
    payload?: ChatImagePayload;
}

/** One chat bubble as the agent UI renders it (live stream or rebuilt by `fromViews`). */
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
    /** user 말풍선의 첨부 이미지(없으면 키 자체가 없다). */
    images?: readonly ChatImageAttachment[];
}
