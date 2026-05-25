const mockAnthropicFinalMessage = vi.fn();
const mockOpenaiCreate = vi.fn();
const mockGeminiGenerate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
    default: class MockAnthropic {
        messages = {
            stream: () => ({ finalMessage: mockAnthropicFinalMessage }),
        };
    },
}));

vi.mock('openai', () => ({
    default: class MockOpenAI {
        responses = { create: mockOpenaiCreate };
    },
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: class MockGoogleGenAI {
        models = { generateContent: mockGeminiGenerate };
    },
}));

vi.mock('@y0ngha/siglens-core', () => ({
    MODEL_SPECS: {
        'claude-haiku-4-5': {
            apiModelId: 'claude-haiku-4-5-20251001',
            provider: 'anthropic',
            maxOutputTokens: 8192,
            temperature: 1.0,
        },
        'gpt-4.1-mini': {
            apiModelId: 'gpt-4.1-mini',
            provider: 'openai',
            maxOutputTokens: 16384,
            temperature: 1.0,
        },
        'gemini-2.5-flash': {
            apiModelId: 'gemini-2.5-flash',
            provider: 'google',
            maxOutputTokens: 8192,
            temperature: 1.0,
        },
    },
    getProviderForModel: (model: string) => {
        const map: Record<string, string> = {
            'claude-haiku-4-5': 'anthropic',
            'gpt-4.1-mini': 'openai',
            'gemini-2.5-flash': 'google',
        };
        return map[model];
    },
}));

import { callAiProviderRouter } from '@/entities/llm-provider/api/router';

const BASE_OPTIONS = {
    serverApiKey: 'test-key',
    userApiKey: undefined,
    contents: 'Hello',
    systemInstruction: undefined,
};

describe('LLM provider failure modes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Anthropic failures', () => {
        it('throws when response contains no text block', async () => {
            mockAnthropicFinalMessage.mockResolvedValue({
                content: [{ type: 'thinking', text: 'some thought' }],
                stop_reason: 'end_turn',
            });

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'claude-haiku-4-5',
                })
            ).rejects.toThrow('Anthropic returned no text content');
        });

        it('throws when content array is empty', async () => {
            mockAnthropicFinalMessage.mockResolvedValue({
                content: [],
                stop_reason: 'end_turn',
            });

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'claude-haiku-4-5',
                })
            ).rejects.toThrow('Anthropic returned no text content');
        });

        it('propagates 500 error from API', async () => {
            mockAnthropicFinalMessage.mockRejectedValue(
                new Error('500 Internal Server Error')
            );

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'claude-haiku-4-5',
                })
            ).rejects.toThrow('500 Internal Server Error');
        });
    });

    describe('OpenAI failures', () => {
        it('throws when output_text is null', async () => {
            mockOpenaiCreate.mockResolvedValue({ output_text: null });

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'gpt-4.1-mini',
                })
            ).rejects.toThrow('Provider returned null/undefined response');
        });

        it('throws when output_text is undefined', async () => {
            mockOpenaiCreate.mockResolvedValue({});

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'gpt-4.1-mini',
                })
            ).rejects.toThrow('Provider returned null/undefined response');
        });

        it('logs warning but returns empty string', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockOpenaiCreate.mockResolvedValue({ output_text: '' });

            const result = await callAiProviderRouter({
                ...BASE_OPTIONS,
                model: 'gpt-4.1-mini',
            });

            expect(result).toBe('');
            expect(warnSpy).toHaveBeenCalledWith(
                '[openai] Provider returned empty string'
            );
        });
    });

    describe('Gemini failures', () => {
        it('throws when text is null', async () => {
            mockGeminiGenerate.mockResolvedValue({ text: null });

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'gemini-2.5-flash',
                })
            ).rejects.toThrow('Provider returned null/undefined response');
        });

        it('throws when text is undefined', async () => {
            mockGeminiGenerate.mockResolvedValue({});

            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'gemini-2.5-flash',
                })
            ).rejects.toThrow('Provider returned null/undefined response');
        });
    });

    describe('Router-level failures', () => {
        it('throws for unknown model ID', async () => {
            await expect(
                callAiProviderRouter({
                    ...BASE_OPTIONS,
                    model: 'nonexistent-model',
                })
            ).rejects.toThrow('[router] Unknown model: nonexistent-model');
        });
    });
});
