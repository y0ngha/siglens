import 'server-only';
import type { AgentTurnEvent } from '@y0ngha/siglens-core';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';

/** Typed turn failure so the writer emits `{code}` instead of a generic server_error. */
export class AgentTurnError extends Error {
    constructor(readonly code: string) {
        super(code);
        this.name = 'AgentTurnError';
    }
}

export interface AgentEventStreamOptions<
    TDone extends Record<string, unknown>,
> {
    meta: Record<string, unknown>;
    work: (emit: (event: AgentTurnEvent) => void) => Promise<TDone>;
    /** Client disconnected — abort the provider/tool signal (never the fresh analysis, spec §6-3). */
    onAbort: () => void;
}

const frame = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * Incremental SSE writer for agent turns. `heartbeatStream` carries one promise
 * and emits only open/heartbeat/done/error, so it cannot stream tokens (spec §2-11).
 * The `[agent-stream] failed:` marker feeds the CloudWatch filter (07-alarms.sh).
 */
export function agentEventStream<TDone extends Record<string, unknown>>(
    options: AgentEventStreamOptions<TDone>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let release: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (text: string): void => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(text));
                } catch {
                    closed = true;
                }
            };
            const finish = (): void => {
                if (timer !== undefined) clearInterval(timer);
                release?.();
                if (!closed) {
                    closed = true;
                    try {
                        controller.close();
                    } catch {
                        /* already closed */
                    }
                }
            };
            send(frame('meta', options.meta));
            release = registerActiveStream();
            timer = setInterval(
                () => send('event: heartbeat\ndata: {}\n\n'),
                HEARTBEAT_INTERVAL_MS
            );
            options
                .work(event => {
                    const { type, ...data } = event;
                    send(frame(type, data));
                })
                .then(
                    done => {
                        send(frame('done', done));
                        finish();
                    },
                    (error: unknown) => {
                        // `error.message` for anything other than `AgentTurnError` can be a raw
                        // driver error (e.g. a `DrizzleQueryError` embeds the failed SQL plus bound
                        // params — conversationId/userId/the user's own message text) — never put it
                        // in the client-visible frame. `AgentTurnError`'s own message is just its
                        // `code` (see the constructor above), so it is already safe to echo.
                        //
                        // `[agent-stream] failed:` is the CloudWatch alarm marker (07-alarms.sh) —
                        // it must fire only for genuine infra/bug failures, not ordinary domain
                        // outcomes (user hit Stop → `aborted`, daily quota → `turn_limit`, etc.),
                        // or ordinary quota exhaustion pages someone once the agent filter lands.
                        if (error instanceof AgentTurnError) {
                            console.warn(
                                '[agent-stream] turn failed:',
                                error.code
                            );
                            send(
                                frame('error', {
                                    code: error.code,
                                    message: error.code,
                                })
                            );
                        } else {
                            console.error('[agent-stream] failed:', error);
                            send(
                                frame('error', {
                                    code: 'server_error',
                                    message: 'server_error',
                                })
                            );
                        }
                        finish();
                    }
                );
        },
        cancel() {
            // Client disconnected. Reclaim the heartbeat timer and abort the in-flight
            // turn's signal immediately, but do NOT release the drain-counter slot here —
            // `work`'s partial-save INSERT (the aborted assistant row) is very likely still
            // running, and a SIGTERM drain that samples the counter right after this cancel
            // fires must not see 0 while that write is in flight. `finish()` — reached only
            // once `work` itself settles — releases exactly once (mirrors `heartbeatStream`'s
            // cancel(), which deliberately does not decrement either).
            closed = true;
            if (timer !== undefined) clearInterval(timer);
            options.onAbort();
        },
    });
}
