import { callChatGPT } from './chatgpt.js';
import type { ChatGPTModel } from './models.js';
import {
    AI_RETRY_DELAY_MS,
    AI_RETRY_MAX_ATTEMPTS,
    withRetry,
} from './retry.js';

export interface ChatGPTWithRetryOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfCumulativeDelayReachesMs?: number;
}

/**
 * 429/5xx 재시도를 결합한 ChatGPT 호출.
 * Provider별 retry 모듈은 동일한 패턴 — Gemini/Claude의 retry 모듈과 대칭.
 * ChatGPT는 thinking budget 개념이 없어 budget 축소 로직 없이 단순 withRetry로 래핑한다.
 */
export async function callChatGPTWithRetry(
    prompt: string,
    model: ChatGPTModel,
    apiKey: string,
    options: ChatGPTWithRetryOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfCumulativeDelayReachesMs,
    } = options;
    return withRetry(() => callChatGPT(prompt, { model, apiKey, signal }), {
        maxAttempts,
        baseDelayMs: AI_RETRY_DELAY_MS,
        abortIfCumulativeDelayReachesMs,
    });
}
