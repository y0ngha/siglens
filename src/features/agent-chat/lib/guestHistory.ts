import type { AgentUiMessage } from '../hooks/useAgentStream';

/** A guest history entry sent to `/api/ai/chat/stream` — role/content only. */
export interface GuestHistoryMessage {
    readonly role: 'user' | 'assistant';
    readonly content: string;
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
        .map(m => ({ role: m.role, content: m.content }));
}
