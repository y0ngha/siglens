'use client';

import type { AgentRemaining } from '@y0ngha/siglens-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { trackAdsConversion } from '@/shared/lib/googleAds';
import { dropSentPayloads } from '../lib/dropSentPayloads';
import type { AgentClientErrorCode } from '../lib/errorCodes';
import { fromViews } from '../lib/fromViews';
import { guestHistory } from '../lib/guestHistory';
import { optimisticUserMessage } from '../lib/optimisticMessages';
import { imagePayloads } from '../lib/prepareChatImage';
import {
    runAgentTurn,
    type AgentFailureKind,
    type AgentTurnContext,
} from '../lib/runAgentTurn';
import type {
    AgentStreamStatus,
    AgentUiMessage,
    ChatImageAttachment,
} from '../model/types';

/** `useAgentStream`'s input from the chat shell. */
export interface UseAgentStreamOptions {
    conversationId: string | null;
    initialMessages: ChatMessageView[];
    onConversationCreated?: (id: string, title: string) => void;
    /**
     * Fires once for each assistant turn that finished with an answer (not on error, stop or a
     * replaced call). Callers use it as the "first good AI experience" moment.
     */
    onTurnComplete?: () => void;
    /**
     * No session: nothing is stored server-side, so every turn carries the
     * transcript this hook holds as `history`, and `regenerate` re-sends the
     * last question instead of asking the server to rewrite stored rows.
     */
    guest?: boolean;
}

/** The transcript, turn state and actions the chat shell renders and wires to its controls. */
export interface UseAgentStreamResult {
    readonly messages: AgentUiMessage[];
    readonly conversationId: string | null;
    readonly status: AgentStreamStatus;
    readonly error: AgentClientErrorCode | null;
    /** Daily allowance left after the last turn; `null` until a `done` frame reports it. */
    readonly remaining: AgentRemaining | null;
    /** `images`: 이번 질문에 첨부한 이미지(글이 비어도 이미지가 있으면 보낼 수 있다). */
    readonly send: (
        text: string,
        images?: readonly ChatImageAttachment[]
    ) => Promise<void>;
    readonly regenerate: () => Promise<void>;
    readonly edit: (seq: number, text: string) => Promise<void>;
    readonly retry: () => Promise<void>;
    readonly stop: () => void;
    /** 이미지가 거절돼 되돌려 줄 글(없으면 `null`) — Composer의 `restoredDraft`로 넘긴다. */
    readonly restoredDraft: RestoredDraft | null;
}

/** 이미지가 거절된 질문의 글 — {@link useAgentStream}의 `restoredDraft`. */
export interface RestoredDraft {
    readonly id: number;
    readonly text: string;
}

/** 같은 이미지로는 다시 보내도 또 거절되는 오류 — 다시 시도 대신 글을 입력창에 되돌린다. */
const DRAFT_RESTORING_ERRORS: ReadonlySet<AgentClientErrorCode> = new Set([
    'invalid_image',
    'too_large',
]);

/** 방금 첨부한 이미지(`blob:`)의 object URL만 놓는다 — 저장된 이미지는 서버 경로라 해당 없다. */
function revokeBlobUrl(src: string): void {
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
}

/**
 * SIGLENS AI chat state for one conversation: the transcript (seeded from the
 * stored rows), the streamed turn in flight, and send / regenerate / edit /
 * retry / stop. Each turn runs in `runAgentTurn`; this hook owns the state,
 * keeps one turn current at a time and decides how a retry replays.
 */
