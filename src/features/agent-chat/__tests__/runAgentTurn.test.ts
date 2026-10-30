import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MAX_BUFFER_CHARS,
    runAgentTurn,
    type AgentFailureKind,
    type AgentTurnContext,
} from '@/features/agent-chat/lib/runAgentTurn';
import type {
    AgentStreamStatus,
    AgentUiMessage,
} from '@/features/agent-chat/model/types';

interface FakeTurn {
    readonly ctx: AgentTurnContext;
    readonly state: {
        messages: AgentUiMessage[];
        status: AgentStreamStatus | null;
        error: string | null;
        failureKind: AgentFailureKind | undefined;
    };
}

function fakeTurn(isCurrent: () => boolean = () => true): FakeTurn {
    const state: FakeTurn['state'] = {
        messages: [],
        status: null,
        error: null,
        failureKind: undefined,
    };
    const ctx: AgentTurnContext = {
        conversationId: 'c1',
        controller: new AbortController(),
        isCurrent,
        setMessages: update => {
            state.messages = update(state.messages);
        },
        setStatus: status => {
            state.status = status;
        },
        setError: error => {
            state.error = error;
        },
        setRemaining: () => {},
        onConversationAssigned: () => {},
        setFailureKind: kind => {
            state.failureKind = kind;
        },
    };
    return { ctx, state };
}

function request(restoreSnapshot: AgentUiMessage[] = []) {
    return { body: {}, addsUserBubble: false, restoreSnapshot };
}

function sse(frames: string[]): Response {
    const body = new ReadableStream<Uint8Array>({
        start(c) {
            for (const f of frames)
                c.enqueue(new TextEncoder().encode(`${f}\n\n`));
            c.close();
        },
    });
    return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
    });
}

function userBubble(): AgentUiMessage {
    return {
        id: 'u1',
        role: 'user',
        content: 'AAPL?',
        tools: [],
        status: 'complete',
    };
}

// 이 파일은 node 레인에서 돌아 `window`가 없다 — postTurn이 읽는 경로만 심는다.
beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/ko/ai' } });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('runAgentTurn', () => {
    it('ends a normal stream with the assistant bubble complete and status idle', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: text\ndata: {"delta":"231"}',
                'event: text\ndata: {"delta":".42"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { ctx, state } = fakeTurn();

        await runAgentTurn(ctx, request());

        expect(state.status).toBe('idle');
        expect(state.messages).toHaveLength(1);
        expect(state.messages[0]).toMatchObject({
            role: 'assistant',
            content: '231.42',
            status: 'complete',
        });
    });

    it('maps an HttpError to failure kind http, the error code and the restored snapshot', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ error: 'rate_limited' }), {
                status: 429,
            })
        );
        const { ctx, state } = fakeTurn();
        const snapshot = [userBubble()];

        await runAgentTurn(ctx, request(snapshot));

        expect(state.failureKind).toBe('http');
        expect(state.status).toBe('error');
        expect(state.error).toBe('rate_limited');
        expect(state.messages).toBe(snapshot);
    });

    it('maps an unknown HTTP error code to server_error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ error: 'no_such_code' }), {
                status: 500,
            })
        );
        const { ctx, state } = fakeTurn();

        await runAgentTurn(ctx, request());

        expect(state.error).toBe('server_error');
    });

    it('maps an error frame to failure kind turn and keeps the partial bubble marked error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: text\ndata: {"delta":"partial"}',
                'event: error\ndata: {"code":"rate_limited"}',
            ])
        );
        const { ctx, state } = fakeTurn();

        await runAgentTurn(ctx, request());

        expect(state.failureKind).toBe('turn');
        expect(state.status).toBe('error');
        expect(state.error).toBe('rate_limited');
        expect(state.messages[0]).toMatchObject({
            content: 'partial',
            status: 'error',
        });
    });

    it('treats a delimiter-less buffer over MAX_BUFFER_CHARS as a turn-stage server_error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                new ReadableStream<Uint8Array>({
                    start(c) {
                        c.enqueue(
                            new TextEncoder().encode(
                                'x'.repeat(MAX_BUFFER_CHARS + 1)
                            )
                        );
                    },
                }),
                { status: 200 }
            )
        );
        const { ctx, state } = fakeTurn();

        await runAgentTurn(ctx, request());

        expect(state.failureKind).toBe('turn');
        expect(state.status).toBe('error');
        expect(state.error).toBe('server_error');
    });

    it('marks only its own bubble aborted when a newer call replaced it', async () => {
        let current = true;
        const { ctx, state } = fakeTurn(() => current);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            current = false;
            state.messages = [
                ...state.messages,
                {
                    id: 'newer',
                    role: 'assistant',
                    content: '',
                    tools: [],
                    status: 'streaming',
                },
            ];
            return new Response(JSON.stringify({ error: 'rate_limited' }), {
                status: 429,
            });
        });
        const snapshot = [userBubble()];

        await runAgentTurn(ctx, request(snapshot));

        expect(state.messages.map(m => [m.id === 'newer', m.status])).toEqual([
            [false, 'aborted'],
            [true, 'streaming'],
        ]);
        expect(state.error).toBeNull();
        expect(state.failureKind).toBeUndefined();
    });
});
