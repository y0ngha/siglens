import {
    callGeminiReducingBudget,
    callGeminiWithKeyFallback,
    callGeminiWithRetry,
    DISABLED_THINKING_BUDGET,
    getThinkingBudgetSequence,
    THINKING_BUDGET_STEPS,
} from '../gemini-retry';
import { callGemini } from '../gemini';
import { withRetry } from '../retry';

jest.mock('../gemini', () => ({
    callGemini: jest.fn(),
    MAX_TOKENS_CODE: 'GEMINI_MAX_TOKENS',
}));

jest.mock('../config', () => ({
    config: {
        gemini: {
            model: 'test-model',
            thinkingBudget: 24576,
            apiKey: 'paid-key',
            freeApiKey: 'free-key',
        },
        aiProvider: 'gemini',
    },
}));

jest.mock('../retry', () => ({
    withRetry: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
}));

// jest.mock('../gemini', ...) 호출로 런타임 타입이 MockedFunction임이 보장됨
const mockCallGemini = callGemini as jest.MockedFunction<typeof callGemini>;
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

describe('gemini-retry', () => {
    let MAX_TOKENS_ERROR: Error & { code: string };
    let SERVER_ERROR: Error & { status: number };

    beforeEach(() => {
        jest.clearAllMocks();
        MAX_TOKENS_ERROR = Object.assign(new Error('MAX_TOKENS'), {
            code: 'GEMINI_MAX_TOKENS',
        });
        SERVER_ERROR = Object.assign(new Error('5xx'), { status: 503 });
    });

    describe('getThinkingBudgetSequence', () => {
        it('returns full descending sequence for high initial value', () => {
            expect(getThinkingBudgetSequence(24576)).toEqual([
                24576,
                12288,
                ...THINKING_BUDGET_STEPS,
                DISABLED_THINKING_BUDGET,
            ]);
        });

        it('starts from half when initial equals a mid-range candidate', () => {
            expect(getThinkingBudgetSequence(8192)).toEqual([
                THINKING_BUDGET_STEPS[0],
                THINKING_BUDGET_STEPS[1],
                THINKING_BUDGET_STEPS[2],
                DISABLED_THINKING_BUDGET,
            ]);
        });

        it('excludes candidates larger than initial', () => {
            expect(getThinkingBudgetSequence(4096)).toEqual([
                THINKING_BUDGET_STEPS[1],
                THINKING_BUDGET_STEPS[2],
                DISABLED_THINKING_BUDGET,
            ]);
        });

        it('returns only zero when initial is zero', () => {
            expect(getThinkingBudgetSequence(0)).toEqual([
                DISABLED_THINKING_BUDGET,
            ]);
        });

        it('includes half-value when it falls between standard candidates', () => {
            // initial=18000 → half=9000 sits between 8192 and the next candidate
            expect(getThinkingBudgetSequence(18000)).toEqual([
                18000,
                9000,
                ...THINKING_BUDGET_STEPS,
                DISABLED_THINKING_BUDGET,
            ]);
        });

        it('skips half-value when it equals a standard candidate', () => {
            // initial=16384 → half=8192 equals the standard 8192 candidate
            expect(getThinkingBudgetSequence(16384)).toEqual([
                16384,
                ...THINKING_BUDGET_STEPS,
                DISABLED_THINKING_BUDGET,
            ]);
        });
    });

    describe('callGeminiReducingBudget', () => {
        it('returns result on successful first call', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            const budgetRef = { current: 24576 };
            const result = await callGeminiReducingBudget(
                'prompt',
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 24576 })
            );
        });

        it('reduces budget on MAX_TOKENS and retries with next step', async () => {
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR)
                .mockResolvedValueOnce('result');

            const budgetRef = { current: 24576 };
            const result = await callGeminiReducingBudget(
                'prompt',
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallGemini).toHaveBeenNthCalledWith(
                1,
                'prompt',
                expect.objectContaining({ thinkingBudget: 24576 })
            );
            expect(mockCallGemini).toHaveBeenNthCalledWith(
                2,
                'prompt',
                expect.objectContaining({ thinkingBudget: 12288 })
            );
        });

        it('throws when MAX_TOKENS occurs with thinking disabled (budget=0)', async () => {
            mockCallGemini.mockRejectedValue(MAX_TOKENS_ERROR);

            const budgetRef = { current: 0 };
            await expect(
                callGeminiReducingBudget('prompt', 'key', undefined, budgetRef)
            ).rejects.toThrow('MAX_TOKENS');
        });

        it('propagates 5xx error and preserves current budget in budgetRef', async () => {
            mockCallGemini.mockRejectedValueOnce(SERVER_ERROR);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget('prompt', 'key', undefined, budgetRef)
            ).rejects.toEqual(SERVER_ERROR);

            // budgetRef reflects the budget being tried when 5xx occurred
            expect(budgetRef.current).toBe(24576);
        });

        it('propagates null error (isMaxTokensError: null path)', async () => {
            mockCallGemini.mockRejectedValueOnce(null);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget('prompt', 'key', undefined, budgetRef)
            ).rejects.toBeNull();
        });

        it('propagates string error (isMaxTokensError: non-object path)', async () => {
            mockCallGemini.mockRejectedValueOnce('unexpected string error');

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget('prompt', 'key', undefined, budgetRef)
            ).rejects.toBe('unexpected string error');
        });

        it('preserves reduced budget in budgetRef when 5xx follows MAX_TOKENS (Bug 1)', async () => {
            // Sequence: MAX_TOKENS at 24576 → continues to 12288 → 5xx at 12288
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR)
                .mockRejectedValueOnce(SERVER_ERROR);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget('prompt', 'key', undefined, budgetRef)
            ).rejects.toEqual(SERVER_ERROR);

            // Must be 12288 (reduced), not 24576 (initial)
            // withRetry's next attempt will start from this reduced budget
            expect(budgetRef.current).toBe(12288);
        });
    });

    describe('callGeminiWithRetry', () => {
        it('delegates to withRetry with the configured retry policy', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            await callGeminiWithRetry('prompt', 'key', {
                maxAttempts: 7,
                abortIfCumulativeDelayReachesMs: 15000,
            });

            expect(mockWithRetry).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    maxAttempts: 7,
                    baseDelayMs: 5000,
                    abortIfCumulativeDelayReachesMs: 15000,
                })
            );
        });

        it('uses provided budgetRef as starting budget (Bug 2 mechanism)', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            // Simulate budget already reduced to 12288 by prior free key attempts
            const budgetRef = { current: 12288 };
            await callGeminiWithRetry('prompt', 'paid-key', { budgetRef });

            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 12288 })
            );
        });

        it('creates new budgetRef from config.gemini.thinkingBudget when not provided', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            await callGeminiWithRetry('prompt', 'key');

            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 24576 })
            );
        });
    });

    describe('callGeminiWithKeyFallback', () => {
        it('returns immediately when free key succeeds on first call', async () => {
            mockCallGemini.mockResolvedValueOnce('free-result');

            const result = await callGeminiWithKeyFallback(
                'prompt',
                undefined,
                30000
            );

            expect(result).toBe('free-result');
            expect(mockCallGemini).toHaveBeenCalledTimes(1);
            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ apiKey: 'free-key' })
            );
        });

        it('passes the same budgetRef to paid key after free key exhaustion (Bug 2)', async () => {
            // Free key call reduces the shared budgetRef before failing.
            // Paid key call must resume from that reduced budget, not the initial budget.
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // free, budget=24576 → reduces to 12288
                .mockRejectedValueOnce(SERVER_ERROR) // free, budget=12288 → fail and fall back
                .mockResolvedValueOnce('paid-result'); // paid, budget=12288 → success

            const result = await callGeminiWithKeyFallback(
                'prompt',
                undefined,
                30000
            );

            expect(result).toBe('paid-result');
            // Third callGemini call is the paid key attempt — must use reduced budget
            expect(mockCallGemini.mock.calls[2][1]).toMatchObject({
                apiKey: 'paid-key',
                thinkingBudget: 12288,
            });
            expect(mockWithRetry).toHaveBeenCalledTimes(2);
        });

        it('rethrows AbortError from free key phase without falling back to paid key', async () => {
            const abortError = Object.assign(new Error('Aborted'), {
                name: 'AbortError',
            });
            mockCallGemini.mockRejectedValueOnce(abortError);

            await expect(
                callGeminiWithKeyFallback('prompt', undefined, 30000)
            ).rejects.toMatchObject({ name: 'AbortError' });

            expect(mockCallGemini).toHaveBeenCalledTimes(1);
        });

        it('calls paid key directly when freeApiKey is not configured', async () => {
            // jest.requireMock는 unknown 반환 — jest.mock('../config', ...) 로 형태 보장됨
            const { config } = jest.requireMock('../config') as {
                config: { gemini: { freeApiKey: string } };
            };
            const saved = config.gemini.freeApiKey;
            try {
                config.gemini.freeApiKey = '';
                mockCallGemini.mockResolvedValueOnce('result');

                await callGeminiWithKeyFallback('prompt', undefined, 30000);

                expect(mockCallGemini).toHaveBeenCalledWith(
                    'prompt',
                    expect.objectContaining({ apiKey: 'paid-key' })
                );
                expect(mockCallGemini).toHaveBeenCalledTimes(1);
            } finally {
                config.gemini.freeApiKey = saved;
            }
        });
    });
});
