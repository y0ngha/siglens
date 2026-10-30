'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentRemaining } from '@y0ngha/siglens-core';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { trackAdsConversion } from '@/shared/lib/googleAds';
import type { AgentClientErrorCode } from '../lib/errorCodes';
import { fromViews } from '../lib/fromViews';
import { guestHistory } from '../lib/guestHistory';
import { optimisticUserMessage } from '../lib/optimisticMessages';
import {
    runAgentTurn,
    type AgentFailureKind,
    type AgentTurnContext,
} from '../lib/runAgentTurn';
import type { AgentStreamStatus, AgentUiMessage } from '../model/types';

/** `useAgentStream`'s input from the chat shell. */
export interface UseAgentStreamOptions {
    conversationId: string | null;
    initialMessages: ChatMessageView[];
    onConversationCreated?: (id: string, title: string) => void;
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
    readonly send: (text: string) => Promise<void>;
    readonly regenerate: () => Promise<void>;
    readonly edit: (seq: number, text: string) => Promise<void>;
    readonly retry: () => Promise<void>;
    readonly stop: () => void;
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
    /** Body of the most recent turn, replayed by `retry()` for an HTTP-stage failure (retry must not turn into `regenerate` there). */
    const lastBodyRef = useRef<Record<string, unknown> | null>(null);
    /** Which failure kind `retry()` is reacting to — only a turn-stage failure may map to `regenerate()` (a partial assistant row was actually persisted for that turn). */
    const lastErrorKindRef = useRef<AgentFailureKind>(null);
    /** The last turn was a guest regenerate (sent as `send`) — `retry()` must replay it as one. */
    const guestRegenerateRef = useRef(false);

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
                setError,
                setRemaining,
                onConversationAssigned: (id, title) => {
                    setConversationId(id);
                    onConversationCreatedRef.current?.(id, title);
                },
                setFailureKind: kind => {
                    lastErrorKindRef.current = kind;
                },
            };
            return runAgentTurn(ctx, {
                body,
                addsUserBubble,
                restoreSnapshot,
            });
        },
        [conversationId]
    );

    /** Posts a user message. Untracked — `retry` replays through here so a retried question is not a second ad conversion. */
    const submit = useCallback(
        (message: string): Promise<void> => {
            const snapshot = messagesRef.current;
            guestRegenerateRef.current = false;
            setMessages(prev => [...prev, optimisticUserMessage(message)]);
            return run(
                {
                    action: 'send',
                    message,
                    ...(guest ? { history: guestHistory(snapshot) } : {}),
                },
                true,
                snapshot
            );
        },
        [run, guest]
    );

    /**
     * A new question from the composer — the only path that records the
     * `chatQuestion` ad conversion. `edit`, `regenerate` and `retry` re-ask an
     * existing question, so they go through `run`/`submit` without counting.
     */
    const send = useCallback(
        (message: string): Promise<void> => {
            trackAdsConversion('chatQuestion');
            return submit(message);
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
                return [
                    ...(index >= 0 ? prev.slice(0, index) : prev),
                    optimisticUserMessage(message),
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
        if (body.action === 'send') return submit(String(body.message ?? ''));
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
    // Abort an in-flight turn if the component unmounts mid-stream (nav away,
    // conversation swap) — an orphaned reader loop would keep patching state
    // on an unmounted hook instance.
    useEffect(() => () => controllerRef.current?.abort(), []);

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
    };
}
