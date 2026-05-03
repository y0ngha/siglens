import type { AIProvider } from '@y0ngha/siglens-core';

/** All supported LLM provider identifiers for stored user API keys. */
export const LLM_PROVIDER_VALUES = ['anthropic', 'google', 'openai'] as const;

/** Identifier for an LLM provider whose API key a user can bring (BYOK). */
export type LlmProvider = (typeof LLM_PROVIDER_VALUES)[number];

/**
 * Runtime values for siglens-core's `AIProvider` type. Core only exports the
 * type (no array), so siglens owns the single source of truth for the
 * runtime list.
 *
 * Two compile-time guards keep this list synchronized with core's union in
 * BOTH directions:
 *   1. `satisfies readonly AIProvider[]` — every value MUST be a member of
 *      AIProvider (catches stale/removed providers still listed here).
 *   2. The `_AiProviderExhaustivenessCheck` type assertion below — every
 *      member of AIProvider MUST appear in this array (catches new providers
 *      added to core that are missing here).
 */
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
