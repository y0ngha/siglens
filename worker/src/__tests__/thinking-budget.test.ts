import {
    DISABLED_THINKING_BUDGET,
    THINKING_BUDGET_STEPS,
    getThinkingBudgetSequence,
} from '../thinking-budget';

describe('getThinkingBudgetSequence', () => {
    it('returns full descending sequence with two halving steps for high initial value', () => {
        // 32000 → 16000 → 8000 → THINKING_BUDGET_STEPS (8192 deduped) → 4096 → 2048 → 0
        expect(getThinkingBudgetSequence(32000)).toEqual([
            32000,
            16000,
            8000,
            4096,
            2048,
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('halves twice before falling into THINKING_BUDGET_STEPS for Gemini default budget', () => {
        // 24576 → 12288 → 6144 → THINKING_BUDGET_STEPS (8192 deduped, 4096 added) → 2048 → 0
        expect(getThinkingBudgetSequence(24576)).toEqual([
            24576,
            12288,
            6144,
            4096,
            2048,
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('deduplicates halving values that match standard candidates', () => {
        // 8192 → 4096 (dup with halving) → 2048 → 0
        expect(getThinkingBudgetSequence(8192)).toEqual([
            THINKING_BUDGET_STEPS[0],
            THINKING_BUDGET_STEPS[1],
            THINKING_BUDGET_STEPS[2],
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('excludes candidates larger than initial and adds quarter halving below standard steps', () => {
        // 4096 → 2048 → 1024 → THINKING_BUDGET_STEPS (all 8192/4096/2048 skipped) → 0
        expect(getThinkingBudgetSequence(4096)).toEqual([
            4096,
            2048,
            1024,
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('returns only zero when initial is zero', () => {
        expect(getThinkingBudgetSequence(0)).toEqual([
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('includes both halvings when both fall between standard candidates', () => {
        // 18000 → 9000 → 4500 → THINKING_BUDGET_STEPS (8192 skipped, 4096 added, 2048 added) → 0
        expect(getThinkingBudgetSequence(18000)).toEqual([
            18000,
            9000,
            4500,
            4096,
            2048,
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('skips halving when it equals a standard candidate', () => {
        // 16384 → 8192 (dup) → 4096 (dup) → THINKING_BUDGET_STEPS (8192 skipped, 4096 skipped, 2048 added) → 0
        expect(getThinkingBudgetSequence(16384)).toEqual([
            16384,
            THINKING_BUDGET_STEPS[0],
            THINKING_BUDGET_STEPS[1],
            THINKING_BUDGET_STEPS[2],
            DISABLED_THINKING_BUDGET,
        ]);
    });

    it('exposes the standard steps tuple unchanged', () => {
        expect(THINKING_BUDGET_STEPS).toEqual([8192, 4096, 2048]);
    });
});
