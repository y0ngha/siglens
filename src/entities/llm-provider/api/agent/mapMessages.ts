import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

/**
 * 객체 키를 모든 깊이에서 코드 유닛 순으로 정렬해 직렬화한다(배열 순서는 그대로).
 *
 * `chat_messages.tool_calls`는 jsonb라 Postgres가 키 순서를 보존하지 않는다(길이, 바이트 순으로 돌려준다).
 * 같은 호출이 이번 턴에는 모델이 낸 순서로, 다음 턴에는 저장소가 돌려준 순서로 직렬화되면 요청이 지난 턴
 * 요청의 접두사에서 어긋나 provider 캐시가 끊긴다. 정렬해 두면 어느 쪽이든 같은 바이트가 나온다.
 */
function stableStringify(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, v]) => [key, sortKeys(v)])
    );
}

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
                        arguments: stableStringify(c.args),
                    },
                    // openai SDK 타입이 선언하지 않는 provider 전용 필드(예: Gemini `extra_content`).
                    // spread로 넣어 캐스트 없이 리터럴 타입을 유지한다.
                    ...toolCallExtra,
                })),
            };
        }
        if (m.role === 'user' && m.images && m.images.length > 0)
            return {
                role: 'user',
                content: [
                    // 글 없이 이미지만 보낸 턴은 빈 text 파트를 만들지 않는다(일부 엔드포인트가 거절한다).
                    ...(m.content === ''
                        ? []
                        : [{ type: 'text' as const, text: m.content }]),
                    ...m.images.map(image => ({
                        type: 'image_url' as const,
                        image_url: {
                            url: `data:${image.mediaType};base64,${image.data}`,
                        },
                    })),
                ],
            };
        return { role: m.role, content: m.content };
    });
}
