import { GoogleGenAI } from '@google/genai';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';
import { config } from './config.js';

/**
 * MAX_TOKENS 에러 식별 코드.
 * thinkingBudget을 줄여 재시도해야 함을 호출 측에 알린다.
 */
export const MAX_TOKENS_CODE = 'GEMINI_MAX_TOKENS';

const GEMINI_TIMEOUT_MS = 3600_000;

const clientCache = new Map<string, GoogleGenAI>();

function getClient(apiKey: string): GoogleGenAI {
    let client = clientCache.get(apiKey);
    if (!client) {
        client = new GoogleGenAI({ apiKey });
        clientCache.set(apiKey, client);
    }
    return client;
}

export interface GeminiCallOptions {
    model?: string;
    thinking?: boolean;
    apiKey?: string;
    thinkingBudget?: number;
    signal?: AbortSignal;
}

export async function callGemini(
    prompt: string,
    options: GeminiCallOptions = {}
): Promise<string> {
    const modelName = options.model ?? config.gemini.model;
    const client = getClient(options.apiKey ?? config.gemini.apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    // 외부 취소 신호를 타임아웃 컨트롤러에 전파 — abort 시 Gemini HTTP 요청을 즉시 중단한다.
    // propagateAbort는 finally에서 제거해 신호가 발생하지 않은 경우의 리스너 누수를 방지한다.
    const propagateAbort = () => controller.abort();
    options.signal?.addEventListener('abort', propagateAbort, { once: true });

    const start = Date.now();
    try {
        const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                abortSignal: controller.signal,
                systemInstruction: AI_SYSTEM_PROMPT,
                temperature: 0,
                topP: 0.95,
                maxOutputTokens: 65536,
                responseMimeType: 'application/json',
                ...(options.thinking === true && {
                    thinkingConfig: {
                        // -1(무제한)은 output token budget을 thinking이 전부 소모하여
                        // MAX_TOKENS + 빈 텍스트 응답을 유발한다.
                        // 호출 측에서 모델별 상한을 주입한다.
                        // flash-lite: 24576 / flash: 32768
                        thinkingBudget:
                            options.thinkingBudget ??
                            config.gemini.thinkingBudget,
                        includeThoughts: false,
                    },
                }),
            },
        });

        const elapsed = Date.now() - start;
        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const text = response.text;

        console.log(
            `[Gemini] Response time: ${elapsed}ms (model: ${modelName}, finishReason: ${finishReason}`
        );

        if (finishReason === 'STOP') {
            if (text) {
                return text;
            } else {
                console.warn('[Gemini] Empty text response', {
                    model: modelName,
                    finishReason,
                });
                throw Object.assign(
                    new Error(
                        `Gemini returned an empty text response (finishReason: ${finishReason})`
                    ),
                    { retryable: true }
                );
            }
        } else if (finishReason === 'SAFETY') {
            // 안전 필터 차단 — 재시도해도 동일하게 차단되므로 non-retryable로 처리한다.
            const safetyRatings = candidate?.safetyRatings ?? [];
            console.error('[Gemini] Response blocked by safety filter', {
                model: modelName,
                safetyRatings,
            });
            throw new Error(
                `Gemini blocked response due to safety filter (finishReason: SAFETY)`
            );
        } else if (finishReason === 'MAX_TOKENS') {
            // 출력 토큰 한도 초과 — 같은 thinkingBudget으로 재시도해도 동일하게 실패한다.
            // non-retryable로 던져 호출 측에서 thinkingBudget을 줄여 재시도하도록 한다.
            console.warn('[Gemini] MAX_TOKENS: output truncated', {
                model: modelName,
                finishReason,
            });
            throw Object.assign(
                new Error(
                    `Gemini hit output token limit (model: ${modelName})`
                ),
                { code: MAX_TOKENS_CODE }
            );
        }

        // SAFETY/MAX_TOKENS 외 이유로 빈 텍스트가 반환된 경우(thinking 전용 응답 등)는
        // 일시적 문제로 보고 재시도한다.
        console.warn('[Gemini] Invalid response', {
            model: modelName,
            finishReason,
            text,
        });
        throw Object.assign(
            new Error(`Invalid Gemini response: finishReason ${finishReason}`),
            { retryable: true }
        );
    } finally {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener('abort', propagateAbort);
    }
}