export function useAgentStream(
    options: UseAgentStreamOptions
): UseAgentStreamResult {
    const [messages, setMessages] = useState<AgentUiMessage[]>(() =>
        fromViews(options.initialMessages)
    );
    const [conversationId, setConversationId] = useState(
        options.conversationId
    );
    const [status, setStatus] = useState<AgentStreamStatus>('idle');
    const [error, setError] = useState<AgentClientErrorCode | null>(null);
    const [remaining, setRemaining] = useState<AgentRemaining | null>(null);

    // Mirrors `messages` synchronously (state updates are async) so
    // `send`/`edit`/`regenerate` can snapshot "what the transcript looked
    // like right before this optimistic mutation" and hand it to the turn for
    // an exact rollback on an HTTP-stage failure (nothing persisted server-side).
    const messagesRef = useRef(messages);
    const controllerRef = useRef<AbortController | null>(null);
    const onConversationCreatedRef = useRef(options.onConversationCreated);
    const onTurnCompleteRef = useRef(options.onTurnComplete);
    /** Body of the most recent turn, replayed by `retry()` for an HTTP-stage failure (retry must not turn into `regenerate` there). */
    const lastBodyRef = useRef<Record<string, unknown> | null>(null);
    /** Which failure kind `retry()` is reacting to — only a turn-stage failure may map to `regenerate()` (a partial assistant row was actually persisted for that turn). */
    const lastErrorKindRef = useRef<AgentFailureKind>(null);
    /** The last turn was a guest regenerate (sent as `send`) — `retry()` must replay it as one. */
    const guestRegenerateRef = useRef(false);
    /** 마지막 `submit`이 실은 이미지 — HTTP 단계 실패를 `retry()`가 같은 이미지로 다시 보내려고 든다. */
    const lastImagesRef = useRef<readonly ChatImageAttachment[]>([]);
    /** 마지막 턴이 남긴 오류 코드 — `submit`이 이미지 거절인지 보고 입력을 되돌려 줄지 정한다. */
    const lastErrorCodeRef = useRef<AgentClientErrorCode | null>(null);
    /**
     * 이미지가 거절돼(`invalid_image`·`too_large`) 사용자 말풍선이 사라진 질문의 글 — Composer가 받아 입력창에 되돌린다.
     * 이 오류는 같은 이미지로 다시 보내도 또 거절되므로 다시 시도 버튼이 없고, 글을 되돌려야 이미지만 바꿔 다시 보낼 수 있다.
     * `id`가 바뀔 때만 되돌린다(같은 글을 두 번 거절당해도 두 번 되돌린다).
     */
    const [restoredDraft, setRestoredDraft] = useState<RestoredDraft | null>(
        null
    );

    const guest = options.guest === true;

    const run = useCallback(
        (
            body: Record<string, unknown>,
            addsUserBubble: boolean,
            restoreSnapshot: AgentUiMessage[]
        ): Promise<void> => {
            lastBodyRef.current = body;
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;
            const ctx: AgentTurnContext = {
                conversationId,
                controller,
                isCurrent: () => controllerRef.current === controller,
                setMessages,
                setStatus,
                setError: code => {
                    lastErrorCodeRef.current = code;
                    setError(code);
                },
                setRemaining,
                onConversationAssigned: (id, title) => {
                    setConversationId(id);
                    onConversationCreatedRef.current?.(id, title);
                },
                setFailureKind: kind => {
                    lastErrorKindRef.current = kind;
                },
                onTurnComplete: () => {
                    onTurnCompleteRef.current?.();
                    // 보낸 이미지의 base64가 세션 내내 상태에 남지 않게 한다(게스트는 마지막 질문만 재생성용으로 남긴다).
                    // `retry()`가 쓰는 `lastImagesRef`는 HTTP 단계 실패용이라 성공한 턴 뒤에는 필요 없어 함께 비운다.
                    setMessages(prev => dropSentPayloads(prev, guest));
                    lastImagesRef.current = [];
                },
            };
            return runAgentTurn(ctx, {
                body,
                addsUserBubble,
                restoreSnapshot,
            });
        },
        [conversationId, guest]
    );

    /** Posts a user message. Untracked — `retry` replays through here so a retried question is not a second ad conversion. */
    const submit = useCallback(
        (
            message: string,
            images: readonly ChatImageAttachment[] = []
        ): Promise<void> => {
            const snapshot = messagesRef.current;
            guestRegenerateRef.current = false;
            // HTTP 단계 오류로 롤백된 첨부는 `lastImagesRef`에만 남아 있다 — 새 제출이 그 자리를 덮으면 아무도 가리키지 않는
            // blob URL이 새므로, 새 첨부·현재 말풍선이 쓰지 않는 것만 놓는다(`retry()`는 같은 첨부를 다시 넘긴다).
            const inUse = new Set([
                ...images.map(image => image.src),
                ...snapshot.flatMap(
                    m => m.images?.map(image => image.src) ?? []
                ),
            ]);
            lastImagesRef.current.forEach(image => {
                if (!inUse.has(image.src)) revokeBlobUrl(image.src);
            });
            lastImagesRef.current = images;
            setMessages(prev => [
                ...prev,
                optimisticUserMessage(message, images),
            ]);
            return run(
                {
                    action: 'send',
                    message,
                    ...(images.length > 0
                        ? { images: imagePayloads(images) }
                        : {}),
                    ...(guest ? { history: guestHistory(snapshot) } : {}),
                },
                true,
                snapshot
            ).then(() => {
                const code = lastErrorCodeRef.current;
                if (
                    lastErrorKindRef.current === 'http' &&
                    code !== null &&
                    DRAFT_RESTORING_ERRORS.has(code)
                ) {
                    // 이 오류는 다시 시도가 없고 말풍선이 롤백돼 화면이 이 URL을 다시 쓰지 않는다 — 여기서 놓는다.
                    // 다른 HTTP 오류는 `retry()`가 같은 첨부를 다시 보내 다시 그리므로 놓지 않는다.
                    images.forEach(image => revokeBlobUrl(image.src));
                    setRestoredDraft(prev => ({
                        id: (prev?.id ?? 0) + 1,
                        text: message,
                    }));
                }
            });
        },
        [run, guest]
    );

    /**
     * A new question from the composer — the only path that records the
     * `chatQuestion` ad conversion. `edit`, `regenerate` and `retry` re-ask an
     * existing question, so they go through `run`/`submit` without counting.
     */
    const send = useCallback(
        (
            message: string,
            images: readonly ChatImageAttachment[] = []
        ): Promise<void> => {
            trackAdsConversion('chatQuestion');
            return submit(message, images);
        },
        [submit]
    );

    const regenerate = useCallback((): Promise<void> => {
        const snapshot = messagesRef.current;
        setMessages(prev =>
            prev.at(-1)?.role === 'assistant' ? prev.slice(0, -1) : prev
        );
        guestRegenerateRef.current = guest;
        if (!guest) return run({ action: 'regenerate' }, false, snapshot);
        // Same question again, with the turns before it as history.
        const lastUser = snapshot.findLastIndex(m => m.role === 'user');
        const question = snapshot[lastUser];
        if (question === undefined) return Promise.resolve();
        return run(
            {
                action: 'send',
                message: question.content,
                // 게스트의 이미지는 서버에 없다 — 브라우저가 메모리에 든 payload를 다시 보낸다.
                ...(question.images && question.images.length > 0
                    ? { images: imagePayloads(question.images) }
                    : {}),
                history: guestHistory(snapshot.slice(0, lastUser)),
            },
            false,
            snapshot
        );
    }, [run, guest]);

    const edit = useCallback(
        (seq: number, message: string): Promise<void> => {
            const snapshot = messagesRef.current;
            setMessages(prev => {
                const index = prev.findIndex(m => m.seq === seq);
                // 서버는 편집한 행의 이미지를 그대로 이어 붙인다(`resolveEditImages`) — 화면도 같은 첨부를 보여 줘야
                // 저장·전송된 것과 어긋나지 않는다. 본문에는 싣지 않는다(서버가 보관분을 다시 읽는다).
                const images =
                    (index >= 0 ? prev[index]?.images : undefined) ?? [];
                return [
                    ...(index >= 0 ? prev.slice(0, index) : prev),
                    optimisticUserMessage(message, images),
                ];
            });
            return run(
                { action: 'edit', editSeq: seq, message },
                true,
                snapshot
            );
        },
        [run]
    );

    const stop = useCallback(() => controllerRef.current?.abort(), []);

    /**
     * Replays the failed call for the banner's "재시도" button. HTTP-stage
     * failures (nothing persisted) replay via `send`/`edit` so the user's
     * text isn't lost and no turn is burned on the wrong question; only a
     * turn-stage failure (a partial row was actually saved) maps to
     * `regenerate()`.
     */
    const retry = useCallback((): Promise<void> => {
        if (lastErrorKindRef.current === 'turn') return regenerate();
        const body = lastBodyRef.current;
        // A guest's regenerate goes out as `send` (see `regenerate`): replaying
        // that body through `send` would put the question on screen twice.
        if (!body || guestRegenerateRef.current) return regenerate();
        if (body.action === 'send')
            return submit(String(body.message ?? ''), lastImagesRef.current);
        if (body.action === 'edit')
            return edit(Number(body.editSeq), String(body.message ?? ''));
        return run({ action: 'regenerate' }, false, messagesRef.current);
    }, [regenerate, submit, edit, run]);

    // Synced in an effect, not inside the updater: a state updater must stay pure
    // (React may re-run it). Handlers read this after commit, which is exactly the
    // "before this optimistic mutation" snapshot they need.
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    // Not assigned during render — a render is allowed to be discarded/replayed
    // (React strict-mode double-invoke, concurrent features), so a callback
    // ref must only be captured once the render has actually committed.
    useEffect(() => {
        onConversationCreatedRef.current = options.onConversationCreated;
    }, [options.onConversationCreated]);
    useEffect(() => {
        onTurnCompleteRef.current = options.onTurnComplete;
    }, [options.onTurnComplete]);
    // Abort an in-flight turn if the component unmounts mid-stream (nav away,
    // conversation swap) — an orphaned reader loop would keep patching state
    // on an unmounted hook instance.
    useEffect(() => () => controllerRef.current?.abort(), []);
    // 방금 첨부한 이미지의 object URL은 대화 화면이 사라질 때 놓아 준다(저장된 이미지는 서버 경로라 해당 없음).
    useEffect(
        () => () => {
            messagesRef.current.forEach(m =>
                m.images?.forEach(image => revokeBlobUrl(image.src))
            );
            // 롤백돼 화면엔 없고 `retry()` 대기로만 남은 첨부도 함께 놓는다.
            lastImagesRef.current.forEach(image => revokeBlobUrl(image.src));
        },
        []
    );

    return {
        messages,
        conversationId,
        status,
        error,
        remaining,
        send,
        regenerate,
        edit,
        retry,
        stop,
        restoredDraft,
    };
}
