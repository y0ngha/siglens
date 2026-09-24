import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';

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
});
