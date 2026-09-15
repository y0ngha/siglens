import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const create = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(function () {
        return { chat: { completions: { create } } };
    });
    return { mockCreate: create, MockOpenAI };
});
vi.mock('openai', () => ({ default: MockOpenAI }));

import { callGeminiAgent } from '@/entities/llm-provider/api/agent/gemini';
import {
    AGENT_TOOL_SPECS,
    MODEL_SPECS,
    type AgentStreamEvent,
} from '@y0ngha/siglens-core';

async function* chunks(items: unknown[]) {
    for (const i of items) yield i;
}

const SIGNATURE = { google: { thought_signature: 'sig-abc' } };

/** Shape observed live 2026-09-15: tool calls arrive whole, finish_reason is 'stop'. */
const GEMINI_TOOL_STREAM = [
    {
        choices: [
            {
                delta: {
                    role: 'assistant',
                    tool_calls: [
                        {
                            index: 0,
                            id: 'function-call-1',
                            type: 'function',
                            function: {
                                name: 'get_quote',
                                arguments: '{"symbols":["AAPL"]}',
                            },
                            extra_content: SIGNATURE,
                        },
                    ],
                },
                finish_reason: 'stop',
            },
        ],
    },
    {
        choices: [],
        usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
    },
];

function opts(overrides = {}) {
    return {
        apiKey: 'gm',
        apiModelId: MODEL_SPECS['gemini-3.6-flash'].apiModelId,
        model: 'gemini-3.6-flash' as const,
        system: 'sys',
        messages: [{ role: 'user' as const, content: 'AAPL?' }],
        tools: AGENT_TOOL_SPECS.filter(t => t.name === 'get_quote'),
        maxOutputTokens: 4096,
        signal: new AbortController().signal,
        onEvent: vi.fn<(e: AgentStreamEvent) => void>(),
        ...overrides,
    };
}

describe('callGeminiAgent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Gemini OpenAI 호환 엔드포인트·모델·reasoning_effort minimal로 요청한다', async () => {
        mockCreate.mockResolvedValue(chunks(GEMINI_TOOL_STREAM));
        await callGeminiAgent(opts());
        expect(MockOpenAI).toHaveBeenCalledWith({
            apiKey: 'gm',
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
        const params = mockCreate.mock.lastCall![0];
        expect(params.model).toBe('gemini-3.6-flash');
        // Pinned to core's spec so a spec change to the off level is noticed here.
        expect(params.reasoning_effort).toBe(
            MODEL_SPECS['gemini-3.6-flash'].reasoning.off.level
        );
        expect(params.reasoning_effort).toBe('minimal');
        expect(params.thinking).toBeUndefined();
        expect(params).toMatchObject({
            temperature: 0,
            stream: true,
            stream_options: { include_usage: true },
            tool_choice: 'auto',
        });
        expect(params.tools[0].function.name).toBe('get_quote');
    });

    it("finish_reason 'stop'이어도 tool call이 스트리밍됐으면 tool_use로 추론하고 tool_call 이벤트를 낸다", async () => {
        mockCreate.mockResolvedValue(chunks(GEMINI_TOOL_STREAM));
        const o = opts();
        const r = await callGeminiAgent(o);
        expect(r.stopReason).toBe('tool_use');
        expect(r.toolCalls).toEqual([
            {
                id: 'function-call-1',
                name: 'get_quote',
                args: { symbols: ['AAPL'] },
            },
        ]);
        expect(o.onEvent).toHaveBeenCalledWith({
            type: 'tool_call',
            call: r.toolCalls[0],
        });
        expect(o.onEvent).toHaveBeenLastCalledWith({
            type: 'stop',
            reason: 'tool_use',
        });
    });

    it("tool call 없는 'stop'은 end", async () => {
        mockCreate.mockResolvedValue(
            chunks([
                {
                    choices: [
                        { delta: { content: '답' }, finish_reason: 'stop' },
                    ],
                },
            ])
        );
        const r = await callGeminiAgent(opts());
        expect(r.stopReason).toBe('end');
        expect(r.text).toBe('답');
    });

    it('usage를 정규화하고 [Usage] 로그에 Gemini apiModelId를 기록한다', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        try {
            mockCreate.mockResolvedValue(chunks(GEMINI_TOOL_STREAM));
            const r = await callGeminiAgent(opts());
            expect(r.usage).toEqual({
                promptTokens: 500,
                cachedTokens: 0,
                cacheWriteTokens: 0,
                outputTokens: 20,
            });
            const line = info.mock.calls
                .map(c => String(c[0]))
                .find(l => l.includes('[Usage]'));
            expect(JSON.parse(line!)).toMatchObject({
                jobId: 'agent',
                model: 'gemini-3.6-flash',
                outputTokens: 20,
            });
        } finally {
            info.mockRestore();
        }
    });

    it('재생되는 assistant tool call마다(DeepSeek 이력 포함) 더미 thought_signature를 붙인다', async () => {
        mockCreate.mockResolvedValue(chunks(GEMINI_TOOL_STREAM));
        await callGeminiAgent(
            opts({
                messages: [
                    { role: 'user', content: 'q' },
                    {
                        role: 'assistant',
                        content: '',
                        toolCalls: [
                            { id: 'call_00_ds', name: 'get_quote', args: {} },
                            { id: 'call_01_ds', name: 'get_news', args: {} },
                        ],
                    },
                    {
                        role: 'tool',
                        content: '{}',
                        toolCallId: 'call_00_ds',
                        toolName: 'get_quote',
                    },
                    {
                        role: 'tool',
                        content: '{}',
                        toolCallId: 'call_01_ds',
                        toolName: 'get_news',
                    },
                    { role: 'assistant', content: 'text only' },
                ],
            })
        );
        const messages = mockCreate.mock.lastCall![0].messages;
        const toolCalls = messages[2].tool_calls;
        expect(toolCalls).toHaveLength(2);
        for (const c of toolCalls) {
            expect(c.extra_content).toEqual({
                google: {
                    thought_signature: 'skip_thought_signature_validator',
                },
            });
        }
        expect(messages[5]).toEqual({
            role: 'assistant',
            content: 'text only',
        });
    });
});
