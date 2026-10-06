import type { AgentUiMessage } from '../model/types';

/** A guest history entry sent to `/api/ai/chat/stream` — role/content (+ an answer's follow-up chips). */
export interface GuestHistoryMessage {
    readonly role: 'user' | 'assistant';
    readonly content: string;
    /**
     * 답변의 후속 질문 항목. `content`에는 마커 줄이 빠져 있으므로 서버가 이 항목으로
     * 줄을 되붙여, 모델이 읽는 기록이 회원(DB 원문)과 같은 모양이 되게 한다.
     */
    readonly followUps?: readonly string[];
}

/**
 * The prior turns a guest's request carries — answered text only. A failed
 * or still-empty assistant bubble has nothing the model should read back.
 */
export function guestHistory(
    messages: readonly AgentUiMessage[]
): GuestHistoryMessage[] {
    return messages
        .filter(
            m =>
                m.content.trim() !== '' &&
                (m.role === 'user' || m.status !== 'error')
        )
        .map(m =>
            m.role === 'assistant' && m.followUps && m.followUps.length > 0
                ? { role: m.role, content: m.content, followUps: m.followUps }
                : { role: m.role, content: m.content }
        );
}
