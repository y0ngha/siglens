'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessageView } from '@/entities/chat-conversation';
import { ANALYSIS_LOCALE_HEADER, splitLocalePath } from '@/shared/i18n/locales';
import {
    isAgentClientErrorCode,
    type AgentClientErrorCode,
} from '../lib/errorCodes';
import { parseSseFrame, splitFrames } from '../lib/parseSseFrames';

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
}
export interface AgentRemaining {
    turns: number;
    fresh: number;
    search: number;
}
export type StreamStatus = 'idle' | 'streaming' | 'error';
interface Options {
    conversationId: string | null;
    initialMessages: ChatMessageView[];
    onConversationCreated?: (id: string, title: string) => void;
}

/** SSE `error` frame — an `AgentErrorCode` the turn itself reported (spec §8). */
class TurnFrameError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}
/** Non-2xx HTTP response — the JSON `{ error }` body the route sent before any turn started. */
class HttpError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

/**
 * A delimiter-less stream (proxy strips blank lines, provider hangs mid
 * write) must not let `buffer` grow forever between reads — that's an
 * unbounded string held in a component that keeps re-scanning it from
 * scratch every chunk. 1MB is far past any real turn's frame size.
 */
const MAX_BUFFER_CHARS = 1_000_000;

/** DB rows → UI messages: tool rows fold into the preceding assistant bubble. */
export function fromViews(views: ChatMessageView[]): AgentUiMessage[] {
    const out: AgentUiMessage[] = [];
    for (const v of views) {
        const prev = out[out.length - 1];
        if (v.role === 'tool') {
            if (prev?.role === 'assistant') {
                // The assistant row's `toolCalls` already produced a chip for this call
                // (with its args); the `tool` row is that call's RESULT. Pushing it as a
                // second chip rendered every tool twice — once "get_quote AAPL" from the
                // args and once bare "get_quote" from here. Merge by name instead.
                const existing = prev.tools.find(
                    t =>
                        t.name === (v.toolName ?? 'tool') &&
                        t.summary === undefined
                );
                if (existing) existing.summary = v.content.slice(0, 120);
                else
                    prev.tools.push({
                        id: v.id,
                        name: v.toolName ?? 'tool',
                        args: {},
                        status: 'ok',
                        summary: v.content.slice(0, 120),
                    });
            }
            continue;
        }
        if (
            v.role === 'assistant' &&
            v.toolCalls &&
            v.toolCalls.length > 0 &&
            v.content === ''
        ) {
            if (prev?.role === 'assistant' && prev.content === '')
                prev.tools.push(
                    ...v.toolCalls.map(c => ({
                        id: c.id,
                        name: c.name,
                        args: c.args,
                        status: 'ok' as const,
                    }))
                );
            else
                out.push({
                    id: v.id,
                    seq: v.seq,
                    role: 'assistant',
                    content: '',
                    tools: v.toolCalls.map(c => ({
                        id: c.id,
                        name: c.name,
                        args: c.args,
                        status: 'ok' as const,
                    })),
                    status: 'complete',
                });
            continue;
        }
        if (
            v.role === 'assistant' &&
            prev?.role === 'assistant' &&
            prev.content === ''
        ) {
            prev.id = v.id;
            prev.seq = v.seq;
            prev.content = v.content;
            prev.status = v.status === 'aborted' ? 'aborted' : 'complete';
            continue;
        }
        out.push({
            id: v.id,
            seq: v.seq,
            role: v.role,
            content: v.content,
            tools: [],
            status: v.status === 'aborted' ? 'aborted' : 'complete',
        });
    }
    return out;
}

export interface UseAgentStreamResult {
    readonly messages: AgentUiMessage[];
    readonly conversationId: string | null;
    readonly status: StreamStatus;
    readonly error: AgentClientErrorCode | null;
    readonly remaining: AgentRemaining | null;
    readonly send: (text: string) => Promise<void>;
    readonly regenerate: () => Promise<void>;
    readonly edit: (seq: number, text: string) => Promise<void>;
    readonly retry: () => Promise<void> | undefined;
    readonly stop: () => void;
}

