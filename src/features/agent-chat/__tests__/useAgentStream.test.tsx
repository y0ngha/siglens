import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import {
    fromViews,
    useAgentStream,
} from '@/features/agent-chat/hooks/useAgentStream';

const trackAdsConversion = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/googleAds', () => ({ trackAdsConversion }));

function view(
    seq: number,
    role: ChatMessageView['role'],
    content: string
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role,
        content,
        toolCalls: null,
        toolName: null,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
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

/** A stream that emits some frames, then the underlying reader rejects — simulates a dropped connection (no `error` SSE frame, no abort). */
function droppedSse(frames: string[]): Response {
    const body = new ReadableStream<Uint8Array>({
        start(c) {
            for (const f of frames)
                c.enqueue(new TextEncoder().encode(`${f}\n\n`));
        },
        pull() {
            throw new TypeError('network drop');
        },
    });
    return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
    });
}

afterEach(() => vi.restoreAllMocks());

function toolCallsView(
    seq: number,
    toolCalls: { id: string; name: string; args: Record<string, unknown> }[]
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role: 'assistant',
        content: '',
        toolCalls,
        toolName: null,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
}

function toolResultView(
    seq: number,
    toolName: string | null,
    content: string
): ChatMessageView {
    return {
        id: `m${seq}`,
        seq,
        role: 'tool',
        content,
        toolCalls: null,
        toolName,
        status: 'complete',
        createdAt: new Date(2026, 0, 1).toISOString(),
    };
}

describe('fromViews', () => {
    it('drops a tool row that has no preceding assistant bubble to attach to', () => {
        expect(fromViews([toolResultView(1, 'get_quote', 'result')])).toEqual(
            []
        );
    });

    it('a tool row with no matching tool call by name is appended as a new chip (not merged)', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            toolResultView(2, 'weird', 'result'),
        ]);
        expect(out[0]!.tools.map(t => [t.name, t.summary])).toEqual([
            ['search', undefined],
            ['weird', 'result'],
        ]);
    });

    it('a tool row with a null toolName falls back to the literal name "tool", both when matching and when pushed fresh', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            toolResultView(2, null, 'result'),
        ]);
        // No existing call named "tool" — pushed as a new chip named "tool".
        expect(out[0]!.tools.map(t => [t.name, t.summary])).toEqual([
            ['search', undefined],
            ['tool', 'result'],
        ]);
    });

    it('a second empty-content assistant tool-call bubble merges an aborted status', () => {
        const out = fromViews([
            toolCallsView(1, [{ id: 't1', name: 'search', args: {} }]),
            {
                id: 'm2',
                seq: 2,
                role: 'assistant',
                content: 'partial answer',
                toolCalls: null,
                toolName: null,
                status: 'aborted',
                createdAt: new Date(2026, 0, 1).toISOString(),
            },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]!.content).toBe('partial answer');
        expect(out[0]!.status).toBe('aborted');
    });

    it('a standalone aborted assistant row (no merge) keeps the aborted status', () => {
        const out = fromViews([
            {
                id: 'm1',
                seq: 1,
                role: 'assistant',
                content: 'partial',
                toolCalls: null,
                toolName: null,
                status: 'aborted',
                createdAt: new Date(2026, 0, 1).toISOString(),
            },
        ]);
        expect(out).toEqual([
            expect.objectContaining({ content: 'partial', status: 'aborted' }),
        ]);
    });
});

