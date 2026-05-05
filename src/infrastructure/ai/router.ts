import { callAnthropicChat } from '@/infrastructure/ai/anthropic';
import { callGeminiChat } from '@/infrastructure/ai/gemini';
import { callOpenaiChat } from '@/infrastructure/ai/openai';
import type {
    ActiveModelId,
    CallAiProviderOptions,
    ModelId,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';

export async function callAiProviderRouter(
    options: CallAiProviderOptions
): Promise<string> {
    // 0.7.3: getProviderForModel throws on unknown modelId (previously defaulted to 'openai').
    // Callers (chatAction / submitAnalysisAction) validate the model upstream, so the cast is
    // safe in normal flow; the throw surfaces wiring bugs instead of silently misrouting.
    const provider = getProviderForModel(options.model as ModelId);

    // Internal model key (e.g. 'claude-haiku-4-5') → provider API model ID
    // (e.g. 'claude-haiku-4-5-20251001'). The two may differ; always use apiModelId
    // for the actual SDK call so the provider recognises the model.
    const apiOptions: CallAiProviderOptions =
        options.model in MODEL_SPECS
            ? {
                  ...options,
                  model: MODEL_SPECS[options.model as ActiveModelId].apiModelId,
              }
            : options;

    switch (provider) {
        case 'anthropic':
            return callAnthropicChat(apiOptions);
        case 'openai':
            return callOpenaiChat(apiOptions);
        case 'google':
            return callGeminiChat(apiOptions);
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled AI provider: ${String(exhausted)}`);
        }
    }
}
