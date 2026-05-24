import type { AIProvider } from '@y0ngha/siglens-core';

export {
    LLM_PROVIDER_VALUES,
    type LlmProvider,
} from '@/shared/config/llmProviders';

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
