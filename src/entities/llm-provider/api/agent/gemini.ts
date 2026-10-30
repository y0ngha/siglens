import 'server-only';
import type { AgentProviderResult } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from './mapMessages';
import {
    streamOpenAiCompatibleAgent,
    type AgentAdapterOptions,
} from './openAiCompatibleStream';

/**
 * Gemini 3은 thought signature가 없는 재생된 assistant 도구 호출을 모두 400으로 거절한다 —
 * 같은 대화에서 앞서 DeepSeek이 만든 호출도 포함하며, 바로 폴백 상황이다. Google이 문서화한,
 * 검증을 건너뛰는 더미 값이다(2026-09-15 실측).
 */
const GEMINI_TOOL_CALL_EXTRA = {
    extra_content: {
        google: { thought_signature: 'skip_thought_signature_validator' },
    },
};

/** Gemini를 OpenAI 호환 chat.completions 엔드포인트로 부른다(agent 폴백 모델). 추론은 minimal이다. */
export async function callGeminiAgent(
    o: AgentAdapterOptions
): Promise<AgentProviderResult> {
    return streamOpenAiCompatibleAgent(o, {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        messages: toOpenAiChatMessages(o.messages, GEMINI_TOOL_CALL_EXTRA),
        extraBody: { reasoning_effort: 'minimal' },
    });
}
