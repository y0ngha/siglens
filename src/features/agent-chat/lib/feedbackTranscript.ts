import type {
    AgentMessageFeedbackContext,
    AgentTranscriptEntry,
} from '@/entities/feedback/types';
import type { AgentUiMessage } from '../model/types';

/** 클라이언트에서만 쓰는 임시 id 접두사. 서버(chat_messages)에 없는 id라 보내지 않는다. */
const LOCAL_ID_PREFIX = /^(?:local|pending)-/;

/**
 * 평가한 답변까지의 대화 기록(스냅샷). 그 답변을 포함하고 그 뒤는 담지 않는다 - 평가 시점에
 * 사용자가 본 맥락만 남긴다. 내용이 빈 말풍선(실패·아직 비어 있는 답)은 읽을 것이 없어 뺀다.
 * 도구는 이름과 요약만 싣는다(인자·원본 결과는 크고 평가에 필요 없다).
 */
export function buildFeedbackTranscript(
    messages: readonly AgentUiMessage[],
    index: number
): AgentTranscriptEntry[] {
    return messages
        .slice(0, index + 1)
        .filter(m => m.content.trim() !== '')
        .map((m): AgentTranscriptEntry => {
            const tools = m.tools.map(tool => ({
                name: tool.name,
                ...(tool.summary === undefined
                    ? {}
                    : { summary: tool.summary }),
            }));
            return m.role === 'assistant' && tools.length > 0
                ? { role: m.role, content: m.content, tools }
                : { role: m.role, content: m.content };
        });
}

interface FeedbackContextInput {
    readonly message: AgentUiMessage;
    readonly index: number;
    readonly conversationId: string | null;
    readonly guest: boolean;
}

/**
 * 답변 하나의 식별 맥락. 회원이면 대화·메시지 id를 싣되 임시 id는 뺀다(서버가 행을 못 찾는다).
 * 비회원 대화는 저장되지 않아 id가 없고 `guest: true`만 남는다.
 */
export function buildFeedbackContext({
    message,
    index,
    conversationId,
    guest,
}: FeedbackContextInput): AgentMessageFeedbackContext {
    return {
        guest,
        messageIndex: index,
        ...(!guest && conversationId !== null ? { conversationId } : {}),
        ...(!guest && !LOCAL_ID_PREFIX.test(message.id)
            ? { messageId: message.id }
            : {}),
    };
}
