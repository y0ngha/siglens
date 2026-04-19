jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn(),
        },
    })),
}));

import { GoogleGenAI } from '@google/genai';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

const MockGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

const BASE_OPTIONS = {
    paidApiKey: 'paid-key',
    model: 'gemini-2.5-flash',
    contents: 'test prompt',
    systemInstruction: 'You are a helper.',
} as const;

describe('callGeminiWithKeyFallback 함수는', () => {
    let mockGenerateContent: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateContent = jest.fn().mockResolvedValue({ text: 'response' });
        MockGoogleGenAI.mockImplementation(
            () =>
                ({
                    models: { generateContent: mockGenerateContent },
                }) as unknown as InstanceType<typeof GoogleGenAI>
        );
    });

    it('freeApiKey가 undefined이면 paid key로 직접 호출한다', async () => {
        const result = await callGeminiWithKeyFallback({
            ...BASE_OPTIONS,
            freeApiKey: undefined,
        });

        expect(MockGoogleGenAI).toHaveBeenCalledTimes(1);
        expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'paid-key' });
        expect(result).toBe('response');
    });

    it('freeApiKey가 있고 성공하면 free key를 사용하고 paid key는 호출하지 않는다', async () => {
        const result = await callGeminiWithKeyFallback({
            ...BASE_OPTIONS,
            freeApiKey: 'free-key',
        });

        expect(MockGoogleGenAI).toHaveBeenCalledTimes(1);
        expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'free-key' });
        expect(result).toBe('response');
    });

    it('freeApiKey가 있고 실패하면 paid key로 fallback한다', async () => {
        mockGenerateContent
            .mockRejectedValueOnce(new Error('quota exceeded'))
            .mockResolvedValueOnce({ text: 'paid response' });

        const result = await callGeminiWithKeyFallback({
            ...BASE_OPTIONS,
            freeApiKey: 'free-key',
        });

        expect(MockGoogleGenAI).toHaveBeenCalledTimes(2);
        expect(MockGoogleGenAI).toHaveBeenNthCalledWith(1, { apiKey: 'free-key' });
        expect(MockGoogleGenAI).toHaveBeenNthCalledWith(2, { apiKey: 'paid-key' });
        expect(result).toBe('paid response');
    });

    it('systemInstruction이 undefined이면 config 없이 generateContent를 호출한다', async () => {
        await callGeminiWithKeyFallback({
            ...BASE_OPTIONS,
            freeApiKey: undefined,
            systemInstruction: undefined,
        });

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.not.objectContaining({ config: expect.anything() })
        );
    });

    it('systemInstruction이 있으면 config에 포함하여 generateContent를 호출한다', async () => {
        await callGeminiWithKeyFallback({
            ...BASE_OPTIONS,
            freeApiKey: undefined,
            systemInstruction: 'Be helpful.',
        });

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                config: { systemInstruction: 'Be helpful.' },
            })
        );
    });
});
