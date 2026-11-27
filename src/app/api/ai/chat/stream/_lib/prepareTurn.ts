import {
    AGENT_LIMITS,
    agentLimit,
    type AgentMessage,
    type Tier,
} from '@y0ngha/siglens-core';
import { constants } from 'node:http2';
import {
    DrizzleChatConversationRepository,
    type StoredChatImage,
} from '@/entities/chat-conversation/api';
import {
    toAgentHistory,
    type ChatMessageRecord,
} from '@/entities/chat-conversation/model';
import {
    extractConversationAnalyses,
    type ConversationAnalysis,
} from '@/entities/chat-conversation/server/conversationAnalyses';
import type { NormalizedChatImage } from '@/entities/chat-conversation/server/normalizeChatImage';
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
    /**
     * 이번 턴 user 메시지에 실을 이미지(서버가 정규화한 WebP). 회원 `send`·`edit`은 저장한 그 이미지, `regenerate`는
     * 마지막 user 행에서 다시 읽은 이미지다. 게스트는 요청 본문 그대로이고 저장하지 않는다.
     */
    userImages: readonly StoredChatImage[];
    userMessageId: string | null;
    userMessageSeq: number | null;
    /**
     * 이번 턴의 "## Now" 시계 메모를 저장할 user 행 id. `send`·`edit`은 방금 넣은 행, `regenerate`는 다시 쓰는
     * 마지막 user 행(옛 메모를 덮어쓴다). 게스트는 저장하지 않으므로 `null`.
     */
    turnAtRowId: string | null;
    history: AgentMessage[];
    /**
     * 이 대화의 이전 턴에 보인 일봉 기술적 분석 — 도구가 이번 결과와 비교해 `sinceEarlier`를 싣는 기준.
     * 저장된 행에서만 읽으므로 게스트(브라우저가 보낸 기록은 믿지 않는다)는 비어 있다.
     */
    earlierAnalyses: readonly ConversationAnalysis[];
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
    if (typeof error !== 'object' || error === null) return false;
    const cause: unknown = Reflect.get(error, 'cause');
    return (
        typeof cause === 'object' &&
        cause !== null &&
        Reflect.get(cause, 'code') === FK_VIOLATION_CODE
    );
}

/** A guest turn: the browser's transcript is the history, and nothing is stored. */
export function guestTurn(
    body: ParsedBody,
    images: readonly NormalizedChatImage[] = []
): ReadyTurn {
    return {
        repo: null,
        conversationId: null,
        userMessage: body.message,
        userImages: images,
        userMessageId: null,
        userMessageSeq: null,
        turnAtRowId: null,
        history: body.history,
        earlierAnalyses: [],
        portfolioSymbols: [],
    };
}

type ChatRepo = InstanceType<typeof DrizzleChatConversationRepository>;

/**
 * `edit`의 이미지 승계. 대상이 이 대화의 user 행이 아니면 null(거절).
 * 본문에 이미지가 있으면 그것이 대체하고, 없으면 대상 행의 이미지를 읽는다.
 * 행을 지우면 이미지도 cascade로 사라지므로 호출자는 지우기 전에 이 함수를 부른다.
 *
 * `rows`는 호출자가 이미 읽은 대화 전체다 — 행 하나를 찾으려고 이미지 참조 조인까지 하는 전체 읽기를
 * 한 번 더 하지 않는다.
 */
