// `MockGoogleGenAI`는 hoisted 블록에 둔다 — 생성자 인자(= 실제로 사용된 API 키)를
// 단언하려면 팩토리 스코프 밖에서도 mock에 접근할 수 있어야 한다.
const { mockGenerateContent, MockGoogleGenAI } = vi.hoisted(() => {
    const mockGenerateContent = vi.fn();
    return {
        mockGenerateContent,
        MockGoogleGenAI: vi.fn(function () {
            return { models: { generateContent: mockGenerateContent } };
        }),
    };
});

vi.mock('@google/genai', () => ({ GoogleGenAI: MockGoogleGenAI }));

import { callGeminiChat } from '@/entities/llm-provider/api/gemini';

const BASE_OPTIONS = {
    apiKey: 'server-key',
    model: 'gemini-2.0-flash',
    contents: 'Hello',
} as const;

describe('callGeminiChat', () => {
    beforeEach(() => {
        mockGenerateContent.mockClear();
        MockGoogleGenAI.mockClear();
    });

    describe('API 키 라우팅', () => {
        it('apiKey로 Gemini를 호출한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'response' });

            const result = await callGeminiChat(BASE_OPTIONS);

            expect(result).toBe('response');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('BYOK 키를 받으면 그 키로 클라이언트를 만든다 (환경변수 폴백 금지)', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'response' });

            await callGeminiChat({ ...BASE_OPTIONS, apiKey: 'user-key' });

            expect(MockGoogleGenAI).toHaveBeenCalledWith({
                apiKey: 'user-key',
            });
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

    describe('string contents 변환', () => {
        it('string contents는 그대로 Gemini에 전달한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({ ...BASE_OPTIONS, contents: 'Hello' });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({ contents: 'Hello' })
            );
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

        // Boundary contract (GeminiChatOptions.thinkingBudget JSDoc): this
        // adapter does not validate the value — it forwards any defined
        // number verbatim, including Gemini's documented "-1 = dynamic
        // thinking" sentinel and a NaN a caller bug might produce. Whether a
        // given model accepts the value is left to the Gemini API to reject
        // loudly (400), not to this provider-neutral wrapper to silently
        // coerce.
        it('thinkingBudget이 음수(-1, dynamic thinking sentinel)여도 그대로 전달한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({ ...BASE_OPTIONS, thinkingBudget: -1 });

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: { thinkingConfig: { thinkingBudget: -1 } },
                })
            );
        });

        it('thinkingBudget이 NaN이어도 그대로 전달한다', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'ok' });

            await callGeminiChat({ ...BASE_OPTIONS, thinkingBudget: NaN });

            const call = mockGenerateContent.mock.calls[0][0];
            expect(call).toHaveProperty('config.thinkingConfig.thinkingBudget');
            expect(
                Number.isNaN(
                    (
                        call as {
                            config: {
                                thinkingConfig: { thinkingBudget: number };
                            };
                        }
                    ).config.thinkingConfig.thinkingBudget
                )
            ).toBe(true);
        });
    });
});