describe('useAgentStream', () => {
    it('send records one chatQuestion conversion; regenerate records none', async () => {
        trackAdsConversion.mockClear();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1"}',
                'event: text\ndata: {"delta":"ok"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('AAPL?');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(trackAdsConversion).toHaveBeenCalledTimes(1);
        expect(trackAdsConversion).toHaveBeenCalledWith('chatQuestion');
    });

    it('send: optimistic user -> tool chips -> accumulated text -> done', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1","model":"deepseek-v4.1-flash"}',
                'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["AAPL"]}}',
                'event: tool_end\ndata: {"id":"t1","name":"get_quote","status":"ok","ms":12,"summary":"{}"}',
                'event: text\ndata: {"delta":"231"}',
                'event: text\ndata: {"delta":".42"}',
                'event: done\ndata: {"assistantMessageId":"m2","remaining":{"turns":59,"fresh":6,"search":5},"stopReason":"end"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('AAPL?');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.conversationId).toBe('c1');
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([
            ['user', 'AAPL?'],
            ['assistant', '231.42'],
        ]);
        expect(result.current.messages[1]!.tools).toEqual([
            {
                id: 't1',
                name: 'get_quote',
                args: { symbols: ['AAPL'] },
                status: 'ok',
                ms: 12,
                summary: '{}',
            },
        ]);
        expect(result.current.remaining).toEqual({
            turns: 59,
            fresh: 6,
            search: 5,
        });
        const [, init] = (
            fetch as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.find(
            call => (call[0] as string) === '/api/ai/chat/stream'
        )!;
        expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
            action: 'send',
            message: 'AAPL?',
        });
    });

    it('narration streamed before a tool call is dropped; only text after the tools becomes the answer', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1","model":"deepseek-v4.1-flash"}',
                'event: text\ndata: {"delta":"I\'ll fetch the quote first."}',
                'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["AAPL"]}}',
                'event: tool_end\ndata: {"id":"t1","name":"get_quote","status":"ok","ms":12,"summary":"{}"}',
                'event: text\ndata: {"delta":"231.42"}',
                'event: done\ndata: {"assistantMessageId":"m2","stopReason":"end"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('AAPL?');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const assistant = result.current.messages[1]!;
        expect(assistant.content).toBe('231.42');
        expect(assistant.tools.map(t => t.name)).toEqual(['get_quote']);
        // Short narration is dropped, never kept as a draft.
        expect(assistant.draft).toBeUndefined();
    });

    it('an answer the model abandons for more tools stays visible as a draft until the new text arrives, then disappears', async () => {
        const encoder = new TextEncoder();
        let push!: (frame: string) => void;
        let close!: () => void;
        const body = new ReadableStream<Uint8Array>({
            start(c) {
                push = f => c.enqueue(encoder.encode(`${f}\n\n`));
                close = () => c.close();
            },
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(body, {
                status: 200,
                headers: { 'content-type': 'text/event-stream' },
            })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('삼성전자 최근 분석 요약해줘');
        });
        const draft =
            '삼성전자 최근 분석을 요약하면 장기 추세는 우호적이지만 중기 조정 국면입니다. 삼성전자 최근 분석을 요약하면 장기 추세는 우호적이지만 중기 조정 국면입니다. 삼성전자 최근 분석을 요약하면 장기 추세는 우호적이지만 중기 조정 국면입니다. ';
        push(`event: text\ndata: ${JSON.stringify({ delta: draft })}`);
        push(
            'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["005930.KS"]}}'
        );
        await waitFor(() =>
            expect(result.current.messages[1]!.draft).toBe(draft)
        );
        expect(result.current.messages[1]!.content).toBe('');
        push('event: text\ndata: {"delta":"새 답변"}');
        push(
            'event: done\ndata: {"assistantMessageId":"m2","stopReason":"end"}'
        );
        close();
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages[1]!.content).toBe('새 답변');
        expect(result.current.messages[1]!.draft).toBeUndefined();
    });

    it('SSE error frame -> status error + code, without touching top-level status text', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {}',
                'event: error\ndata: {"code":"turn_limit","message":"turn_limit"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('turn_limit'));
        expect(result.current.status).toBe('error');
    });

    it('HTTP 401 -> error unauthenticated, both optimistic bubbles are dropped (nothing was persisted)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'unauthenticated' }, { status: 401 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() =>
            expect(result.current.error).toBe('unauthenticated')
        );
        expect(result.current.messages).toEqual([]);
    });

    it('HTTP 503 server_busy surfaces the same way as other HTTP-stage codes', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 503 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));
    });

    it('network drop mid-stream keeps the partial text and marks the bubble aborted, no error banner', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            droppedSse([
                'event: meta\ndata: {}',
                'event: text\ndata: {"delta":"partial"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.error).toBeNull();
        const assistant = result.current.messages.at(-1)!;
        expect(assistant.content).toBe('partial');
        expect(assistant.status).toBe('aborted');
    });

    it('narration, then a tool call, then the connection drops: the bubble keeps the tool chips, an empty body and the aborted status (no narration resurrected)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            droppedSse([
                'event: meta\ndata: {}',
                'event: text\ndata: {"delta":"I\'ll fetch the quote first."}',
                'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["AAPL"]}}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const assistant = result.current.messages.at(-1)!;
        expect(assistant.content).toBe('');
        expect(assistant.tools.map(t => [t.name, t.status])).toEqual([
            ['get_quote', 'running'],
        ]);
        expect(assistant.status).toBe('aborted');
        expect(result.current.error).toBeNull();
    });

    it('stop aborts the fetch and marks the streaming bubble aborted', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            () => new Promise(() => {})
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        act(() => result.current.stop());
        expect(abort).toHaveBeenCalled();
    });

    it('attaches the server-confirmed seq to the optimistic user bubble so Edit is available immediately after send', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageSeq":7}',
                'event: text\ndata: {"delta":"hi"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages[0]!.seq).toBe(7);
    });

    it('caps the receive buffer so a delimiter-less stream cannot grow without bound', async () => {
        const body = new ReadableStream<Uint8Array>({
            start(c) {
                c.enqueue(new TextEncoder().encode('x'.repeat(1_050_000)));
                c.close();
            },
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(body, {
                status: 200,
                headers: { 'content-type': 'text/event-stream' },
            })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.error).toBe('server_error');
    });

    it('retry after a new-conversation HTTP failure resends the same text as action:send with conversationId:null, and the bubble reappears exactly once', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce(
            Response.json({ error: 'server_busy' }, { status: 503 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('AAPL?');
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));
        // Nothing was persisted server-side — neither bubble should linger.
        expect(result.current.messages).toEqual([]);

        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageSeq":1}',
                'event: text\ndata: {"delta":"hi"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([
            ['user', 'AAPL?'],
            ['assistant', 'hi'],
        ]);
        expect(
            result.current.messages.filter(m => m.role === 'user')
        ).toHaveLength(1);
        const secondCallBody = JSON.parse(
            (fetchMock.mock.lastCall![1] as RequestInit).body as string
        );
        expect(secondCallBody).toMatchObject({
            conversationId: null,
            action: 'send',
            message: 'AAPL?',
        });
    });

    it('retry after an existing-conversation HTTP failure resends via action:send, never regenerate', async () => {
        trackAdsConversion.mockClear();
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce(
            Response.json({ error: 'conversation_full' }, { status: 409 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('new question');
        });
        await waitFor(() =>
            expect(result.current.error).toBe('conversation_full')
        );

        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m1"}',
            ])
        );
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const secondCallBody = JSON.parse(
            (fetchMock.mock.lastCall![1] as RequestInit).body as string
        );
        expect(secondCallBody.action).toBe('send');
        expect(secondCallBody.message).toBe('new question'); // The replay re-asks the same question — one ad conversion, not two.
        expect(trackAdsConversion).toHaveBeenCalledTimes(1);
    });

    it('retry after a turn-stage error (deadline) calls regenerate, not send', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {}',
                'event: error\ndata: {"code":"deadline"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(result.current.error).toBe('deadline'));

        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const secondCallBody = JSON.parse(
            (fetchMock.mock.lastCall![1] as RequestInit).body as string
        );
        expect(secondCallBody.action).toBe('regenerate');
    });

    it('edit on an existing conversation: an HTTP failure restores all original messages, no duplicate, no truncation', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const initialMessages = [
            view(1, 'user', 'q1'),
            view(2, 'assistant', 'a1'),
            view(3, 'user', 'q2'),
            view(4, 'assistant', 'a2'),
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.edit(1, 'edited q1');
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));
        // Nothing was persisted server-side (409 before any DB write) — the
        // original 4 messages must still be exactly what's on screen.
        expect(
            result.current.messages.map(m => [m.seq, m.role, m.content])
        ).toEqual([
            [1, 'user', 'q1'],
            [2, 'assistant', 'a1'],
            [3, 'user', 'q2'],
            [4, 'assistant', 'a2'],
        ]);
    });

    it('retry after a failed edit replays the same edit (action:edit), not send or regenerate', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const initialMessages = [
            view(1, 'user', 'q1'),
            view(2, 'assistant', 'a1'),
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.edit(1, 'edited q1');
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));

        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m3"}',
            ])
        );
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const secondCallBody = JSON.parse(
            (fetchMock.mock.lastCall![1] as RequestInit).body as string
        );
        expect(secondCallBody).toMatchObject({
            action: 'edit',
            editSeq: 1,
            message: 'edited q1',
        });
    });

    it('regenerate: an HTTP failure restores the previous assistant answer', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const initialMessages = [
            view(1, 'user', 'q1'),
            view(2, 'assistant', 'a1'),
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([
            ['user', 'q1'],
            ['assistant', 'a1'],
        ]);
    });

    it('retry after a failed non-guest regenerate replays action:regenerate (not send, not edit)', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const initialMessages = [
            view(1, 'user', 'q1'),
            view(2, 'assistant', 'a1'),
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));

        fetchMock.mockResolvedValueOnce(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m3"}',
            ])
        );
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const secondCallBody = JSON.parse(
            (fetchMock.mock.lastCall![1] as RequestInit).body as string
        );
        expect(secondCallBody.action).toBe('regenerate');
    });

    it('non-guest regenerate on a transcript that does not end on an assistant answer leaves the transcript untouched (no slice)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const initialMessages = [view(1, 'user', 'q1')];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        // Nothing was sliced off — the original user message is still there,
        // followed by the freshly regenerated answer.
        expect(result.current.messages[0]).toMatchObject({
            role: 'user',
            content: 'q1',
        });
    });

    it('guest regenerate with no prior question in the transcript is a no-op (never calls fetch)', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        await act(async () => {
            await result.current.regenerate();
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.current.messages).toEqual([]);
    });

    it('editing with a seq that matches no on-screen message appends the new question instead of truncating anything', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m3"}',
            ])
        );
        const initialMessages = [
            view(1, 'user', 'q1'),
            view(2, 'assistant', 'a1'),
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages })
        );
        act(() => {
            void result.current.edit(999, 'unmatched edit');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([
            ['user', 'q1'],
            ['assistant', 'a1'],
            ['user', 'unmatched edit'],
            ['assistant', ''],
        ]);
    });

    it('send-path round-1 behavior still holds: both optimistic bubbles are dropped on an HTTP failure', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 503 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('server_busy'));
        expect(result.current.messages).toEqual([]);
    });

    it('releases the stream (aborts the controller and cancels the reader) when the buffer cap trips', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        const cancelSpy = vi.fn();
        const body = new ReadableStream<Uint8Array>({
            start(c) {
                c.enqueue(new TextEncoder().encode('x'.repeat(1_050_000)));
                // Deliberately never closes — an ever-growing, delimiter-less
                // stream is exactly the runaway case the cap exists for.
            },
            cancel(reason) {
                cancelSpy(reason);
            },
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(body, {
                status: 200,
                headers: { 'content-type': 'text/event-stream' },
            })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(abort).toHaveBeenCalled();
        expect(cancelSpy).toHaveBeenCalled();
    });

    it('guest: every send carries the answered transcript as history; regenerate re-sends the last question as send', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () =>
                sse([
                    'event: meta\ndata: {"conversationId":null,"userMessageId":null,"userMessageSeq":null}',
                    'event: text\ndata: {"delta":"답"}',
                    'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
                ])
            );
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void result.current.send('첫 질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.send('둘째 질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const bodyOf = (i: number) =>
            JSON.parse(String(fetchSpy.mock.calls[i]![1]!.body));
        expect(bodyOf(0)).toEqual({
            conversationId: null,
            action: 'send',
            message: '첫 질문',
            history: [],
        });
        expect(bodyOf(1).history).toEqual([
            { role: 'user', content: '첫 질문' },
            { role: 'assistant', content: '답' },
        ]);
        // No stored conversation was ever created for a guest.
        expect(result.current.conversationId).toBeNull();

        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(2)).toEqual({
            conversationId: null,
            action: 'send',
            message: '둘째 질문',
            history: [
                { role: 'user', content: '첫 질문' },
                { role: 'assistant', content: '답' },
            ],
        });
        expect(result.current.messages.map(m => m.content)).toEqual([
            '첫 질문',
            '답',
            '둘째 질문',
            '답',
        ]);
    });

    it('guest: retry after a failed regenerate replays the regenerate, not a second copy of the question', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                sse([
                    'event: text\ndata: {"delta":"답"}',
                    'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
                ])
            )
            .mockResolvedValueOnce(
                Response.json({ error: 'server_busy' }, { status: 503 })
            )
            .mockResolvedValueOnce(
                sse([
                    'event: text\ndata: {"delta":"새 답"}',
                    'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
                ])
            );
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void result.current.send('질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('error'));
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(result.current.messages.map(m => m.content)).toEqual([
            '질문',
            '새 답',
        ]);
    });

    it('guest answers keep distinct ids when the server sends an empty assistantMessageId', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
            sse([
                'event: text\ndata: {"delta":"답"}',
                'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void result.current.send('첫 질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.send('둘째 질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const ids = result.current.messages.map(m => m.id);
        expect(ids.every(id => id !== '')).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every request carries the browser time zone', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () =>
                sse([
                    'event: text\ndata: {"delta":"답"}',
                    'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
                ])
            );
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void result.current.send('첫 질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<
            string,
            string
        >;
        expect(headers['x-siglens-timezone']).toBe(
            Intl.DateTimeFormat().resolvedOptions().timeZone
        );
    });

    it('unmounting mid-stream aborts the in-flight fetch', () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            () => new Promise(() => {})
        );
        const { result, unmount } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        unmount();
        expect(abort).toHaveBeenCalled();
    });

    it('an HTTP-stage error response whose body is not valid JSON falls back to "http_<status>" instead of throwing out of the stream', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('not json at all', { status: 502 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('server_error'));
    });

    it('an HTTP-stage error body with no "error" field falls back to "http_<status>", which shows as the generic server_error code', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({}, { status: 500 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        // "http_500" isn't a recognized AgentClientErrorCode, so the shell
        // falls back to the generic code rather than showing nothing.
        await waitFor(() => expect(result.current.error).toBe('server_error'));
    });

    it('a malformed (non-JSON) SSE frame is skipped instead of crashing the stream', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: text\ndata: not valid json{{{',
                'event: text\ndata: {"delta":"ok"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.error).toBeNull();
        expect(result.current.messages.at(-1)!.content).toBe('ok');
    });

    it('a meta frame for a new conversation with no title reports an empty title, not a crash', async () => {
        const onConversationCreated = vi.fn();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c2"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                onConversationCreated,
            })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(onConversationCreated).toHaveBeenCalledWith('c2', '');
    });

    it('a repeated userMessageSeq on a later meta frame does not overwrite the seq already attached', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageSeq":5}',
                'event: meta\ndata: {"conversationId":"c1","userMessageSeq":6}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages[0]!.seq).toBe(5);
    });

    it('a text frame with no delta keeps the running content unchanged', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: text\ndata: {"delta":"ab"}',
                'event: text\ndata: {}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.at(-1)!.content).toBe('ab');
    });

    it('tool_start with no args defaults to an empty args object; with a numeric estimatedSeconds it is kept', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: tool_start\ndata: {"id":"t1","name":"get_quote"}',
                'event: tool_start\ndata: {"id":"t2","name":"slow_tool","estimatedSeconds":30}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const tools = result.current.messages.at(-1)!.tools;
        expect(tools[0]).toMatchObject({
            args: {},
            estimatedSeconds: undefined,
        });
        expect(tools[1]).toMatchObject({ estimatedSeconds: 30 });
    });

    it('tool_end for an id nobody started leaves the existing chips unchanged', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: tool_start\ndata: {"id":"t1","name":"get_quote"}',
                'event: tool_end\ndata: {"id":"unknown","status":"ok","ms":1,"summary":"s"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.at(-1)!.tools).toEqual([
            { id: 't1', name: 'get_quote', args: {}, status: 'running' },
        ]);
    });

    it('tool_end with a non-"ok" status and no summary marks the chip errored with an empty summary', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: tool_start\ndata: {"id":"t1","name":"get_quote"}',
                'event: tool_end\ndata: {"id":"t1","status":"failed","ms":3}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.at(-1)!.tools[0]).toMatchObject({
            status: 'error',
            summary: '',
        });
    });

    it('an unrecognized SSE event name is ignored', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: ping\ndata: {}',
                'event: text\ndata: {"delta":"ok"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.error).toBeNull();
        expect(result.current.messages.at(-1)!.content).toBe('ok');
    });

    it('a turn-stage error frame with no code falls back to server_error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse(['event: meta\ndata: {}', 'event: error\ndata: {}'])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('server_error'));
    });

    it('a turn-stage error frame with an unrecognized code degrades to server_error rather than showing nothing', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {}',
                'event: error\ndata: {"code":"totally_bogus"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('x');
        });
        await waitFor(() => expect(result.current.error).toBe('server_error'));
    });

    it('a stale call whose fetch settles after a newer overlapping call already finished leaves the newer result alone', async () => {
        let rejectFirst!: (e: unknown) => void;
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectFirst = reject;
                })
        );
        fetchMock.mockResolvedValueOnce(
            sse([
                'event: text\ndata: {"delta":"second"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            // Never resolves on its own — replaced by the second call below.
            void result.current.send('first');
        });
        act(() => {
            void result.current.send('second');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.at(-1)!.content).toBe('second');
        // The first call's fetch finally settles (network drop) well after
        // the second, newer call already completed — it must not clobber
        // the newer turn's state.
        await act(async () => {
            rejectFirst(new TypeError('late network drop'));
            await Promise.resolve();
        });
        expect(result.current.status).toBe('idle');
        expect(result.current.messages.at(-1)!.content).toBe('second');
    });

    /**
     * 후속 질문 마커 줄은 서버가 뗀다 — `done`이 최종 본문(`body`)과 칩 항목
     * (`followUps`)을 싣고, 클라이언트는 core 없이 그대로 쓴다.
     */
    it('done의 body·followUps로 최종 본문과 칩 항목을 맞춘다', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: meta\ndata: {"conversationId":"c1"}',
                'event: text\ndata: {"delta":"본문입니다.\\n\\n"}',
                'event: done\ndata: {"assistantMessageId":"m2","body":"본문입니다.","followUps":["실적은?",3,"뉴스는?"]}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const answer = result.current.messages.at(-1)!;
        expect(answer.content).toBe('본문입니다.');
        // 문자열이 아닌 항목은 버린다.
        expect(answer.followUps).toEqual(['실적은?', '뉴스는?']);
    });

    it('done에 body가 없으면(구버전 서버) 스트리밍된 본문을 그대로 두고 칩은 없다', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                'event: text\ndata: {"delta":"그대로"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.at(-1)!.content).toBe('그대로');
        expect(result.current.messages.at(-1)!.followUps).toEqual([]);
    });

    it('저장된 대화의 followUps(서버가 나눈 값)를 메시지에 싣는다', () => {
        const answer = {
            ...view(2, 'assistant', '본문'),
            followUps: ['A', 'B'],
        };
        expect(fromViews([view(1, 'user', 'q'), answer])[1]).toMatchObject({
            content: '본문',
            followUps: ['A', 'B'],
        });
    });

    /**
     * `text` 조각마다 `setMessages`를 부르지 않는다 — 프레임당 한 번 모아 반영한다
     * (마크다운 재파싱이 조각 수만큼 돌며 입력과 경쟁하던 문제).
     */
    it('따로 도착한 text 조각들도 다음 프레임에 한 번만 반영한다', async () => {
        let push!: (text: string) => void;
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    new ReadableStream<Uint8Array>({
                        start(c) {
                            push = text =>
                                c.enqueue(new TextEncoder().encode(text));
                        },
                    }),
                    { status: 200 }
                )
        );
        // 프레임을 테스트가 직접 넘긴다.
        const frames: FrameRequestCallback[] = [];
        const raf = vi
            .spyOn(globalThis, 'requestAnimationFrame')
            .mockImplementation(callback => {
                frames.push(callback);
                return frames.length;
            });
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return useAgentStream({
                conversationId: 'c1',
                initialMessages: [],
            });
        });
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(push).toBeDefined());
        const deltas = Array.from({ length: 20 }, (_, i) => `${i},`);
        const before = renders;
        for (const delta of deltas) {
            // 조각마다 별도의 매크로태스크 — 예전 구현이면 조각마다 렌더가 돌았다.
            await act(async () => {
                push(`event: text\ndata: ${JSON.stringify({ delta })}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 0));
            });
        }
        // 프레임이 오기 전에는 화면에 반영하지 않는다 — 프레임 예약은 한 번뿐.
        expect(result.current.messages.at(-1)!.content).toBe('');
        expect(raf).toHaveBeenCalledTimes(1);
        expect(renders - before).toBeLessThan(3);
        await act(async () => {
            frames.shift()!(0);
        });
        expect(result.current.messages.at(-1)!.content).toBe(deltas.join(''));
        act(() => result.current.stop());
    });

    it('도구 시작 직전에는 모아 둔 조각을 먼저 반영한다 — 초안(draft) 판정이 전체 글을 본다', async () => {
        const long = '가'.repeat(150);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            sse([
                `event: text\ndata: ${JSON.stringify({ delta: long.slice(0, 100) })}`,
                `event: text\ndata: ${JSON.stringify({ delta: long.slice(100) })}`,
                'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{}}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        const answer = result.current.messages.at(-1)!;
        expect(answer.draft).toBe(long);
        expect(answer.content).toBe('');
    });

    it('중단(stop)해도 아직 반영되지 않은 조각까지 남긴다', async () => {
        let push!: (text: string) => void;
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async (_url, init) =>
                new Response(
                    new ReadableStream<Uint8Array>({
                        start(c) {
                            push = text =>
                                c.enqueue(new TextEncoder().encode(text));
                            (init as RequestInit).signal?.addEventListener(
                                'abort',
                                () =>
                                    c.error(new DOMException('', 'AbortError'))
                            );
                        },
                    }),
                    { status: 200 }
                )
        );
        const raf = vi
            .spyOn(globalThis, 'requestAnimationFrame')
            // 프레임이 오지 않는 상태(백그라운드 탭)를 흉내 낸다.
            .mockImplementation(() => 0);
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: [] })
        );
        act(() => {
            void result.current.send('q');
        });
        await waitFor(() => expect(push).toBeDefined());
        await act(async () => {
            push('event: text\ndata: {"delta":"부분 답변"}\n\n');
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(raf).toHaveBeenCalled();
        act(() => result.current.stop());
        await waitFor(() =>
            expect(result.current.messages.at(-1)!.status).toBe('aborted')
        );
        expect(result.current.messages.at(-1)!.content).toBe('부분 답변');
    });
});
