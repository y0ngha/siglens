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
    // 어댑터가 도메인 level을 이 enum으로 매핑한다 — 없으면 import가 undefined다.
    ThinkingLevel: {
        MINIMAL: 'MINIMAL',
        LOW: 'LOW',
        MEDIUM: 'MEDIUM',
        HIGH: 'HIGH',
    },
    GoogleGenAI: class MockGoogleGenAI {
        models = { generateContent: mockGeminiGenerate };
    },
}));

vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    // provider 값은 MODEL_SPECS taxonomy('claude'/'chatgpt'/'gemini'/'deepseek')를
    // 따라야 한다 — 키 저장용 LlmProvider('anthropic'/'openai'/'google')와 다르다.
    // 어댑터가 provider로 좁히므로 어긋나면 429가 아니라 'Non-ChatGPT model spec'이
    // 먼저 던져져 이 스위트가 겨냥한 재시도 경로에 닿지 못한다.
    MODEL_SPECS: {
        'claude-haiku-4-5': {
            apiModelId: 'claude-haiku-4-5-20251001',
            provider: 'claude',
            thinkingApi: 'budget',
            maxOutputTokens: 8192,
            temperature: 1.0,
            reasoning: {
                off: { budgetTokens: 0 },
                on: { budgetTokens: 0 },
                default: 'off',
                toggleable: false,
            },
        },
        'gpt-4.1-mini': {
            apiModelId: 'gpt-4.1-mini',
            provider: 'chatgpt',
            maxOutputTokens: 16384,
            reasoning: {
                off: { effort: 'none' },
                on: { effort: 'high' },
                default: 'off',
            },
        },
        'gemini-3.6-flash': {
            apiModelId: 'gemini-3.6-flash',
            provider: 'gemini',
            maxOutputTokens: 8192,
            temperature: 1.0,
            reasoning: {
                off: { level: 'minimal' },
                on: { level: 'high' },
                default: 'off',
            },
        },
    },
    getProviderForModel: (model: string) => {
        const map: Record<string, string> = {
            'claude-haiku-4-5': 'anthropic',
            'gpt-4.1-mini': 'openai',
            'gemini-3.6-flash': 'google',
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
            callAiProviderRouter({ ...BASE, model: 'gemini-3.6-flash' })
        ).rejects.toThrow('429');
    });
});
