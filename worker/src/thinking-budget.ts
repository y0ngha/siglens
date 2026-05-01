/**
 * Thinking budget을 단계적으로 줄이며 재시도하기 위한 공통 유틸.
 * Gemini, Claude의 retry 모듈에서 공유한다.
 */

/** 표준 thinking budget 단계 — initial → initial/2 → initial/4 다음에 진입한다. */
export const THINKING_BUDGET_STEPS = [8192, 4096, 2048] as const;

/** Thinking 비활성 — 시퀀스의 마지막 단계. */
export const DISABLED_THINKING_BUDGET = 0;

/**
 * Mutable budget reference — withRetry/key fallback 체인에서 감소된 budget을 보존한다.
 * 매 시도마다 `current`가 다음 budget으로 갱신된다.
 */
export type BudgetRef = { current: number };

/**
 * MAX_TOKENS 발생 시 시도할 budget 시퀀스를 생성한다.
 *
 * 시퀀스: `initial → initial/2 → initial/4 → THINKING_BUDGET_STEPS → DISABLED_THINKING_BUDGET`
 *
 * 두 번 halving하여 가능한 한 큰 budget으로 더 시도해 응답 품질을 보존한다.
 * 이전 단계와 같거나 더 큰 값은 dedup으로 자동 제거된다.
 */
export function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [
        initial,
        Math.floor(initial / 2),
        Math.floor(initial / 4),
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
