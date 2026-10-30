import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

/**
 * core의 provider-중립 `AgentMessage` transcript를 OpenAI 호환 엔드포인트(DeepSeek, Gemini)가
 * 기대하는 OpenAI Chat Completions 메시지 모양으로 바꾼다.
 *
 * `toolCallExtra`는 재생되는 모든 assistant 도구 호출에 펼쳐진다. Gemini는 거기에
 * `extra_content.google.thought_signature`가 필요하고, 인자를 생략하면(DeepSeek) 페이로드는 그대로다.
 */
export function toOpenAiChatMessages(
    messages: readonly AgentMessage[],
    toolCallExtra?: Record<string, unknown>
): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(m => {
        if (m.role === 'tool') {
            // 빈 id는 이후 모든 턴에서 provider가 거절한다. 조용히 넘기지 않고 바로 실패시킨다.
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
                    // openai SDK 타입이 선언하지 않는 provider 전용 필드(예: Gemini `extra_content`).
                    // spread로 넣어 캐스트 없이 리터럴 타입을 유지한다.
                    ...toolCallExtra,
                })),
            };
        }
        return { role: m.role, content: m.content };
    });
}
