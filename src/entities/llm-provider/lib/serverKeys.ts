import 'server-only';
import type { LlmProvider } from '@y0ngha/siglens-core';

/**
 * Server-owned key per provider, forwarded to core as `serverApiKey` on
 * every request. Core charges it for free models (any tier) and pro-tier
 * premium models; non-pro premium requests are charged to the user's BYOK
 * key (`userApiKey`) instead.
 */
export function getServerPrimaryKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        case 'deepseek':
            return process.env.DEEPSEEK_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}
