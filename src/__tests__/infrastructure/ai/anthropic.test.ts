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
    fallbackApiKey: 'fallback-key',
    model: 'claude-haiku-3-5',
    contents: 'Hello',
} as const;

describe('callAnthropicChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('primary key 동작', () => {
        it('primary key가 있고 성공하면 응답 텍스트를 반환한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'Hello' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat({
                ...BASE_OPTIONS,
                primaryApiKey: 'pk',
            });

            expect(result).toBe('Hello');
            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'pk' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: 'claude-haiku-3-5' });
        });

        it('primary key가 실패하면 fallback key로 재시도한다', async () => {
            mockCreate
                .mockRejectedValueOnce(new Error('rate limit'))
                .mockResolvedValueOnce({
                    content: [{ type: 'text', text: 'Fallback response' }],
                    stop_reason: 'end_turn',
                });

            const result = await callAnthropicChat({
                ...BASE_OPTIONS,
                primaryApiKey: 'pk',
                fallbackApiKey: 'fk',
            });

            expect(result).toBe('Fallback response');
            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'pk' });
            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'fk' });
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('primary key가 undefined이면 primary 호출 없이 fallback을 직접 호출한다', async () => {
            mockCreate.mockResolvedValue({
                content: [{ type: 'text', text: 'Fallback only' }],
                stop_reason: 'end_turn',
            });

            const result = await callAnthropicChat({
                ...BASE_OPTIONS,
                primaryApiKey: undefined,
            });

            expect(result).toBe('Fallback only');
            expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'fallback-key' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });
    });

    describe('fallback key 동작', () => {
        it('primary와 fallback 모두 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('all failed'));

            await expect(
                callAnthropicChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: 'pk',
                })
            ).rejects.toThrow('all failed');
        });

        it('primaryApiKey가 undefined이고 fallback도 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('fallback failed'));

            await expect(
                callAnthropicChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: undefined,
                })
            ).rejects.toThrow('fallback failed');
        });
    });

    describe('응답 파싱', () => {
        it('content 배열이 비어있으면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
                content: [],
                stop_reason: 'end_turn',
            });

            await expect(
                callAnthropicChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: undefined,
                })
            ).rejects.toThrow();
        });
    });
});
