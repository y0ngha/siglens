import { callClaude, MAX_TOKENS_CODE } from './claude.js';
import { CLAUDE_MODEL_THINKING_BUDGET } from './models.js';
import type { ClaudeModel } from './models.js';
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

/**
 * MAX_TOKENS 발생 시 thinking budget을 단계적으로 줄이며 같은 요청을 이어서 재시도한다.
 * `budgetRef.current`는 매 시도마다 갱신되어 5xx 재시도 시 감소된 budget에서 재개한다.
 */
export async function callClaudeReducingBudget(
    prompt: string,
    model: ClaudeModel,
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
            return await callClaude(prompt, {
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
                        `[Worker] Claude MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                // thinking off(budget=0)에서도 MAX_TOKENS → 응답 자체가 너무 긴 경우
                console.error(
                    '[Worker] Claude MAX_TOKENS even with thinking disabled. Response is too long.'
                );
                throw error;
            }

            // 429/5xx 등 일시적 에러 → 외부 withRetry로 전파
            // budgetRef.current는 이미 현재 budget으로 설정되어 있음
            throw error;
        }
    }

    // getThinkingBudgetSequence()는 항상 DISABLED_THINKING_BUDGET으로 끝나므로 루프는 return/throw로 종료된다.
    /* istanbul ignore next */
    throw new Error('All thinking budget steps exhausted');
}

export interface ClaudeWithRetryOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfCumulativeDelayReachesMs?: number;
    /** 미지정 시 `CLAUDE_MODEL_THINKING_BUDGET[model]`로 초기화된 새 참조가 생성됨 */
    budgetRef?: BudgetRef;
}

/**
 * 429/5xx 재시도 + MAX_TOKENS 시 thinking budget 축소를 결합한 Claude 호출.
 * Provider별 retry 모듈은 동일한 패턴 — Gemini의 `callGeminiWithRetry`와 대칭.
 */
export async function callClaudeWithRetry(
    prompt: string,
    model: ClaudeModel,
    apiKey: string,
    options: ClaudeWithRetryOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfCumulativeDelayReachesMs,
        budgetRef = { current: CLAUDE_MODEL_THINKING_BUDGET[model] },
    } = options;
    return withRetry(
        () =>
            callClaudeReducingBudget(prompt, model, apiKey, signal, budgetRef),
        {
            maxAttempts,
            baseDelayMs: AI_RETRY_DELAY_MS,
            abortIfCumulativeDelayReachesMs,
        }
    );
}
