import type { LlmProvider } from '@/entities/api-key';

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
    anthropic: 'Claude (Anthropic)',
    google: 'Gemini (Google)',
    openai: 'ChatGPT (OpenAI)',
};
