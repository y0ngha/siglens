import type { LlmProvider } from '@/domain/llm';

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
    anthropic: 'Anthropic',
    google: 'Google',
    openai: 'OpenAI',
};
