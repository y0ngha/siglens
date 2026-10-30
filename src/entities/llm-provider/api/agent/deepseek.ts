import 'server-only';
import type { AgentProviderResult } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from './mapMessages';
import {
    streamOpenAiCompatibleAgent,
    type AgentAdapterOptions,
} from './openAiCompatibleStream';

/** DeepSeek을 OpenAI 호환 chat.completions 스트림으로 부른다(agent 기본 모델). thinking은 끈다. */
export async function callDeepseekAgent(
    o: AgentAdapterOptions
): Promise<AgentProviderResult> {
    return streamOpenAiCompatibleAgent(o, {
        baseURL: 'https://api.deepseek.com',
        messages: toOpenAiChatMessages(o.messages),
        // thinking이 꺼져 있으므로 DeepSeek이 샘플링 temperature를 적용한다.
        temperature: 0,
        // openai SDK 타입에 없는 DeepSeek 전용 최상위 필드.
        extraBody: { thinking: { type: 'disabled' } },
    });
}
