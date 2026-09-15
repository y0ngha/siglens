import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const create = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(function () {
        return { chat: { completions: { create } } };
    });
    return { mockCreate: create, MockOpenAI };
});
vi.mock('openai', () => ({ default: MockOpenAI }));

import { callDeepseekAgent } from '@/entities/llm-provider/api/agent/deepseek';
import { AGENT_TOOL_SPECS, type AgentStreamEvent } from '@y0ngha/siglens-core';

async function* chunks(items: unknown[]) {
    for (const i of items) yield i;
}

const TOOL_STREAM = [
    { choices: [{ delta: { role: 'assistant', content: '' } }] },
    {
        choices: [
            {
                delta: {
                    tool_calls: [
                        {
                            index: 0,
                            id: 'call_00_x',
                            type: 'function',
                            function: { name: 'get_quote', arguments: '' },
                        },
                    ],
                },
            },
        ],
    },
    {
        choices: [
            {
                delta: {
                    tool_calls: [
                        { index: 0, function: { arguments: '{"symbol' } },
                    ],
                },
            },
        ],
    },
    {
        choices: [
            {
                delta: {
                    tool_calls: [
                        { index: 0, function: { arguments: 's": ["AAPL"]}' } },
                    ],
                },
            },
        ],
    },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    {
        choices: [],
        usage: {
            prompt_tokens: 284,
            completion_tokens: 39,
            prompt_cache_hit_tokens: 128,
            prompt_cache_miss_tokens: 156,
        },
    },
];

function opts(overrides = {}) {
    return {
        apiKey: 'k',
        apiModelId: 'deepseek-flash',
        model: 'deepseek-v4.1-flash' as const,
        system: 'sys',
        messages: [{ role: 'user' as const, content: 'AAPL?' }],
        tools: AGENT_TOOL_SPECS.filter(t => t.name === 'get_quote'),
        maxOutputTokens: 4096,
        signal: new AbortController().signal,
        onEvent: vi.fn<(e: AgentStreamEvent) => void>(),
        ...overrides,
    };
}

