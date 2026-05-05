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
    model: 'claude-haiku-3-5',
    contents: 'Hello',
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
            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'server-key' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            await callAnthropicChat({ ...BASE_OPTIONS, userApiKey: 'user-key' });

            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'server-key' });
            expect(MockAnthropic).toHaveBeenCalledTimes(1);
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('api error'));

            await expect(callAnthropicChat(BASE_OPTIONS)).rejects.toThrow('api error');
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

        it('content[0]이 text 타입이 아니면 에러를 던진다', async () => {
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
