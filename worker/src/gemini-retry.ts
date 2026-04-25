import { callGemini, MAX_TOKENS_CODE } from './gemini.js';
import { config } from './config.js';
import { withRetry } from './retry.js';

const AI_RETRY_MAX_ATTEMPTS = 5;
const AI_RETRY_MAX_ATTEMPTS_FREE = 3;
const AI_RETRY_DELAY_MS = 5000;

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

/**
 * MAX_TOKENS 발생 시 시도할 thinkingBudget 단계.
 * initial → initial/2 → 8192 → 4096 → 2048 → 0(thinking off)
 * 엄격한 감소 순서를 보장하기 위해 이전 값보다 작은 경우만 포함한다.
 */
export function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [initial, Math.floor(initial / 2), 8192, 4096, 2048, 0];
    return candidates.reduce<number[]>((acc, budget) => {
        if (acc.length === 0 || budget < acc[acc.length - 1]) {
            return [...acc, budget];
        }
        return acc;
    }, []);
}

/**
 * MAX_TOKENS 발생 시 thinkingBudget을 단계적으로 낮춰가며 1회씩 시도한다.
 * 429/5xx 등 일시적 에러는 재시도하지 않고 그대로 throw하여
 * 외부 withRetry 레이어에서 처리하도록 한다.
 *
 * budgetRef.current는 매 시도 시작 시 현재 budget으로 업데이트된다.
 * 5xx로 withRetry 재호출 시 감소된 budget에서 재개할 수 있게 한다.
 */
export async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string,
    signal: AbortSignal | undefined,
    budgetRef: { current: number }
): Promise<string> {
    const budgets = getThinkingBudgetSequence(budgetRef.current);

    for (const budget of budgets) {
        budgetRef.current = budget;
        try {
            return await callGemini(prompt, {
                apiKey,
                model: config.gemini.model,
                thinking: budget > 0,
                thinkingBudget: budget,
                signal,
            });
        } catch (error) {
            if (isMaxTokensError(error)) {
                const idx = budgets.indexOf(budget);
                const next = budgets[idx + 1];
                if (next !== undefined) {
                    console.warn(
                        `[Worker] MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                // thinking off(budget=0)에서도 MAX_TOKENS → 응답 자체가 너무 긴 경우
                console.error(
                    '[Worker] MAX_TOKENS even with thinking disabled. Response is too long.'
                );
                throw error;
            }

            // 429/5xx 등 일시적 에러 → 외부 withRetry로 전파
            // budgetRef.current는 이미 현재 budget으로 설정되어 있음
            throw error;
        }
    }

    // unreachable: 루프는 반드시 return 또는 throw로 종료됨
    throw new Error('All thinking budget steps exhausted');
}

export interface GeminiWithFallbackOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfDelayExceedsMs?: number;
    /**
     * Free→Paid 키 전환 시 budget 상태를 공유하기 위한 참조.
     * 미지정 시 config.gemini.thinkingBudget으로 초기화된 새 참조가 생성된다.
     */
    budgetRef?: { current: number };
}

export async function callGeminiWithRetry(
    prompt: string,
    apiKey: string,
    options: GeminiWithFallbackOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfDelayExceedsMs,
        budgetRef = { current: config.gemini.thinkingBudget },
    } = options;
    return withRetry(
        () => callGeminiReducingBudget(prompt, apiKey, signal, budgetRef),
        {
            maxAttempts,
            baseDelayMs: AI_RETRY_DELAY_MS,
            abortIfDelayExceedsMs,
        }
    );
    // TODO: fallback model 임시 비활성화
    // free API key의 할당량이 key 단위로 공유되어 fallback도 즉시 실패하는 문제 확인 필요
    // try {
    //     return await withRetry(() => callGeminiReducingBudget(prompt, apiKey), ...);
    // } catch {
    //     return withRetry(() => callGeminiReducingBudget(prompt, apiKey, fallbackModel), ...);
    // }
}

export async function callGeminiWithKeyFallback(
    prompt: string,
    signal: AbortSignal | undefined,
    freeKeyDelayLimit: number
): Promise<string> {
    const { freeApiKey, apiKey } = config.gemini;
    const budgetRef = { current: config.gemini.thinkingBudget };

    if (freeApiKey) {
        try {
            return await callGeminiWithRetry(prompt, freeApiKey, {
                maxAttempts: AI_RETRY_MAX_ATTEMPTS_FREE,
                signal,
                abortIfDelayExceedsMs: freeKeyDelayLimit,
                budgetRef,
            });
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err;
            console.warn(
                '[Worker] Free API key exhausted. Switching to paid key.'
            );
        }
    }

    return callGeminiWithRetry(prompt, apiKey, { signal, budgetRef });
}