export function useAgentStream(options: Options): UseAgentStreamResult {
    const [messages, setMessages] = useState<AgentUiMessage[]>(() =>
        fromViews(options.initialMessages)
    );
    // Mirrors `messages` synchronously (state updates are async) so
    // `send`/`edit`/`regenerate` can snapshot "what the transcript looked
    // like right before this optimistic mutation" and hand it to `run` for
    // an exact rollback on an `HttpError` (nothing persisted server-side).
    const messagesRef = useRef(messages);
    // Synced in an effect, not inside the updater: a state updater must stay pure
    // (React may re-run it). Handlers read this after commit, which is exactly the
    // "before this optimistic mutation" snapshot they need.
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    const updateMessages = useCallback(
        (updater: (prev: AgentUiMessage[]) => AgentUiMessage[]) => {
            setMessages(updater);
        },
        []
    );
    const [conversationId, setConversationId] = useState(
        options.conversationId
    );
    const [status, setStatus] = useState<StreamStatus>('idle');
    const [error, setError] = useState<AgentClientErrorCode | null>(null);
    const [remaining, setRemaining] = useState<AgentRemaining | null>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const onConversationCreatedRef = useRef(options.onConversationCreated);
    // Not assigned during render — a render is allowed to be discarded/replayed
    // (React strict-mode double-invoke, concurrent features), so a callback
    // ref must only be captured once the render has actually committed.
    useEffect(() => {
        onConversationCreatedRef.current = options.onConversationCreated;
    }, [options.onConversationCreated]);

    /** Body of the most recent `run()` call, replayed by `retry()` for an HTTP-stage failure (spec: retry must not turn into `regenerate` there). */
    const lastBodyRef = useRef<Record<string, unknown> | null>(null);
    /** Which failure kind `retry()` is reacting to — only a `TurnFrameError` may map to `regenerate()` (a partial assistant row was actually persisted for that turn). */
    const lastErrorKindRef = useRef<'http' | 'turn' | null>(null);

    // Abort an in-flight turn if the component unmounts mid-stream (nav away,
    // conversation swap) — an orphaned reader loop would keep patching state
    // on an unmounted hook instance.
    useEffect(() => () => controllerRef.current?.abort(), []);

    const patchLast = useCallback(
        (fn: (m: AgentUiMessage) => AgentUiMessage) => {
            updateMessages(prev =>
                prev.length === 0
                    ? prev
                    : [...prev.slice(0, -1), fn(prev[prev.length - 1]!)]
            );
        },
        [updateMessages]
    );

    const run = useCallback(
        async (
            body: Record<string, unknown>,
            addsUserBubble: boolean,
            /** Transcript exactly as it was before this call's optimistic mutation — restored verbatim on an `HttpError` (spec: nothing persisted, so nothing should stay truncated/dropped on screen). */
            restoreSnapshot: AgentUiMessage[]
        ) => {
            lastBodyRef.current = body;
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;
            let reader: ReadableStreamDefaultReader<string> | undefined;
            setStatus('streaming');
            setError(null);
            updateMessages(prev => [
                ...prev,
                {
                    id: `pending-${Date.now()}`,
                    role: 'assistant',
                    content: '',
                    tools: [],
                    status: 'streaming',
                },
            ]);
            try {
                const response = await fetch('/api/ai/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        [ANALYSIS_LOCALE_HEADER]: splitLocalePath(
                            window.location.pathname
                        ).locale,
                    },
                    body: JSON.stringify({ conversationId, ...body }),
                    signal: controller.signal,
                });
                if (!response.ok || response.body === null) {
                    const payload = (await response
                        .json()
                        .catch(() => ({}))) as { error?: string };
                    throw new HttpError(
                        payload.error ?? `http_${response.status}`
                    );
                }
                reader = response.body
                    .pipeThrough(new TextDecoderStream())
                    .getReader();
                let buffer = '';
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += value;
                    const { frames, rest } = splitFrames(buffer);
                    buffer = rest;
                    if (buffer.length > MAX_BUFFER_CHARS) {
                        throw new TurnFrameError('server_error');
                    }
                    for (const raw of frames) {
                        const { event, data } = parseSseFrame(raw);
                        if (data === null) continue;
                        if (event === 'meta') {
                            if (
                                typeof data.conversationId === 'string' &&
                                data.conversationId !== conversationId
                            ) {
                                setConversationId(data.conversationId);
                                onConversationCreatedRef.current?.(
                                    data.conversationId,
                                    String(data.title ?? '')
                                );
                            }
                            // Attach the stored user row's `seq` to the optimistic bubble
                            // `send`/`edit` already appended (right before the pending
                            // assistant bubble this `run` just pushed) — without it, Edit
                            // has nothing to key off of until a reload re-hydrates from
                            // `ChatMessageView[]` (spec: seq required for Edit).
                            if (
                                addsUserBubble &&
                                typeof data.userMessageSeq === 'number'
                            ) {
                                const seq = data.userMessageSeq;
                                updateMessages(prev => {
                                    const userIndex = prev.length - 2;
                                    const target = prev[userIndex];
                                    if (
                                        !target ||
                                        target.role !== 'user' ||
                                        target.seq !== undefined
                                    )
                                        return prev;
                                    const next = [...prev];
                                    next[userIndex] = { ...target, seq };
                                    return next;
                                });
                            }
                        } else if (event === 'text') {
                            patchLast(m => ({
                                ...m,
                                content: m.content + String(data.delta ?? ''),
                            }));
                        } else if (event === 'tool_start') {
                            patchLast(m => ({
                                ...m,
                                tools: [
                                    ...m.tools,
                                    {
                                        id: String(data.id),
                                        name: String(data.name),
                                        args:
                                            (data.args as Record<
                                                string,
                                                unknown
                                            >) ?? {},
                                        status: 'running',
                                        estimatedSeconds:
                                            typeof data.estimatedSeconds ===
                                            'number'
                                                ? data.estimatedSeconds
                                                : undefined,
                                    },
                                ],
                            }));
                        } else if (event === 'tool_end') {
                            patchLast(m => ({
                                ...m,
                                tools: m.tools.map(t =>
                                    t.id === data.id
                                        ? {
                                              ...t,
                                              status:
                                                  data.status === 'ok'
                                                      ? 'ok'
                                                      : 'error',
                                              ms: Number(data.ms),
                                              summary: String(
                                                  data.summary ?? ''
                                              ),
                                          }
                                        : t
                                ),
                            }));
                        } else if (event === 'done') {
                            patchLast(m => ({
                                ...m,
                                id: String(data.assistantMessageId ?? m.id),
                                status: 'complete',
                                truncated: data.stopReason === 'max_tokens',
                            }));
                            if (data.remaining)
                                setRemaining(data.remaining as AgentRemaining);
                        } else if (event === 'error') {
                            throw new TurnFrameError(
                                String(data.code ?? 'server_error')
                            );
                        }
                    }
                }
                setStatus('idle');
            } catch (e) {
                // A newer call already replaced this one (double submit, fast retry):
                // its snapshot/status are the live ones, so a late failure here must not
                // restore a stale transcript over the newer turn. The `finally` below still
                // releases THIS call's stream (local `controller`, never the newer one).
                if (controllerRef.current !== controller) return;
                if (e instanceof TurnFrameError) {
                    // The turn reported a failure after already streaming (partial
                    // text may exist, and a partial assistant row may already be
                    // persisted server-side) — surface it as a failed bubble plus a
                    // code the shell can turn into copy/action (spec §8). `retry()`
                    // maps this kind to `regenerate()`.
                    lastErrorKindRef.current = 'turn';
                    patchLast(m => ({ ...m, status: 'error' }));
                    setStatus('error');
                    setError(
                        isAgentClientErrorCode(e.code) ? e.code : 'server_error'
                    );
                } else if (e instanceof HttpError) {
                    // Never started — nothing was persisted server-side, so the
                    // screen must not show anything this call changed: restore the
                    // EXACT pre-mutation transcript rather than slicing off a fixed
                    // count. Slicing only undid the bubbles `run` itself pushed and
                    // left `edit`'s truncation / `regenerate`'s dropped answer in
                    // place — a contended lock (409) on Edit made the original
                    // message and everything after it vanish from the screen even
                    // though the server deleted nothing. `retry()` re-adds the
                    // user's intent via `send`/`edit` rather than `regenerate`
                    // (which would either 400 on a conversation the server never
                    // created, or supersede the PREVIOUS answer and re-ask the OLD
                    // question).
                    lastErrorKindRef.current = 'http';
                    updateMessages(() => restoreSnapshot);
                    setStatus('error');
                    setError(
                        isAgentClientErrorCode(e.code) ? e.code : 'server_error'
                    );
                } else {
                    // Either the caller aborted (stop button / unmount) or the
                    // connection dropped mid-stream — both cases keep whatever
                    // partial text/tools already streamed and just mark it
                    // aborted rather than discarding progress or blaming the user.
                    lastErrorKindRef.current = null;
                    patchLast(m => ({ ...m, status: 'aborted' }));
                    setStatus('idle');
                }
            } finally {
                // Release the response body on every exit path — the buffer-cap
                // and turn-stage-error throws happen mid-loop with the reader
                // still locked and the server still streaming into a buffer
                // nobody reads; without this the connection (and the server's
                // slot for it) never closes. Aborting the LOCAL `controller` (not
                // `controllerRef.current`, which a newer overlapping call may
                // already have replaced) never cross-cancels a different call.
                controller.abort();
                void reader?.cancel().catch(() => {});
            }
        },
        [conversationId, patchLast, updateMessages]
    );

    const send = useCallback(
        (message: string) => {
            const snapshot = messagesRef.current;
            updateMessages(prev => [
                ...prev,
                {
                    id: `local-${Date.now()}`,
                    role: 'user',
                    content: message,
                    tools: [],
                    status: 'complete',
                },
            ]);
            return run({ action: 'send', message }, true, snapshot);
        },
        [run, updateMessages]
    );
    const regenerate = useCallback(() => {
        const snapshot = messagesRef.current;
        updateMessages(prev =>
            prev[prev.length - 1]?.role === 'assistant'
                ? prev.slice(0, -1)
                : prev
        );
        return run({ action: 'regenerate' }, false, snapshot);
    }, [run, updateMessages]);
    const edit = useCallback(
        (seq: number, message: string) => {
            const snapshot = messagesRef.current;
            updateMessages(prev => {
                const index = prev.findIndex(m => m.seq === seq);
                return [
                    ...(index >= 0 ? prev.slice(0, index) : prev),
                    {
                        id: `local-${Date.now()}`,
                        role: 'user',
                        content: message,
                        tools: [],
                        status: 'complete',
                    },
                ];
            });
            return run(
                { action: 'edit', editSeq: seq, message },
                true,
                snapshot
            );
        },
        [run, updateMessages]
    );
    const stop = useCallback(() => controllerRef.current?.abort(), []);

    /**
     * Replays the failed call for the banner's "재시도" button. HTTP-stage
     * failures (nothing persisted) replay via `send`/`edit` so the user's
     * text isn't lost and no turn is burned on the wrong question; only a
     * turn-stage `TurnFrameError` (a partial row was actually saved) maps to
     * `regenerate()`.
     */
    const retry = useCallback((): Promise<void> | undefined => {
        if (lastErrorKindRef.current === 'turn') return regenerate();
        const body = lastBodyRef.current;
        if (!body) return regenerate();
        if (body.action === 'send') return send(String(body.message ?? ''));
        if (body.action === 'edit')
            return edit(Number(body.editSeq), String(body.message ?? ''));
        return run({ action: 'regenerate' }, false, messagesRef.current);
    }, [regenerate, send, edit, run]);

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
