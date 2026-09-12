import type { AgentMessage } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';

/** Max stored length of a conversation title (matches `chat_conversations.title` varchar(120) minus headroom; the derived title itself is capped shorter — see {@link deriveTitle}). */
export const CONVERSATION_TITLE_MAX = 60;

/**
 * `listConversationsAction`/`DrizzleChatConversationRepository.listForUser`
 * page size.
 *
 * ponytail: no cursor paging in the pilot — this constant must stay ≥ the
 * largest tier's conversation cap (currently pro = 300) or a pro member's
 * older conversations silently disappear from the list. If tier caps grow
 * past 300, either raise this constant to match or add cursor paging (the
 * real long-term fix once a single flat LIMIT stops scaling).
 */
export const CONVERSATION_LIST_LIMIT = 300;

export type ChatMessageRole = 'user' | 'assistant' | 'tool';
export type ChatMessageStatus = 'complete' | 'aborted' | 'error' | 'superseded';

/** A persisted SiglensAI conversation row (spec §6-1). */
export interface ChatConversationRecord {
    id: string;
    userId: string;
    title: string;
    locale: Locale;
    modelId: string;
    messageCount: number;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** A persisted conversation message row. */
export interface ChatMessageRecord {
    id: string;
    conversationId: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolCallId: string | null;
    toolName: string | null;
    modelId: string | null;
    usage: Record<string, unknown> | null;
    status: ChatMessageStatus;
    createdAt: Date;
}

/** One row to append; `seq` is assigned by the repository. */
export interface NewChatMessage {
    role: ChatMessageRole;
    content: string;
    toolCalls?: AgentMessage['toolCalls'];
    toolCallId?: string;
    toolName?: string;
    modelId?: string;
    usage?: Record<string, unknown>;
    status?: ChatMessageStatus;
}

/** Client-facing message (no usage internals). */
export interface ChatMessageView {
    id: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolName: string | null;
    status: ChatMessageStatus;
    createdAt: string;
}

/**
 * Fallback title shown for a first message that trims to nothing (e.g. only
 * whitespace). Keyed by the conversation's own `locale` — the fallback is
 * user-visible UI copy, not the audit-only `locale` semantics that
 * `analysis_history` warns against reusing as a read filter (unrelated
 * concern; this is a straight display string lookup).
 */
const DEFAULT_TITLE_BY_LOCALE: Record<Locale, string> = {
    ko: '새 대화',
    en: 'New chat',
    ja: '新しいチャット',
    zh: '新对话',
};

/**
 * Derives a conversation title from the first user message: first line,
 * capped at {@link CONVERSATION_TITLE_MAX} *code points* (not UTF-16 code
 * units — slicing by `.length` can cut an emoji surrogate pair in half),
 * with `\r`/`\r\n` normalized to `\n` before splitting so a Windows-style
 * first line isn't left with a trailing `\r`. Falls back to a
 * locale-appropriate "new conversation" string when the trimmed first line
 * is empty.
 */
export function deriveTitle(
    firstMessage: string,
    locale: Locale = 'ko'
): string {
    const line =
        firstMessage.replace(/\r\n?/g, '\n').trim().split('\n')[0] ?? '';
    if (line.length === 0) return DEFAULT_TITLE_BY_LOCALE[locale];
    const codePoints = Array.from(line);
    return codePoints.length > CONVERSATION_TITLE_MAX
        ? `${codePoints.slice(0, CONVERSATION_TITLE_MAX).join('')}…`
        : line;
}

/** Rows → core transcript; superseded/error rows (regenerate/edit leftovers) are dropped, `aborted` rows are kept (a partial assistant reply is still valid context). */
export function toAgentHistory(
    rows: readonly Pick<
        ChatMessageRecord,
        'role' | 'content' | 'toolCalls' | 'toolCallId' | 'toolName' | 'status'
    >[]
): AgentMessage[] {
    return rows
        .filter(r => r.status === 'complete' || r.status === 'aborted')
        .map(r => ({
            role: r.role,
            content: r.content,
            ...(r.toolCalls && r.toolCalls.length > 0
                ? { toolCalls: r.toolCalls }
                : {}),
            ...(r.toolCallId ? { toolCallId: r.toolCallId } : {}),
            ...(r.toolName ? { toolName: r.toolName } : {}),
        }));
}

/** Record → client view, dropping server-internal fields (`usage`, `toolCallId`, `modelId`). */
export function toMessageView(r: ChatMessageRecord): ChatMessageView {
    return {
        id: r.id,
        seq: r.seq,
        role: r.role,
        content: r.content,
        toolCalls: r.toolCalls,
        toolName: r.toolName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
    };
}