describe('callDeepseekAgent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('tool_calls 스트림 누적 → toolCalls·tool_use, thinking disabled, signal 전달', async () => {
        mockCreate.mockResolvedValue(chunks(TOOL_STREAM));
        const o = opts();
        const r = await callDeepseekAgent(o);
        expect(r.toolCalls).toEqual([
            { id: 'call_00_x', name: 'get_quote', args: { symbols: ['AAPL'] } },
        ]);
        expect(r.stopReason).toBe('tool_use');
        expect(r.usage).toEqual({
            promptTokens: 156,
            cachedTokens: 128,
            cacheWriteTokens: 0,
            outputTokens: 39,
        });
        expect(o.onEvent).toHaveBeenCalledWith({
            type: 'tool_call',
            call: r.toolCalls[0],
        });
        const params = mockCreate.mock.lastCall![0];
        expect(params.model).toBe('deepseek-flash');
        expect(params.thinking).toEqual({ type: 'disabled' });
        expect(params.tools[0]).toEqual({
            type: 'function',
            function: {
                name: 'get_quote',
                description: expect.any(String),
                parameters: expect.objectContaining({ type: 'object' }),
            },
        });
        expect(params.stream).toBe(true);
        // The call gets an internal signal (stall watchdog) linked to the caller's.
        expect(mockCreate.mock.lastCall![1].signal).toBeInstanceOf(AbortSignal);
    });

    it('요청 본문 필드 순서·메시지 페이로드가 리팩터 전과 동일하다(extra_content 없음)', async () => {
        mockCreate.mockResolvedValue(chunks(TOOL_STREAM));
        await callDeepseekAgent(
            opts({
                messages: [
                    { role: 'user', content: 'q' },
                    {
                        role: 'assistant',
                        content: '',
                        toolCalls: [
                            { id: 'c1', name: 'get_quote', args: { a: 1 } },
                        ],
                    },
                    {
                        role: 'tool',
                        content: '{}',
                        toolCallId: 'c1',
                        toolName: 'get_quote',
                    },
                ],
            })
        );
        const params = mockCreate.mock.lastCall![0];
        expect(Object.keys(params)).toEqual([
            'model',
            'messages',
            'tools',
            'tool_choice',
            'max_tokens',
            'temperature',
            'thinking',
            'stream',
            'stream_options',
        ]);
        expect(JSON.stringify(params.messages)).toBe(
            JSON.stringify([
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'q' },
                {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'c1',
                            type: 'function',
                            function: {
                                name: 'get_quote',
                                arguments: '{"a":1}',
                            },
                        },
                    ],
                },
                { role: 'tool', tool_call_id: 'c1', content: '{}' },
            ])
        );
        expect(params.stream_options).toEqual({ include_usage: true });
        expect(params.temperature).toBe(0);
    });

    it('텍스트 델타 스트림 → end', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                { choices: [{ delta: { content: '231' } }] },
                { choices: [{ delta: { content: '.42' } }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
                {
                    choices: [],
                    usage: { prompt_tokens: 10, completion_tokens: 3 },
                },
            ])
        );
        const o = opts();
        const r = await callDeepseekAgent(o);
        expect(r.text).toBe('231.42');
        expect(r.stopReason).toBe('end');
        expect(o.onEvent).toHaveBeenCalledWith({ type: 'text', delta: '231' });
    });

    it('length → max_tokens, 깨진 인자 JSON은 {}', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'c',
                                        function: {
                                            name: 'get_quote',
                                            arguments: '{bad',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                { choices: [{ delta: {}, finish_reason: 'length' }] },
            ])
        );
        const r = await callDeepseekAgent(opts());
        expect(r.stopReason).toBe('max_tokens');
        expect(r.toolCalls[0].args).toEqual({});
    });

    it('abort 에러는 삼키지 않고 그대로 전파한다', async () => {
        const abortError = Object.assign(
            new Error('The operation was aborted'),
            { name: 'AbortError' }
        );
        mockCreate.mockRejectedValue(abortError);
        await expect(callDeepseekAgent(opts())).rejects.toThrow(
            'The operation was aborted'
        );
    });

    it('병렬 tool_calls는 index 순서대로 정렬되어 반환된다', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 1,
                                        id: 'call_1',
                                        type: 'function',
                                        function: {
                                            name: 'get_news',
                                            arguments: '',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'call_0',
                                        type: 'function',
                                        function: {
                                            name: 'get_quote',
                                            arguments: '',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 1,
                                        function: { arguments: '{"a":1}' },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        function: {
                                            arguments: '{"symbols":["AAPL"]}',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ])
        );
        const r = await callDeepseekAgent(opts());
        expect(r.toolCalls).toEqual([
            { id: 'call_0', name: 'get_quote', args: { symbols: ['AAPL'] } },
            { id: 'call_1', name: 'get_news', args: { a: 1 } },
        ]);
    });

    it('반복 전송된 함수 이름을 이어 붙이지 않는다', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'c',
                                        function: {
                                            name: 'get_quote',
                                            arguments: '{"symbols":',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        function: {
                                            name: 'get_quote',
                                            arguments: '["AAPL"]}',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ])
        );
        const r = await callDeepseekAgent(opts());
        expect(r.toolCalls).toEqual([
            { id: 'c', name: 'get_quote', args: { symbols: ['AAPL'] } },
        ]);
    });

    it('id 없는 호출은 index 기반 id로 채운다', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        function: {
                                            name: 'get_quote',
                                            arguments: '{}',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ])
        );
        const r = await callDeepseekAgent(opts());
        expect(r.toolCalls[0].id).toBe('call_0');
    });

    it('tool_use가 아니면 tool_call 이벤트를 내보내지 않는다', async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'c',
                                        function: {
                                            name: 'get_quote',
                                            arguments: '{bad',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                { choices: [{ delta: {}, finish_reason: 'length' }] },
            ])
        );
        const o = opts();
        await callDeepseekAgent(o);
        expect(o.onEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'tool_call' })
        );
        expect(o.onEvent).toHaveBeenCalledWith({
            type: 'stop',
            reason: 'max_tokens',
        });
    });

    it('스트림 도중 abort되면 SDK가 조용히 끝내도 reject한다', async () => {
        const ac = new AbortController();
        mockCreate.mockResolvedValue(
            (async function* () {
                yield { choices: [{ delta: { content: '부분' } }] };
                ac.abort();
            })()
        );
        const o = opts({ signal: ac.signal });
        await expect(callDeepseekAgent(o)).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(o.onEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'stop' })
        );
    });
});
