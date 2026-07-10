import { callAnthropicChat } from './anthropic';
import { callGeminiChat } from './gemini';
import { callOpenaiChat } from './openai';
import { callDeepseekChat } from './deepseek';
import type {
    ActiveModelId,
    CallAiProviderOptions,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';

/**
 * Type guard verifying that a raw string is a known {@link ActiveModelId}.
 *
 * Using `model in MODEL_SPECS` narrows the union without an unsafe cast,
 * preventing silent misrouting if upstream callers pass an unknown model.
 */
function isActiveModelId(model: string): model is ActiveModelId {
    return model in MODEL_SPECS;
}

/**
 * Route a provider-neutral AI call to the correct SDK adapter.
 *
 * NOTE: `options.userApiKey` is currently passed through but unused by
 * providers (BYOK disabled until siglens-core integration). The parameter
 * stays on the options shape for future-proofing — when BYOK lands, the
 * adapters can read it without changing this router signature.
 */
export async function callAiProviderRouter(
    options: CallAiProviderOptions
): Promise<string> {
    // Validate the model first so the explicit `[router] Unknown model` error
    // surfaces with our message instead of being shadowed by the generic throw
    // inside `getProviderForModel`. Also makes the subsequent `MODEL_SPECS[...]`
    // and `getProviderForModel` calls type-safe without an `as` cast.
    if (!isActiveModelId(options.model)) {
        throw new Error(`[router] Unknown model: ${options.model}`);
    }

    const provider = getProviderForModel(options.model);

    // Internal model key (e.g. 'claude-haiku-4-5') → provider API model ID
    // (e.g. 'claude-haiku-4-5-20251001'). The two may differ; always use apiModelId
    // for the actual SDK call so the provider recognises the model.
    const apiOptions: CallAiProviderOptions = {
        ...options,
        model: MODEL_SPECS[options.model].apiModelId,
    };

    switch (provider) {
        case 'anthropic':
            return callAnthropicChat(apiOptions);
        case 'openai':
            return callOpenaiChat(apiOptions);
        case 'google':
            return callGeminiChat(apiOptions);
        case 'deepseek':
            return callDeepseekChat(apiOptions);
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled AI provider: ${String(exhausted)}`);
        }
    }
}
