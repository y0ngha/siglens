import { callAnthropicChat } from './anthropic';
import { callGeminiChat } from './gemini';
import { callOpenaiChat } from './openai';
import { callDeepseekChat } from './deepseek';
import type { CallAiProviderOptions } from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import type { ProviderCallOptions } from '../model';

/**
 * Route a provider-neutral AI call to the correct SDK adapter.
 *
 * **Key routing.** siglens-core hands over exactly one of `userApiKey` (BYOK,
 * charged to the user) / `serverApiKey` (charged to us) per call and leaves the
 * other `undefined` — see `resolveApiKeys` in core's `requestChatCompletion`.
 * This router collapses the pair into a single `apiKey` before dispatching, so
 * no adapter can pick the wrong one. It also throws when both are missing
 * rather than letting the call proceed: the Anthropic and OpenAI SDKs silently
 * fall back to the `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars when handed
 * `undefined`, which would bill a BYOK user's request to the server's
 * analysis-side key.
 */
export async function callAiProviderRouter(
    options: CallAiProviderOptions
): Promise<string> {
    // Validate the model first so the explicit `[router] Unknown model` error
    // surfaces with our message instead of being shadowed by the generic throw
    // inside `getProviderForModel`. Also makes the subsequent `MODEL_SPECS[...]`
    // and `getProviderForModel` calls type-safe without an `as` cast.
    // See `isActiveModelId` (`shared/lib/isActiveModelId.ts`) for why
    // `Object.hasOwn` — not `in` — is required here.
    if (!isActiveModelId(options.model)) {
        throw new Error(`[router] Unknown model: ${options.model}`);
    }

    const { userApiKey, serverApiKey, ...rest } = options;
    const apiKey = userApiKey ?? serverApiKey;
    if (apiKey === undefined) {
        throw new Error(
            `[router] No API key supplied for model: ${options.model}`
        );
    }

    const provider = getProviderForModel(options.model);

    // Internal model key (e.g. 'claude-haiku-4-5') → provider API model ID
    // (e.g. 'claude-haiku-4-5-20251001'). The two may differ; always use apiModelId
    // for the actual SDK call so the provider recognises the model.
    const apiOptions: ProviderCallOptions = {
        ...rest,
        apiKey,
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
