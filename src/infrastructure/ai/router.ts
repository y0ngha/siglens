import { getProviderForModel } from '@y0ngha/siglens-core';
import type { CallAiProviderOptions, ModelId } from '@y0ngha/siglens-core';
import { callAnthropicChat } from '@/infrastructure/ai/anthropic';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';
import { callOpenaiChat } from '@/infrastructure/ai/openai';

export async function callAiProviderRouter(
    options: CallAiProviderOptions
): Promise<string> {
    // 0.7.3: getProviderForModel throws on unknown modelId (previously defaulted to 'openai').
    // Callers (chatAction / submitAnalysisAction) validate the model upstream, so the cast is
    // safe in normal flow; the throw surfaces wiring bugs instead of silently misrouting.
    const provider = getProviderForModel(options.model as ModelId);
    switch (provider) {
        case 'anthropic':
            return callAnthropicChat(options);
        case 'openai':
            return callOpenaiChat(options);
        case 'google':
            return callGeminiWithKeyFallback(options);
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled AI provider: ${String(exhausted)}`);
        }
    }
}
