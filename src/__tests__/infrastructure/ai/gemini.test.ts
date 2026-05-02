const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
    const MockGoogleGenAI = jest.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    }));
    return { GoogleGenAI: MockGoogleGenAI };
});

import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

describe('callGeminiWithKeyFallback', () => {
    beforeEach(() => {
        mockGenerateContent.mockClear();
    });

    it('uses free key when it succeeds', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'free key response' });

        const result = await callGeminiWithKeyFallback({
            primaryApiKey: 'free-key',
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        expect(result).toBe('free key response');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('falls back to paid key when free key throws', async () => {
        mockGenerateContent
            .mockRejectedValueOnce(new Error('rate limit'))
            .mockResolvedValueOnce({ text: 'paid key response' });

        const result = await callGeminiWithKeyFallback({
            primaryApiKey: 'free-key',
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        expect(result).toBe('paid key response');
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('uses fallback key directly when primaryApiKey is undefined', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'paid response' });

        const result = await callGeminiWithKeyFallback({
            primaryApiKey: undefined,
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        expect(result).toBe('paid response');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('uses fallback key directly when primaryApiKey is empty string', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'paid response' });

        const result = await callGeminiWithKeyFallback({
            primaryApiKey: '',
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        expect(result).toBe('paid response');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('throws when paid key also fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('all failed'));

        await expect(
            callGeminiWithKeyFallback({
                primaryApiKey: undefined,
                fallbackApiKey: 'paid-key',
                model: 'gemini-2.0-flash',
                contents: 'Hello',
            })
        ).rejects.toThrow('all failed');
    });

    it('returns empty string when response.text is null/undefined', async () => {
        mockGenerateContent.mockResolvedValue({ text: undefined });

        const result = await callGeminiWithKeyFallback({
            primaryApiKey: undefined,
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        expect(result).toBe('');
    });

    it('passes systemInstruction in config when provided', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'ok' });

        await callGeminiWithKeyFallback({
            primaryApiKey: undefined,
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
            systemInstruction: 'Be concise.',
        });

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                config: { systemInstruction: 'Be concise.' },
            })
        );
    });

    it('does not include config when systemInstruction is undefined', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'ok' });

        await callGeminiWithKeyFallback({
            primaryApiKey: undefined,
            fallbackApiKey: 'paid-key',
            model: 'gemini-2.0-flash',
            contents: 'Hello',
        });

        const call = mockGenerateContent.mock.calls[0][0];
        expect(call).not.toHaveProperty('config');
    });
});
