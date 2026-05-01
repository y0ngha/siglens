import { config } from './config.js';
import { callGemini, MAX_TOKENS_CODE } from './gemini.js';
import { GEMINI_MODEL_THINKING_BUDGET } from './models.js';
import type { GeminiModel } from './models.js';
import {
    AI_RETRY_DELAY_MS,
    AI_RETRY_MAX_ATTEMPTS,
    hasErrorCode,
    withRetry,
} from './retry.js';
import {
    DISABLED_THINKING_BUDGET,
    getThinkingBudgetSequence,
} from './thinking-budget.js';
import type { BudgetRef } from './thinking-budget.js';

const AI_RETRY_MAX_ATTEMPTS_FREE = 3;

// MAX_TOKENS 발생 시 thinking budget을 단계적으로 줄이며 같은 요청을 이어서 재시도한다.
// budgetRef.current는 매 시도마다 업데이트되어 5xx 재시도 시 감소된 budget에서 재개한다
export async function callGeminiReducingBudget(
    prompt: string,
    model: GeminiModel,
    apiKey: string,
    signal: AbortSignal | undefined,
    budgetRef: BudgetRef
): Promise<string> {
    const budgets = getThinkingBudgetSequence(budgetRef.current);
    const budgetCount = budgets.length;

    for (let i = 0; i < budgetCount; i++) {
        const budget = budgets[i];
        budgetRef.current = budget;
        try {
            return await callGemini(prompt, {
                apiKey,
                model,
                thinking: budget > DISABLED_THINKING_BUDGET,
                thinkingBudget: budget,
                signal,
            });
        } catch (error) {
            if (hasErrorCode(error, MAX_TOKENS_CODE)) {
                const next = budgets[i + 1];
                if (next !== undefined) {
                    console.warn(
                        `[Worker] Gemini MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                // thinking off(budget=0)에서도 MAX_TOKENS → 응답 자체가 너무 긴 경우
                console.error(
                    '[Worker] Gemini MAX_TOKENS even with thinking disabled. Response is too long.'
                );
                throw error;
            }

            // 429/5xx 등 일시적 에러 → 외부 withRetry로 전파
            // budgetRef.current는 이미 현재 budget으로 설정되어 있음
            throw error;
        }
    }

    // getThinkingBudgetSequence() always ends with DISABLED_THINKING_BUDGET, so the loop exits by return/throw.
    /* istanbul ignore next */
    throw new Error('All thinking budget steps exhausted');
}

export interface GeminiWithRetryOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfCumulativeDelayReachesMs?: number;
    /** 미지정 시 `GEMINI_MODEL_THINKING_BUDGET[model]`로 초기화된 새 참조가 생성됨 */
    budgetRef?: BudgetRef;
}

export async function callGeminiWithRetry(
    prompt: string,
    model: GeminiModel,
    apiKey: string,
    options: GeminiWithRetryOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfCumulativeDelayReachesMs,
        budgetRef = { current: GEMINI_MODEL_THINKING_BUDGET[model] },
    } = options;
    return withRetry(
        () =>
            callGeminiReducingBudget(prompt, model, apiKey, signal, budgetRef),
        {
            maxAttempts,
            baseDelayMs: AI_RETRY_DELAY_MS,
            abortIfCumulativeDelayReachesMs,
        }
    );
}

/**
 * Server-side Gemini 호출 (free → paid key fallback).
 * Analyze에서 SIGLENS_PROVIDED_MODELS 호출 시 또는 briefing에서 사용한다.
 * User key 경로는 `callGeminiWithRetry`를 직접 호출 (fallback 없음).
 */
export async function callGeminiWithKeyFallback(
    prompt: string,
    model: GeminiModel,
    signal: AbortSignal | undefined,
    freeKeyDelayLimit: number
): Promise<string> {
    const { freeApiKey, apiKey } = config.gemini;
    const budgetRef = { current: GEMINI_MODEL_THINKING_BUDGET[model] };

    if (freeApiKey) {
        try {
            return await callGeminiWithRetry(prompt, model, freeApiKey, {
                maxAttempts: AI_RETRY_MAX_ATTEMPTS_FREE,
                signal,
                abortIfCumulativeDelayReachesMs: freeKeyDelayLimit,
                budgetRef,
            });
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err;
            console.warn(
                '[Worker] Gemini free API key exhausted. Switching to paid key.'
            );
        }
    }

    return callGeminiWithRetry(prompt, model, apiKey, { signal, budgetRef });
}
