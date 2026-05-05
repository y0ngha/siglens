const mockCreate = jest.fn();
const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
}));

jest.mock('@anthropic-ai/sdk', () => ({
    __esModule: true,
    default: MockAnthropic,
}));

import { callAnthropicChat } from '@/infrastructure/ai/anthropic';

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
        jest.clearAllMocks();
    });

    describe('API 키 라우팅', () => {
        it('serverApiKey로 Anthropic을 호출한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(BASE_OPTIONS);

            expect(result).toBe('Hello');
            expect(MockAnthropic).toHaveBeenCalledWith({
                apiKey: 'server-key',
            });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockCreate.mockResolvedValue({
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
            mockCreate.mockRejectedValue(new Error('api error'));

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('haiku — temperature 모드', () => {
        it('thinking 없이 temperature로 호출한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat(BASE_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call).not.toHaveProperty('thinking');
            expect(call).not.toHaveProperty('output_config');
            expect(call.temperature).toBeDefined();
        });
    });

    describe('Sonnet/Opus — adaptive thinking 모드', () => {
        it('adaptive thinking과 effort로 호출한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'deep answer' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat(SONNET_OPTIONS);

            expect(result).toBe('deep answer');
            const call = mockCreate.mock.calls[0][0];
            expect(call.thinking).toEqual({
                type: 'adaptive',
                display: 'omitted',
            });
            expect(call.output_config).toEqual({ effort: 'medium' });
            expect(call).not.toHaveProperty('temperature');
        });

        it('thinking + text 혼합 응답에서 text 블록을 추출한다', async () => {
            mockCreate.mockResolvedValue({
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
            mockCreate.mockResolvedValue({
                content: [],
                stop_reason: 'end_turn',
            });

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow(
                'Anthropic returned no text content'
            );
        });

        it('content에 text 타입이 없으면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
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
});
