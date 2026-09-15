import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

/**
 * Maps core's provider-neutral `AgentMessage` transcript to the OpenAI
 * Chat Completions message shape the OpenAI-compatible endpoints (DeepSeek,
 * Gemini) expect.
 *
 * `toolCallExtra` is spread onto every replayed assistant tool call. Gemini
 * needs `extra_content.google.thought_signature` there; omitting the argument
 * (DeepSeek) leaves the payload exactly as before.
 */
export function toOpenAiChatMessages(
    messages: readonly AgentMessage[],
    toolCallExtra?: Record<string, unknown>
): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(m => {
        if (m.role === 'tool') {
            // An empty id is rejected by the provider on every later turn; fail loudly instead.
            if (!m.toolCallId)
                throw new Error('[agent] tool message missing toolCallId');
            return {
                role: 'tool',
                tool_call_id: m.toolCallId,
                content: m.content,
            };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            return {
                role: 'assistant',
                content: m.content || null,
                tool_calls: m.toolCalls.map(c => ({
                    id: c.id,
                    type: 'function' as const,
                    function: {
                        name: c.name,
                        arguments: JSON.stringify(c.args),
                    },
                    // Provider-specific fields (e.g. Gemini `extra_content`) the openai SDK
                    // types don't declare; spread keeps the cast-free literal type.
                    ...toolCallExtra,
                })),
            };
        }
        return { role: m.role, content: m.content };
    });
}
