const mockCreate = jest.fn();
const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
}));

jest.mock('openai', () => ({
    __esModule: true,
    default: MockOpenAI,
}));

import { callOpenaiChat } from '@/infrastructure/ai/openai';

const BASE_OPTIONS = {
    fallbackApiKey: 'fallback-key',
    model: 'gpt-5-mini',
    contents: 'Hello',
} as const;

describe('callOpenaiChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('primary key 동작', () => {
        it('primary key가 있고 성공하면 응답 텍스트를 반환한다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: 'Hi' } }],
            });

            const result = await callOpenaiChat({
                ...BASE_OPTIONS,
                primaryApiKey: 'pk',
            });

            expect(result).toBe('Hi');
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'pk' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(mockCreate.mock.calls[0][0]).toMatchObject({
                model: 'gpt-5-mini',
            });
        });

        it('primary key가 실패하면 fallback key로 재시도한다', async () => {
            mockCreate
                .mockRejectedValueOnce(new Error('quota exceeded'))
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'Fallback response' } }],
                });

            const result = await callOpenaiChat({
                ...BASE_OPTIONS,
                primaryApiKey: 'pk',
                fallbackApiKey: 'fk',
            });

            expect(result).toBe('Fallback response');
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'pk' });
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'fk' });
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('primary key가 undefined이면 primary 호출 없이 fallback을 직접 호출한다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: 'Fallback only' } }],
            });

            const result = await callOpenaiChat({
                ...BASE_OPTIONS,
                primaryApiKey: undefined,
            });

            expect(result).toBe('Fallback only');
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'fallback-key' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });
    });

    describe('fallback key 동작', () => {
        it('primary와 fallback 모두 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('all failed'));

            await expect(
                callOpenaiChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: 'pk',
                })
            ).rejects.toThrow('all failed');
        });

        it('primaryApiKey가 undefined이고 fallback도 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('fallback failed'));

            await expect(
                callOpenaiChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: undefined,
                })
            ).rejects.toThrow('fallback failed');
        });
    });

    describe('응답 파싱', () => {
        it('응답 content가 null이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: null } }],
            });

            await expect(
                callOpenaiChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: undefined,
                })
            ).rejects.toThrow('OpenAI returned no text content');
        });

        it('choices 배열이 비어있으면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({ choices: [] });

            await expect(
                callOpenaiChat({
                    ...BASE_OPTIONS,
                    primaryApiKey: undefined,
                })
            ).rejects.toThrow('OpenAI returned no text content');
        });
    });
});
