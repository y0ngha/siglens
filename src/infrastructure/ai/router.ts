import { getProviderForModel } from '@y0ngha/siglens-core';
import type { CallAiProviderOptions, ModelId } from '@y0ngha/siglens-core';
import { callAnthropicChat } from './anthropic';
import { callGeminiWithKeyFallback } from './gemini';
import { callOpenaiChat } from './openai';

export async function callAiProviderRouter(
    options: CallAiProviderOptions
): Promise<string> {
    // Safe cast: getProviderForModel never throws — unknown strings fall through to
    // prefix matching ('claude-'/'gemini-') and default to 'openai'.
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
