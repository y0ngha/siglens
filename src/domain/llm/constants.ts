import type { AIProvider } from '@y0ngha/siglens-core';

/** All supported LLM provider identifiers for stored user API keys. */
export const LLM_PROVIDER_VALUES = ['anthropic', 'google', 'openai'] as const;

/** Identifier for an LLM provider whose API key a user can bring (BYOK). */
export type LlmProvider = (typeof LLM_PROVIDER_VALUES)[number];

// Core exports AIProvider type-only; siglens owns the runtime list. `satisfies`
// forbids stale values; the Exclude<...> check below enforces exhaustiveness.
export const AI_PROVIDER_VALUES = [
    'claude',
    'gemini',
    'chatgpt',
] as const satisfies readonly AIProvider[];

// If core adds e.g. 'mistral' to AIProvider, `Exclude<...>` becomes
// `'mistral'` (non-never), the conditional returns `never`, and the
// `const = true` assignment fails to typecheck — forcing an update here.
type _AiProviderExhaustivenessCheck =
    Exclude<AIProvider, (typeof AI_PROVIDER_VALUES)[number]> extends never
        ? true
        : never;
const _aiProviderExhaustive: _AiProviderExhaustivenessCheck = true;
void _aiProviderExhaustive;
