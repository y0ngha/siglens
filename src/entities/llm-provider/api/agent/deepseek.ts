import 'server-only';
import type { AgentProviderResult } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from './mapMessages';
import {
    streamOpenAiCompatibleAgent,
    type AgentAdapterOptions,
} from './openAiCompatibleStream';

/** DeepSeek via the OpenAI-compatible chat.completions stream; thinking OFF (spec §2-6, pilot). */
export async function callDeepseekAgent(
    o: AgentAdapterOptions
): Promise<AgentProviderResult> {
    return streamOpenAiCompatibleAgent(o, {
        baseURL: 'https://api.deepseek.com',
        messages: toOpenAiChatMessages(o.messages),
        // DeepSeek-only top-level field, absent from the openai SDK types.
        extraBody: { thinking: { type: 'disabled' } },
    });
}
