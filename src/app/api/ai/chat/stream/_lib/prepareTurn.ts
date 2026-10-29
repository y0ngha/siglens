import { constants } from 'node:http2';
import {
    AGENT_LIMITS,
    agentLimit,
    type AgentMessage,
    type Tier,
} from '@y0ngha/siglens-core';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { toAgentHistory } from '@/entities/chat-conversation/model';
import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import type { ParsedBody } from './parseBody';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_CONFLICT, HTTP_STATUS_NOT_FOUND } =
    constants;

/** 스트림이 열리기 전(HTTP 단계)에 거절할 때 본문 `error`로 내려가는 코드. */
type HttpStageError =
    | 'not_found'
    | 'invalid_body'
    | 'conversation_limit'
    | 'conversation_full';

/** 스트림을 열기 전 HTTP 단계에서 턴을 거절한 결과 — 본문 `error`와 상태 코드. */
export interface TurnRefusal {
    status: number;
    error: HttpStageError;
}

/** 모델에 넘길 준비가 끝난 턴 입력. */
export interface ReadyTurn {
    /** `null` for a guest — nothing is read from or written to the database. */
    repo: DrizzleChatConversationRepository | null;
    conversationId: string | null;
    title?: string;
    userMessage: string;
    userMessageId: string | null;
    userMessageSeq: number | null;
    history: AgentMessage[];
    portfolioSymbols: string[];
}

/** 턴 준비 결과 — 라우트가 `'error' in prepared`로 거절을 좁힌다. */
export type PreparedTurn = TurnRefusal | ReadyTurn;

/**
 * Postgres foreign-key violation on `chat_messages.conversation_id`.
 *
 * The member can delete the conversation from the sidebar (or a second tab) while
 * this turn is still running: the turn lock is per-USER, not per-conversation, so it
 * cannot prevent that, and `ON DELETE cascade` only removes rows that already exist
 * at delete time. The late append then hits the FK and the driver error would escape
 * as a generic `server_error`, discarding a finished (already billed) turn behind a
 * confusing message. `not_found` is the honest outcome — the transcript is gone.
 */
const FK_VIOLATION_CODE = '23503';

/** 메시지 INSERT가 대화 삭제 경합(FK 위반)으로 실패한 것인지 가린다. */
export function isConversationGone(error: unknown): boolean {
    return (
        (error as { cause?: { code?: unknown } } | null)?.cause?.code ===
        FK_VIOLATION_CODE
    );
}

/** A guest turn: the browser's transcript is the history, and nothing is stored. */
export function guestTurn(body: ParsedBody): ReadyTurn {
    return {
        repo: null,
        conversationId: null,
        userMessage: body.message,
        userMessageId: null,
        userMessageSeq: null,
        history: body.history,
        portfolioSymbols: [],
    };
}

/**
 * A member turn: resolve/create the conversation, apply `edit`/`regenerate`,
 * store the user row and read the history back. Runs under the caller's turn
 * lock; an HTTP-stage refusal is returned (the caller releases the lock).
 */
export async function prepareMemberTurn(
    userId: string,
    body: ParsedBody,
    tier: Tier,
    locale: Locale
): Promise<PreparedTurn> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleChatConversationRepository(db);

    const conversation =
        body.conversationId === null
            ? null
            : await repo.findForUser(body.conversationId, userId);
    if (body.conversationId !== null && conversation === null) {
        return { status: HTTP_STATUS_NOT_FOUND, error: 'not_found' };
    }
    if (conversation === null && body.action !== 'send') {
        return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
    }
    if (
        conversation === null &&
        (await repo.countForUser(userId)) >=
            agentLimit(tier, 'conversationsMax')
    ) {
        return { status: HTTP_STATUS_CONFLICT, error: 'conversation_limit' };
    }

    let conversationId = conversation?.id ?? '';
    let userMessage = body.message;
    let userMessageId: string | null = null;
    let userMessageSeq: number | null = null;
    let title: string | undefined;

    if (conversation === null) {
        const created = await repo.create({
            userId: userId,
            firstMessage: body.message,
            locale,
            // Always AGENT_MODEL, never the fallback: no turn has run yet at
            // conversation-create time, so whether DeepSeek or Gemini answers
            // this turn isn't known here.
            modelId: AGENT_MODEL,
        });
        conversationId = created.id;
        title = created.title;
    }

    if (body.action === 'edit') {
        const { editSeq } = body;
        const rows = await repo.listMessages(conversationId);
        const target = rows.find(r => r.seq === editSeq);
        // Reject an editSeq that doesn't point at an existing USER row
        // owned by this conversation — an assistant/tool row would leave
        // two consecutive user rows after the append below.
        if (!target || target.role !== 'user') {
            return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
        }
        await repo.deleteFromSeq(conversationId, editSeq);
    } else if (body.action === 'regenerate') {
        if ((await repo.supersedeAfterLastUser(conversationId)) === null) {
            return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
        }
    }

    const rows = await repo.listMessages(conversationId);
    if (rows.length >= AGENT_LIMITS.messagesPerConversation) {
        return { status: HTTP_STATUS_CONFLICT, error: 'conversation_full' };
    }

    // History = every prior turn. `send`/`edit` append the new user row AFTER this read, so the
    // whole transcript is history; `regenerate` reuses the last user row as `userMessage` and
    // drops it from history.
    let history: AgentMessage[] = toAgentHistory(rows);
    if (body.action === 'regenerate') {
        userMessage =
            [...rows].reverse().find(r => r.role === 'user')?.content ?? '';
        const lastUserIndex = history.map(m => m.role).lastIndexOf('user');
        history =
            lastUserIndex >= 0 ? history.slice(0, lastUserIndex) : history;
    } else {
        let saved;
        try {
            [saved] = await repo.appendMessages(conversationId, [
                { role: 'user', content: body.message },
            ]);
        } catch (error) {
            // Deleted between the ownership check and this insert. No stream exists
            // yet, so answer on the HTTP stage rather than as an SSE frame.
            if (!isConversationGone(error)) throw error;
            return { status: HTTP_STATUS_NOT_FOUND, error: 'not_found' };
        }
        userMessageId = saved?.id ?? null;
        userMessageSeq = saved?.seq ?? null;
    }

    const portfolioSymbols = (
        await new DrizzlePortfolioRepository(db).findByUser(userId)
    ).map(h => h.symbol);
    return {
        repo,
        conversationId,
        title,
        userMessage,
        userMessageId,
        userMessageSeq,
        history,
        portfolioSymbols,
    };
}
