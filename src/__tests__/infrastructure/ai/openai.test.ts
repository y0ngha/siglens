const mockCreate = jest.fn();
const MockOpenAI = jest.fn().mockImplementation(() => ({
    responses: { create: mockCreate },
}));

jest.mock('openai', () => ({
    __esModule: true,
    default: MockOpenAI,
}));

import { callOpenaiChat } from '@/infrastructure/ai/openai';

const BASE_OPTIONS = {
    serverApiKey: 'server-key',
    userApiKey: undefined,
    model: 'gpt-5-mini', // apiModelId
    contents: 'Hello',
} as const;

const GPT5_OPTIONS = {
    ...BASE_OPTIONS,
    model: 'gpt-5.5', // apiModelId with reasoning
} as const;

describe('callOpenaiChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('API 키 라우팅', () => {
        it('serverApiKey로 OpenAI를 호출한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'Hi' });

            const result = await callOpenaiChat(BASE_OPTIONS);

            expect(result).toBe('Hi');
            expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'server-key' });
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'Hi' });

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

    describe('Responses API 파라미터', () => {
        it('input과 instructions로 호출한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'ok' });

            await callOpenaiChat(BASE_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call).toHaveProperty('input', 'Hello');
            expect(call).not.toHaveProperty('messages');
        });

        it('systemInstruction을 instructions로 전달한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'ok' });

            await callOpenaiChat({
                ...BASE_OPTIONS,
                systemInstruction: 'Be concise',
            });

            const call = mockCreate.mock.calls[0][0];
            expect(call.instructions).toBe('Be concise');
        });

        it('systemInstruction이 없으면 instructions를 포함하지 않는다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'ok' });

            await callOpenaiChat(BASE_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call).not.toHaveProperty('instructions');
        });

        it('reasoning 지원 모델에 reasoning.effort를 전달한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'deep answer' });

            await callOpenaiChat(GPT5_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.reasoning).toBeDefined();
            expect(call.reasoning.effort).toBeDefined();
        });

        it('gpt-5-mini에 reasoning.effort low를 전달한다', async () => {
            mockCreate.mockResolvedValue({ output_text: 'ok' });

            await callOpenaiChat(BASE_OPTIONS);

            const call = mockCreate.mock.calls[0][0];
            expect(call.reasoning).toEqual({ effort: 'low' });
        });
    });

    describe('응답 파싱', () => {
        it('output_text가 빈 문자열이면 경고 로그 후 그대로 반환한다', async () => {
            mockCreate.mockResolvedValue({ output_text: '' });
            const warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await callOpenaiChat(BASE_OPTIONS);

            expect(result).toBe('');
            expect(warnSpy).toHaveBeenCalledWith(
                '[openai] Provider returned empty string'
            );
            warnSpy.mockRestore();
        });

        it('output_text가 null이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({ output_text: null });

            await expect(callOpenaiChat(BASE_OPTIONS)).rejects.toThrow(
                '[openai] Provider returned null/undefined response'
            );
        });

        it('output_text가 undefined이면 에러를 던진다', async () => {
            mockCreate.mockResolvedValue({ output_text: undefined });

            await expect(callOpenaiChat(BASE_OPTIONS)).rejects.toThrow(
                '[openai] Provider returned null/undefined response'
            );
        });
    });
});
