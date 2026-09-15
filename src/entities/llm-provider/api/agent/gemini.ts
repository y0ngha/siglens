import 'server-only';
import type { AgentProviderResult } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from './mapMessages';
import {
    streamOpenAiCompatibleAgent,
    type AgentAdapterOptions,
} from './openAiCompatibleStream';

/**
 * Gemini 3 rejects (HTTP 400) any replayed assistant tool call without a
 * thought signature — including calls DeepSeek produced earlier in the same
 * conversation, which is exactly the fallback case. This is Google's
 * documented dummy value that skips the validation (verified live 2026-09-15).
 */
export const GEMINI_TOOL_CALL_EXTRA = {
    extra_content: {
        google: { thought_signature: 'skip_thought_signature_validator' },
    },
};

/** Gemini via its OpenAI-compatible chat.completions endpoint (agent fallback), reasoning minimal. */
export async function callGeminiAgent(
    o: AgentAdapterOptions
): Promise<AgentProviderResult> {
    return streamOpenAiCompatibleAgent(o, {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        messages: toOpenAiChatMessages(o.messages, GEMINI_TOOL_CALL_EXTRA),
        extraBody: { reasoning_effort: 'minimal' },
    });
}
