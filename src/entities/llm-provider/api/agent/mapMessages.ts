import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

/**
 * Maps core's provider-neutral `AgentMessage` transcript to the OpenAI
 * Chat Completions message shape DeepSeek's OpenAI-compatible endpoint expects.
 */
export function toOpenAiChatMessages(
    messages: readonly AgentMessage[]
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
                })),
            };
        }
        return { role: m.role, content: m.content };
    });
}
