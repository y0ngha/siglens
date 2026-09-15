import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from '@/entities/llm-provider/api/agent/mapMessages';

const call = { id: 'c1', name: 'get_quote', args: { symbols: ['AAPL'] } };
const history: AgentMessage[] = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: '', toolCalls: [call] },
    {
        role: 'tool',
        content: '{"price":1}',
        toolCallId: 'c1',
        toolName: 'get_quote',
    },
    { role: 'assistant', content: 'done' },
];

describe('toOpenAiChatMessages', () => {
    it('tool_calls·tool 메시지로 매핑한다', () => {
        expect(toOpenAiChatMessages(history)).toEqual([
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
                            arguments: '{"symbols":["AAPL"]}',
                        },
                    },
                ],
            },
            { role: 'tool', tool_call_id: 'c1', content: '{"price":1}' },
            { role: 'assistant', content: 'done' },
        ]);
    });

    it('toolCallId 없는 tool 메시지는 빈 id로 보내지 않고 throw한다', () => {
        expect(() =>
            toOpenAiChatMessages([
                { role: 'tool', content: '{}', toolName: 'get_quote' },
            ])
        ).toThrow(/missing toolCallId/);
    });
});

describe('toOpenAiChatMessages toolCallExtra', () => {
    it('extra를 넘기면 각 tool call에 펼치고, 생략하면 페이로드가 그대로다', () => {
        const extra = { extra_content: { google: { thought_signature: 'x' } } };
        const withExtra = toOpenAiChatMessages(history, extra);
        expect(withExtra[1]).toEqual({
            role: 'assistant',
            content: null,
            tool_calls: [
                {
                    id: 'c1',
                    type: 'function',
                    function: {
                        name: 'get_quote',
                        arguments: '{"symbols":["AAPL"]}',
                    },
                    ...extra,
                },
            ],
        });
        expect(JSON.stringify(toOpenAiChatMessages(history)[1])).toBe(
            '{"role":"assistant","content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"get_quote","arguments":"{\\"symbols\\":[\\"AAPL\\"]}"}}]}'
        );
    });
});
