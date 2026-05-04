import type { LlmProvider } from '@/domain/llm';

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
    anthropic: 'Claude (Anthropic)',
    google: 'Gemini (Google)',
    openai: 'ChatGPT (OpenAI)',
};
