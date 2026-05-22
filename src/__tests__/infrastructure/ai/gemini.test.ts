const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
    const MockGoogleGenAI = jest.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    }));
    return { GoogleGenAI: MockGoogleGenAI };
});

import { callGeminiChat } from '@/infrastructure/ai/gemini';

const BASE_OPTIONS = {
    userApiKey: undefined,
    serverApiKey: 'server-key',
    model: 'gemini-2.0-flash',
    contents: 'Hello',
} as const;

describe('callGeminiChat', () => {
    beforeEach(() => {
        mockGenerateContent.mockClear();
    });

    describe('API 키 라우팅', () => {
        it('serverApiKey로 Gemini를 호출한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'response' });

            const result = await callGeminiChat(BASE_OPTIONS);

            expect(result).toBe('response');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('userApiKey가 있어도 serverApiKey만 사용한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'response' });

            await callGeminiChat({ ...BASE_OPTIONS, userApiKey: 'user-key' });

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('호출이 실패하면 에러가 전파된다', async () => {
            mockGenerateContent.mockRejectedValue(new Error('api error'));

            await expect(callGeminiChat(BASE_OPTIONS)).rejects.toThrow(
                'api error'
            );
        });
    });

    describe('응답 파싱', () => {
        it('response.text가 undefined이면 에러를 던진다', async () => {
            mockGenerateContent.mockResolvedValue({ text: undefined });

            await expect(callGeminiChat(BASE_OPTIONS)).rejects.toThrow(
                '[gemini] Provider returned null/undefined response'
            );
        });

        it('response.text가 null이면 에러를 던진다', async () => {
            mockGenerateContent.mockResolvedValue({ text: null });

            await expect(callGeminiChat(BASE_OPTIONS)).rejects.toThrow(
                '[gemini] Provider returned null/undefined response'
            );
        });

        it('response.text가 빈 문자열이면 그대로 반환한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: '' });

            const result = await callGeminiChat(BASE_OPTIONS);

            expect(result).toBe('');
        });
    });

    describe('systemInstruction', () => {
        it('systemInstruction이 있으면 config에 포함한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({
                ...BASE_OPTIONS,
                systemInstruction: 'Be concise.',
            });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: { systemInstruction: 'Be concise.' },
                })
            );
        });

        it('systemInstruction이 없으면 config를 포함하지 않는다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat(BASE_OPTIONS);

            const call = mockGenerateContent.mock.calls[0][0];
            expect(call).not.toHaveProperty('config');
        });
    });

    describe('ConversationTurn[] contents 변환', () => {
        it('role: assistant는 model로 변환하여 Gemini에 전달한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({
                ...BASE_OPTIONS,
                contents: [
                    { role: 'user', text: 'Q' },
                    { role: 'assistant', text: 'A' },
                ],
            });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    contents: [
                        { role: 'user', parts: [{ text: 'Q' }] },
                        { role: 'model', parts: [{ text: 'A' }] },
                    ],
                })
            );
        });

        it('빈 배열이면 빈 배열로 변환한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({ ...BASE_OPTIONS, contents: [] });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({ contents: [] })
            );
        });
    });

    describe('thinkingBudget', () => {
        it('thinkingBudget: 0 이면 config.thinkingConfig에 포함한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({ ...BASE_OPTIONS, thinkingBudget: 0 });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: { thinkingConfig: { thinkingBudget: 0 } },
                })
            );
        });

        it('thinkingBudget이 없으면 config를 포함하지 않는다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat(BASE_OPTIONS);

            const call = mockGenerateContent.mock.calls[0][0];
            expect(call).not.toHaveProperty('config');
        });

        it('thinkingBudget과 systemInstruction을 함께 전달하면 config에 모두 포함한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({
                ...BASE_OPTIONS,
                systemInstruction: 'Be concise.',
                thinkingBudget: 0,
            });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: {
                        systemInstruction: 'Be concise.',
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                })
            );
        });
    });
});
