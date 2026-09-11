import { describe, expect, it, vi } from 'vitest';
import { fakeAgentProvider } from '@/entities/llm-provider/api/agent/fake';

const base = {
    apiKey: '',
    model: 'deepseek-v4.1-flash' as const,
    system: 's',
    tools: [
        {
            name: 'get_quote',
            description: 'd',
            costClass: 'free' as const,
            inputSchema: {
                type: 'object' as const,
                properties: {},
                additionalProperties: false as const,
            },
        },
    ],
    maxOutputTokens: 100,
    signal: new AbortController().signal,
};

describe('fakeAgentProvider', () => {
    it('대문자 심볼 + 툴 결과 없음 → get_quote 1회', async () => {
        const r = await fakeAgentProvider({
            ...base,
            onEvent: vi.fn(),
            messages: [{ role: 'user', content: 'AAPL 얼마야' }],
        });
        expect(r.stopReason).toBe('tool_use');
        expect(r.toolCalls).toEqual([
            { id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } },
        ]);
    });

    it('툴 결과 있음 → 결정적 텍스트', async () => {
        const onEvent = vi.fn();
        const r = await fakeAgentProvider({
            ...base,
            onEvent,
            messages: [
                { role: 'user', content: 'AAPL 얼마야' },
                {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'fake_1',
                            name: 'get_quote',
                            args: { symbols: ['AAPL'] },
                        },
                    ],
                },
                {
                    role: 'tool',
                    content: '{"price":1}',
                    toolCallId: 'fake_1',
                    toolName: 'get_quote',
                },
            ],
        });
        expect(r.stopReason).toBe('end');
        expect(r.text).toContain('[E2E agent]');
        expect(onEvent).toHaveBeenCalledWith({
            type: 'text',
            delta: expect.stringContaining('[E2E agent]'),
        });
    });
});
