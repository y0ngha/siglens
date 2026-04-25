import { callGemini, MAX_TOKENS_CODE } from './gemini.js';
import { config } from './config.js';
import { withRetry } from './retry.js';

const AI_RETRY_MAX_ATTEMPTS = 5;
const AI_RETRY_MAX_ATTEMPTS_FREE = 3;
const AI_RETRY_DELAY_MS = 5000;
export const THINKING_BUDGET_STEPS = [8192, 4096, 2048] as const;
export const DISABLED_THINKING_BUDGET = 0;

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        // 'code' in error 가드로 좁혀졌지만 TS가 { code: unknown }으로 완전 추론하지 못해 캐스트
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

// MAX_TOKENS 발생 시 thinking budget을 단계적으로 줄이며 같은 요청을 이어서 재시도한다.
export function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [
        initial,
        Math.floor(initial / 2),
        ...THINKING_BUDGET_STEPS,
        DISABLED_THINKING_BUDGET,
    ];
    return candidates.reduce<number[]>((acc, budget) => {
        if (acc.length === 0 || budget < acc[acc.length - 1]) {
            return [...acc, budget];
        }
        return acc;
    }, []);
}

// budgetRef.current는 매 시도마다 업데이트되어 5xx 재시도 시 감소된 budget에서 재개한다
export async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string,
    signal: AbortSignal | undefined,
    budgetRef: { current: number }
): Promise<string> {
    const budgets = getThinkingBudgetSequence(budgetRef.current);
    const budgetCount = budgets.length;

    for (let i = 0; i < budgetCount; i++) {
        const budget = budgets[i];
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
                const next = budgets[i + 1];
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

    // getThinkingBudgetSequence() always ends with DISABLED_THINKING_BUDGET, so the loop exits by return/throw.
    throw new Error('All thinking budget steps exhausted');
}

export interface GeminiWithRetryOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfCumulativeDelayReachesMs?: number;
    // 미지정 시 config.gemini.thinkingBudget으로 초기화된 새 참조가 생성됨
    budgetRef?: { current: number };
}

export async function callGeminiWithRetry(
    prompt: string,
    apiKey: string,
    options: GeminiWithRetryOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfCumulativeDelayReachesMs,
        budgetRef = { current: config.gemini.thinkingBudget },
    } = options;
    return withRetry(
        () => callGeminiReducingBudget(prompt, apiKey, signal, budgetRef),
        {
            maxAttempts,
            baseDelayMs: AI_RETRY_DELAY_MS,
            abortIfCumulativeDelayReachesMs,
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
                abortIfCumulativeDelayReachesMs: freeKeyDelayLimit,
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
