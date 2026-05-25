const { mockFinalMessage, mockStream, MockAnthropic } = vi.hoisted(() => {
    const mockFinalMessage = vi.fn();
    const mockStream = vi
        .fn()
        .mockReturnValue({ finalMessage: mockFinalMessage });
    const MockAnthropic = vi.fn().mockImplementation(function () {
        return { messages: { stream: mockStream } };
    });
    return { mockFinalMessage, mockStream, MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({
    default: MockAnthropic,
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        MODEL_SPECS: { ...actual.MODEL_SPECS },
    };
});

import { callAnthropicChat } from '@/entities/llm-provider/api/anthropic';
import { MODEL_SPECS } from '@y0ngha/siglens-core';

const BASE_OPTIONS = {
    serverApiKey: 'server-key',
    userApiKey: undefined,
    model: 'claude-haiku-4-5-20251001', // haiku apiModelId
    contents: 'Hello',
} as const;

const SONNET_OPTIONS = {
    ...BASE_OPTIONS,
    model: 'claude-sonnet-4-6', // sonnet apiModelId
} as const;

describe('callAnthropicChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStream.mockReturnValue({ finalMessage: mockFinalMessage });
    });

    describe('API 키 라우팅', () => {
        it('serverApiKey로 Anthropic을 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(BASE_OPTIONS);

            expect(result).toBe('Hello');
            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'server-key',
            });
            expect(mockStream).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({
                ...BASE_OPTIONS,
                userApiKey: 'user-key',
            });

            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'server-key',
            });
            expect(MockAnthropic).toHaveBeenCalledTimes(1);
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockFinalMessage.mockRejectedValue(new Error('api error'));

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('haiku — temperature 모드', () => {
        it('thinking 없이 temperature로 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat(BASE_OPTIONS);

            const call = mockStream.mock.calls[0][0];
            expect(call).not.toHaveProperty('thinking');
            expect(call).not.toHaveProperty('output_config');
            expect(call.temperature).toBeDefined();
        });
    });

    describe('Sonnet/Opus — adaptive thinking 모드', () => {
        it('adaptive thinking과 effort로 호출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'deep answer' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(SONNET_OPTIONS);

            expect(result).toBe('deep answer');
            const call = mockStream.mock.calls[0][0];
            expect(call.thinking).toEqual({
                type: 'adaptive',
                display: 'omitted',
            });
            expect(call.output_config).toEqual({ effort: 'high' });
            expect(call).not.toHaveProperty('temperature');
        });

        it('thinking + text 혼합 응답에서 text 블록을 추출한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [
                    {
                        type: 'thinking',
                        thinking: 'reasoning...',
                        signature: 'sig',
                    },
                    { type: 'text', text: 'final answer' },
                ],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(SONNET_OPTIONS);

            expect(result).toBe('final answer');
        });
    });

    describe('응답 파싱', () => {
        it('content 배열이 비어있으면 에러를 던진다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [],
                stop_reason: 'end_turn',
            });

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'Anthropic returned no text content'
            );
        });

        it('content에 text 타입이 없으면 에러를 던진다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [
                    { type: 'tool_use', id: 'call_1', name: 'tool', input: {} },
                ],
                stop_reason: 'tool_use',
            });

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'Anthropic returned no text content'
            );
        });
    });

    describe('effort 검증', () => {
        it('유효한 effort(medium)는 통과한다', async () => {
            mockFinalMessage.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await expect(callAnthropicChat(SONNET_OPTIONS)).resolves.toBe('ok');
        });

        it('잘못된 effort 값이 spec에 있으면 에러를 던진다', async () => {
            // Use a string-indexed view so we don't narrow `original` through the
            // full MODEL_SPECS union (which would force the assignment shape to
            // satisfy every spec member, e.g. gemini specs without `effort`).
            const specs = MODEL_SPECS as unknown as Record<
                string,
                Record<string, unknown>
            >;
            const original = specs['claude-sonnet-4-6'];

            specs['claude-sonnet-4-6'] = {
                ...original,
                // Runtime invalid value to verify the validator throws. The
                // string-indexed view above keeps this assignment well-typed.
                effort: 'extreme',
            };

            try {
                await expect(callAnthropicChat(SONNET_OPTIONS)).rejects.toThrow(
                    '[anthropic] Invalid effort value: extreme'
                );
            } finally {
                specs['claude-sonnet-4-6'] = original;
            }
        });
    });
});
