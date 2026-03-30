import { ClaudeProvider } from './claude';
import { GeminiProvider } from './gemini';
import type { AIProvider, AIProviderType } from './types';

const AI_PROVIDER_MAP: Record<AIProviderType, () => AIProvider> = {
    claude: () => new ClaudeProvider(),
    gemini: () => new GeminiProvider(),
};

const DEFAULT_AI_PROVIDER: AIProviderType = 'claude';

export function createAIProvider(): AIProvider {
    const raw = process.env.AI_PROVIDER;
    const providerType =
        raw && raw in AI_PROVIDER_MAP
            ? (raw as AIProviderType)
            : DEFAULT_AI_PROVIDER;
    return AI_PROVIDER_MAP[providerType]();
}
