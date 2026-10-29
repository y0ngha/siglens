import { startTransition } from 'react';
import type { AgentRemaining } from '@y0ngha/siglens-core';
import {
    AGENT_TIME_ZONE_HEADER,
    ANALYSIS_LOCALE_HEADER,
    splitLocalePath,
} from '@/shared/i18n/locales';
import { parseSseFrame, splitFrames } from '@/shared/lib/sse/parseSseFrames';
import type { AgentStreamStatus, AgentUiMessage } from '../model/types';
import { HttpError, TurnFrameError } from './agentStreamErrors';
import {
    abortStreamingMessage,
    patchLastMessage,
    withDone,
    withText,
    withToolEnded,
    withToolStarted,
    withUserSeq,
} from './agentStreamFrames';
import { browserTimeZone } from './browserTimeZone';
import {
    isAgentClientErrorCode,
    type AgentClientErrorCode,
} from './errorCodes';
import { cancelFrame, scheduleFrame, type FrameHandle } from './frameScheduler';
import { localMessageId } from './optimisticMessages';

/**
 * A delimiter-less stream (proxy strips blank lines, provider hangs mid
 * write) must not let `buffer` grow forever between reads — that's an
 * unbounded string held in a component that keeps re-scanning it from
 * scratch every chunk. 1MB is far past any real turn's frame size.
 */
export const MAX_BUFFER_CHARS = 1_000_000;

/** Which failure `retry()` reacts to; only a turn-stage failure persisted a partial row. */
export type AgentFailureKind = 'http' | 'turn' | null;

/**
 * Everything one turn reads and writes, passed explicitly so the turn can run
 * (and be tested) outside the hook that owns the state (REACT.md#HK-2).
 */
export interface AgentTurnContext {
    readonly conversationId: string | null;
    /** This call's own controller; aborting it never cancels a newer call. */
    readonly controller: AbortController;
    /** False once a newer call has replaced this one; a stale call must not touch shared state. */
    readonly isCurrent: () => boolean;
    readonly setMessages: (
        update: (prev: AgentUiMessage[]) => AgentUiMessage[]
    ) => void;
    readonly setStatus: (status: AgentStreamStatus) => void;
    readonly setError: (error: AgentClientErrorCode | null) => void;
    readonly setRemaining: (remaining: AgentRemaining) => void;
    /** The server assigned a (new) conversation id; `title` may be `''`. */
    readonly onConversationAssigned: (id: string, title: string) => void;
    readonly setFailureKind: (kind: AgentFailureKind) => void;
}

/** What to send and how to undo the caller's optimistic change if the request never starts. */
export interface AgentTurnRequest {
    readonly body: Record<string, unknown>;
    /** The caller appended a user bubble that `meta`'s `userMessageSeq` belongs to. */
    readonly addsUserBubble: boolean;
    /**
     * Transcript exactly as it was before the caller's optimistic mutation —
     * restored verbatim on an `HttpError`: nothing was persisted, so nothing
     * may stay truncated or dropped on screen.
     */
    readonly restoreSnapshot: AgentUiMessage[];
}

/** Narrows a wire code to the closed union; anything unknown shows as `server_error`. */
function clientErrorCode(code: string): AgentClientErrorCode {
    return isAgentClientErrorCode(code) ? code : 'server_error';
}

async function postTurn(
    ctx: AgentTurnContext,
    body: Record<string, unknown>
): Promise<ReadableStreamDefaultReader<string>> {
    const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [ANALYSIS_LOCALE_HEADER]: splitLocalePath(window.location.pathname)
                .locale,
            [AGENT_TIME_ZONE_HEADER]: browserTimeZone(),
        },
        body: JSON.stringify({ conversationId: ctx.conversationId, ...body }),
        signal: ctx.controller.signal,
    });
    if (!response.ok || response.body === null) {
        const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new HttpError(payload.error ?? `http_${response.status}`);
    }
    return response.body.pipeThrough(new TextDecoderStream()).getReader();
}

/**
 * Runs one streamed agent turn: posts it, appends a pending assistant bubble,
 * folds every SSE frame into that bubble and settles status/error at the end.
 *
 * - `text` deltas are batched to one transition per animation frame. Calling
 *   `setMessages` per delta ran a default-priority render per delta, each
 *   re-parsing the growing markdown answer and competing with Composer typing.
 *   Structural frames (tool start/end, done, error, abort) flush first and
 *   synchronously, because they read the text so far (the draft decision).
 * - A turn-stage `error` frame keeps the partial bubble, marked failed.
 * - An HTTP-stage failure restores `restoreSnapshot`.
 * - An abort (stop, unmount) or a dropped connection keeps what streamed and
 *   marks the bubble aborted, with no error banner.
 * - A call that a newer one replaced only marks its own bubble aborted.
 */
