import type { LlmProvider } from '@y0ngha/siglens-core';

/** All supported LLM provider identifiers for stored user API keys. */
export const LLM_PROVIDER_VALUES = [
    'anthropic',
    'google',
    'openai',
] as const satisfies readonly LlmProvider[];
