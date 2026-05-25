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

const BASE = {
    serverApiKey: 'key',
    userApiKey: undefined,
    contents: 'test',
};

function create429Error(provider: string): Error {
    const err = new Error(`${provider} 429 Rate limit exceeded`);
    (err as Error & { status: number }).status = 429;
    return err;
}

describe('AI provider 429 rate limit errors', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates 429 from Anthropic', async () => {
        mockAnthropicFinalMessage.mockRejectedValue(
            create429Error('Anthropic')
        );

        await expect(
            callAiProviderRouter({ ...BASE, model: 'claude-haiku-4-5' })
        ).rejects.toThrow('429');
    });

    it('propagates 429 from OpenAI', async () => {
        mockOpenaiCreate.mockRejectedValue(create429Error('OpenAI'));

        await expect(
            callAiProviderRouter({ ...BASE, model: 'gpt-4.1-mini' })
        ).rejects.toThrow('429');
    });

    it('propagates 429 from Gemini', async () => {
        mockGeminiGenerate.mockRejectedValue(create429Error('Gemini'));

        await expect(
            callAiProviderRouter({ ...BASE, model: 'gemini-2.5-flash' })
        ).rejects.toThrow('429');
    });
});