export async function runAgentTurn(
    ctx: AgentTurnContext,
    request: AgentTurnRequest
): Promise<void> {
    const { controller } = ctx;
    const pendingId = localMessageId('pending');
    let reader: ReadableStreamDefaultReader<string> | undefined;
    let pendingText = '';
    let frame: FrameHandle | null = null;
    const flushText = (urgent: boolean): void => {
        if (frame !== null) {
            cancelFrame(frame);
            frame = null;
        }
        if (pendingText === '') return;
        const delta = pendingText;
        pendingText = '';
        // 더 새 호출이 이미 자리를 차지했으면 그쪽 말풍선에 붙이지 않고 버린다.
        if (!ctx.isCurrent()) return;
        const apply = (): void =>
            ctx.setMessages(prev =>
                patchLastMessage(prev, m => withText(m, delta))
            );
        if (urgent) apply();
        else startTransition(apply);
    };
    const queueText = (delta: string): void => {
        pendingText += delta;
        if (frame === null)
            frame = scheduleFrame(() => {
                frame = null;
                flushText(false);
            });
    };
    const patchLast = (fn: (m: AgentUiMessage) => AgentUiMessage): void =>
        ctx.setMessages(prev => patchLastMessage(prev, fn));

    ctx.setStatus('streaming');
    ctx.setError(null);
    ctx.setMessages(prev => [
        ...prev,
        {
            id: pendingId,
            role: 'assistant',
            content: '',
            tools: [],
            status: 'streaming',
        },
    ]);
    try {
        reader = await postTurn(ctx, request.body);
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
                if (event === 'text') {
                    queueText(String(data.delta ?? ''));
                    continue;
                }
                flushText(true);
                if (event === 'meta') {
                    if (
                        typeof data.conversationId === 'string' &&
                        data.conversationId !== ctx.conversationId
                    )
                        ctx.onConversationAssigned(
                            data.conversationId,
                            String(data.title ?? '')
                        );
                    if (
                        request.addsUserBubble &&
                        typeof data.userMessageSeq === 'number'
                    ) {
                        const seq = data.userMessageSeq;
                        ctx.setMessages(prev => withUserSeq(prev, seq));
                    }
                } else if (event === 'tool_start') {
                    patchLast(m => withToolStarted(m, data));
                } else if (event === 'tool_end') {
                    patchLast(m => withToolEnded(m, data));
                } else if (event === 'done') {
                    patchLast(m => withDone(m, data));
                    if (data.remaining)
                        ctx.setRemaining(data.remaining as AgentRemaining);
                } else if (event === 'error') {
                    throw new TurnFrameError(
                        String(data.code ?? 'server_error')
                    );
                }
            }
        }
        flushText(true);
        ctx.setStatus('idle');
    } catch (e) {
        if (!ctx.isCurrent()) {
            // A newer call already replaced this one (double submit, fast retry):
            // its snapshot/status are the live ones, so this late failure must not
            // restore a stale transcript over the newer turn. Only this call's own
            // bubble is settled — it is no longer last, and would otherwise keep
            // a streaming state forever.
            ctx.setMessages(prev => abortStreamingMessage(prev, pendingId));
            return;
        }
        // 중단·오류여도 이미 받은 글은 남긴다(아래 상태 표시보다 먼저 반영).
        flushText(true);
        if (e instanceof TurnFrameError) {
            // The turn reported a failure after already streaming (partial text
            // may exist, and a partial assistant row may already be persisted
            // server-side) — a failed bubble plus a code the shell turns into
            // copy/action. `retry()` maps this kind to `regenerate()`.
            ctx.setFailureKind('turn');
            patchLast(m => ({ ...m, status: 'error' }));
            ctx.setStatus('error');
            ctx.setError(clientErrorCode(e.code));
        } else if (e instanceof HttpError) {
            // Never started — nothing was persisted server-side, so the screen
            // must not show anything this call changed: restore the EXACT
            // pre-mutation transcript rather than slicing off a fixed count.
            // Slicing only undid the bubbles this call pushed and left `edit`'s
            // truncation / `regenerate`'s dropped answer in place. `retry()`
            // re-adds the user's intent via `send`/`edit` rather than
            // `regenerate` (which would either 400 on a conversation the server
            // never created, or supersede the PREVIOUS answer and re-ask the OLD
            // question).
            ctx.setFailureKind('http');
            ctx.setMessages(() => request.restoreSnapshot);
            ctx.setStatus('error');
            ctx.setError(clientErrorCode(e.code));
        } else {
            // The caller aborted (stop button / unmount) or the connection
            // dropped mid-stream — keep whatever partial text/tools already
            // streamed and mark it aborted rather than discarding progress or
            // blaming the user.
            ctx.setFailureKind(null);
            patchLast(m => ({ ...m, status: 'aborted' }));
            ctx.setStatus('idle');
        }
    } finally {
        // Release the response body on every exit path — the buffer-cap and
        // turn-stage-error throws happen mid-loop with the reader still locked
        // and the server still streaming into a buffer nobody reads; without
        // this the connection (and the server's slot for it) never closes.
        // Aborting the LOCAL controller never cross-cancels a newer call.
        controller.abort();
        void reader?.cancel().catch(() => {});
        // 반영되지 않은 프레임 예약이 남았으면 거둔다(언마운트 뒤 setState 방지).
        if (frame !== null) cancelFrame(frame);
    }
}