async function resolveEditImages(
    repo: ChatRepo,
    rows: readonly ChatMessageRecord[],
    editSeq: number,
    images: readonly StoredChatImage[]
): Promise<readonly StoredChatImage[] | null> {
    const target = rows.find(r => r.seq === editSeq);
    // Reject an editSeq that doesn't point at an existing USER row
    // owned by this conversation — an assistant/tool row would leave
    // two consecutive user rows after the append below.
    if (!target || target.role !== 'user') return null;
    return images.length === 0 && (target.images?.length ?? 0) > 0
        ? repo.listImagesOfMessage(target.id)
        : images;
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
    locale: Locale,
    images: readonly NormalizedChatImage[] = []
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
    let turnAtRowId: string | null = null;
    let title: string | undefined;

    if (conversation === null) {
        const created = await repo.create({
            userId: userId,
            firstMessage: body.message,
            hasImages: images.length > 0,
            locale,
            // Always AGENT_MODEL, never the fallback: no turn has run yet at
            // conversation-create time, so whether DeepSeek or Gemini answers
            // this turn isn't known here.
            modelId: AGENT_MODEL,
        });
        conversationId = created.id;
        title = created.title;
    }

    // 이번 턴 user 메시지의 이미지. `send`는 요청 본문, `edit`은 본문이 없을 때 대상 행에서 승계,
    // `regenerate`는 아래에서 마지막 user 행에서 다시 읽는다.
    // `edit`만 지우기 전에 대화를 읽는다 — 아래 이력 읽기가 이 행들에서 지워질 구간만 빼면 같은 결과라 다시 읽지 않는다.
    const rowsBeforeEdit =
        body.action === 'edit' ? await repo.listMessages(conversationId) : [];
    const carriedImages =
        body.action === 'edit'
            ? await resolveEditImages(
                  repo,
                  rowsBeforeEdit,
                  body.editSeq,
                  images
              )
            : images;
    if (carriedImages === null) {
        return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
    }

    if (body.action === 'edit') {
        await repo.deleteFromSeq(conversationId, body.editSeq);
    } else if (body.action === 'regenerate') {
        if ((await repo.supersedeAfterLastUser(conversationId)) === null) {
            return { status: HTTP_STATUS_BAD_REQUEST, error: 'invalid_body' };
        }
    }

    // `deleteFromSeq`가 `editSeq` 이상을 지웠으므로, 다시 읽은 결과와 같다(턴 락 아래라 그 사이 쓰기는 없다).
    const rows =
        body.action === 'edit'
            ? rowsBeforeEdit.filter(r => r.seq < body.editSeq)
            : await repo.listMessages(conversationId);
    if (rows.length >= AGENT_LIMITS.messagesPerConversation) {
        return { status: HTTP_STATUS_CONFLICT, error: 'conversation_full' };
    }

    // History = every prior turn. `send`/`edit` append the new user row AFTER this read, so the
    // whole transcript is history; `regenerate` reuses the last user row as `userMessage` and
    // drops it from history.
    let history: AgentMessage[] = toAgentHistory(rows);
    const lastUser =
        body.action === 'regenerate'
            ? [...rows].reverse().find(r => r.role === 'user')
            : undefined;
    const loadUserImages = async (): Promise<readonly StoredChatImage[]> => {
        if (body.action !== 'regenerate') return carriedImages;
        return lastUser !== undefined && (lastUser.images?.length ?? 0) > 0
            ? await repo.listImagesOfMessage(lastUser.id)
            : [];
    };
    const userImages = await loadUserImages();
    if (body.action === 'regenerate') {
        userMessage = lastUser?.content ?? '';
        turnAtRowId = lastUser?.id ?? null;
        const lastUserIndex = history.map(m => m.role).lastIndexOf('user');
        history =
            lastUserIndex >= 0 ? history.slice(0, lastUserIndex) : history;
    } else {
        let saved: ChatMessageRecord | undefined;
        try {
            // user 행과 이미지를 한 트랜잭션으로 — 이미지 저장이 실패하면 던져 턴을 시작하지 않는다
            // (이미지만 빠진 채 저장하는 폴백은 없다).
            saved = await repo.appendUserMessage(
                conversationId,
                body.message,
                userImages
            );
        } catch (error) {
            // Deleted between the ownership check and this insert. No stream exists
            // yet, so answer on the HTTP stage rather than as an SSE frame.
            if (!isConversationGone(error)) throw error;
            return { status: HTTP_STATUS_NOT_FOUND, error: 'not_found' };
        }
        userMessageId = saved?.id ?? null;
        userMessageSeq = saved?.seq ?? null;
        turnAtRowId = saved?.id ?? null;
    }

    const portfolioSymbols = (
        await new DrizzlePortfolioRepository(db).findByUser(userId)
    ).map(h => h.symbol);
    return {
        repo,
        conversationId,
        title,
        userMessage,
        userImages,
        userMessageId,
        userMessageSeq,
        turnAtRowId,
        history,
        // 이번 턴 user 행은 이 읽기 뒤에 붙으므로 `rows`는 전부 이전 턴이다. superseded·error 행의 결과는 파서가 읽지 않는다.
        earlierAnalyses: extractConversationAnalyses(rows),
        portfolioSymbols,
    };
}
