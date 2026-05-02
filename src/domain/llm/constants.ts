/** All supported LLM provider identifiers for stored user API keys. */
export const LLM_PROVIDER_VALUES = [
    'anthropic',
    'google',
    'openai',
] as const;

/** Identifier for an LLM provider whose API key a user can bring (BYOK). */
export type LlmProvider = (typeof LLM_PROVIDER_VALUES)[number];
