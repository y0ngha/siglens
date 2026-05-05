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
    serverApiKey: 'server-key',
    model: 'gpt-5-mini',
    contents: 'Hello',
} as const;

describe('callOpenaiChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('API 키 라우팅', () => {
        it('serverApiKey로 OpenAI를 호출한다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: 'Hi' } }],
            });

            const result = await callOpenaiChat(BASE_OPTIONS);

            expect(result).toBe('Hi');
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'server-key' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: 'Hi' } }],
            });

            await callOpenaiChat({ ...BASE_OPTIONS, userApiKey: 'user-key' });

            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'server-key' });
            expect(MockOpenAI).toHaveBeenCalledTimes(1);
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockCreate.mockRejectedValue(new Error('api error'));

            await expect(callOpenaiChat(BASE_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('응답 파싱', () => {
        it('응답 content가 null이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({
                choices: [{ message: { content: null } }],
            });

            await expect(callOpenaiChat(BASE_OPTIONS)).rejects.toThrow(
                'OpenAI returned no text content'
            );
        });

        it('choices 배열이 비어있으면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({ choices: [] });

            await expect(callOpenaiChat(BASE_OPTIONS)).rejects.toThrow(
                'OpenAI returned no text content'
            );
        });
    });
});
