import type { AgentMessage } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
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

    it('도구 인자는 모델이 낸 키 순서와 jsonb가 돌려주는 순서에서 같은 문자열이 된다', () => {
        // jsonb는 키를 길이, 바이트 순으로 돌려준다: bars(4) < symbol(6) < filter(6) < timeframe(9).
        const modelOrder = {
            symbol: 'AAPL',
            timeframe: '1Day',
            bars: 30,
            filter: { zeta: [{ b: 2, a: 1 }, 3], alpha: null },
        };
        const jsonbOrder = {
            bars: 30,
            symbol: 'AAPL',
            filter: { alpha: null, zeta: [{ a: 1, b: 2 }, 3] },
            timeframe: '1Day',
        };
        const argumentsOf = (args: Record<string, unknown>): unknown => {
            const [assistant] = toOpenAiChatMessages([
                {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        { id: 'c1', name: 'get_bars_indicators', args },
                    ],
                },
            ]);
            const first =
                assistant && 'tool_calls' in assistant
                    ? assistant.tool_calls?.[0]
                    : undefined;
            return first && 'function' in first
                ? first.function.arguments
                : undefined;
        };
        expect(argumentsOf(modelOrder)).toBe(argumentsOf(jsonbOrder));
        expect(argumentsOf(modelOrder)).toBe(
            '{"bars":30,"filter":{"alpha":null,"zeta":[{"a":1,"b":2},3]},"symbol":"AAPL","timeframe":"1Day"}'
        );
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

    describe('이미지 첨부', () => {
        const images = [
            { mediaType: 'image/webp' as const, data: 'AAAA' },
            { mediaType: 'image/png' as const, data: 'BBBB' },
        ];

        it('user 메시지의 images를 text + image_url(data URL) 파트로 매핑한다', () => {
            expect(
                toOpenAiChatMessages([
                    { role: 'user', content: '이거 어때?', images },
                ])
            ).toEqual([
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: '이거 어때?' },
                        {
                            type: 'image_url',
                            image_url: { url: 'data:image/webp;base64,AAAA' },
                        },
                        {
                            type: 'image_url',
                            image_url: { url: 'data:image/png;base64,BBBB' },
                        },
                    ],
                },
            ]);
        });

        it('글이 비면 text 파트를 만들지 않는다', () => {
            const [mapped] = toOpenAiChatMessages([
                { role: 'user', content: '', images: [images[0]!] },
            ]);
            expect(mapped).toEqual({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: 'data:image/webp;base64,AAAA' },
                    },
                ],
            });
        });

        it('images가 없거나 비어 있으면 평문 content 그대로다', () => {
            expect(
                toOpenAiChatMessages([
                    { role: 'user', content: 'q' },
                    { role: 'user', content: 'r', images: [] },
                ])
            ).toEqual([
                { role: 'user', content: 'q' },
                { role: 'user', content: 'r' },
            ]);
        });
    });
});
