import {
    callGeminiReducingBudget,
    callGeminiWithKeyFallback,
    callGeminiWithRetry,
} from '../gemini-retry';
import { callGemini } from '../gemini';
import type { GeminiModel } from '../models';
import { AI_RETRY_DELAY_MS, withRetry } from '../retry';

jest.mock('../gemini', () => ({
    callGemini: jest.fn(),
    MAX_TOKENS_CODE: 'GEMINI_MAX_TOKENS',
}));

jest.mock('../config', () => ({
    config: {
        gemini: {
            apiKey: 'paid-key',
            freeApiKey: 'free-key',
        },
        aiProvider: 'gemini',
    },
}));

jest.mock('../retry', () => ({
    withRetry: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
    AI_RETRY_MAX_ATTEMPTS: 5,
    AI_RETRY_DELAY_MS: 5000,
    hasErrorCode: (error: unknown, code: string): boolean =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === code,
}));

// jest.mock('../gemini', ...) 호출로 런타임 타입이 MockedFunction임이 보장됨
const mockCallGemini = callGemini as jest.MockedFunction<typeof callGemini>;
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

// flash-lite의 기본 thinking budget=24576을 그대로 활용해 기존 테스트 시퀀스(24576→12288→...)를 재사용한다.
const MODEL: GeminiModel = 'gemini-2.5-flash-lite';

describe('gemini-retry', () => {
    let MAX_TOKENS_ERROR: Error & { code: string };
    let SERVER_ERROR: Error & { status: number };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        MAX_TOKENS_ERROR = Object.assign(new Error('MAX_TOKENS'), {
            code: 'GEMINI_MAX_TOKENS',
        });
        SERVER_ERROR = Object.assign(new Error('5xx'), { status: 503 });
    });

    describe('callGeminiReducingBudget', () => {
        it('returns result on successful first call', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            const budgetRef = { current: 24576 };
            const result = await callGeminiReducingBudget(
                'prompt',
                MODEL,
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
                MODEL,
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

        it('falls through two halving steps before reaching THINKING_BUDGET_STEPS', async () => {
            // 24576 → 12288 → 6144 → 4096 → 2048 → 0
            // First two halvings exhaust before standard steps engage.
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 24576
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 12288
                .mockResolvedValueOnce('result'); // 6144

            const budgetRef = { current: 24576 };
            const result = await callGeminiReducingBudget(
                'prompt',
                MODEL,
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallGemini).toHaveBeenNthCalledWith(
                3,
                'prompt',
                expect.objectContaining({ thinkingBudget: 6144 })
            );
            expect(budgetRef.current).toBe(6144);
        });

        it('throws when MAX_TOKENS occurs with thinking disabled (budget=0)', async () => {
            mockCallGemini.mockRejectedValue(MAX_TOKENS_ERROR);

            const budgetRef = { current: 0 };
            await expect(
                callGeminiReducingBudget(
                    'prompt',
                    MODEL,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toThrow('MAX_TOKENS');
        });

        it('propagates 5xx error and preserves current budget in budgetRef', async () => {
            mockCallGemini.mockRejectedValueOnce(SERVER_ERROR);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget(
                    'prompt',
                    MODEL,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toEqual(SERVER_ERROR);

            // budgetRef reflects the budget being tried when 5xx occurred
            expect(budgetRef.current).toBe(24576);
        });

        it('propagates null error (isMaxTokensError: null path)', async () => {
            mockCallGemini.mockRejectedValueOnce(null);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget(
                    'prompt',
                    MODEL,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toBeNull();
        });

        it('propagates string error (isMaxTokensError: non-object path)', async () => {
            mockCallGemini.mockRejectedValueOnce('unexpected string error');

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget(
                    'prompt',
                    MODEL,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toBe('unexpected string error');
        });

        it('preserves reduced budget in budgetRef when 5xx follows MAX_TOKENS', async () => {
            // Sequence: MAX_TOKENS at 24576 → continues to 12288 → 5xx at 12288
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR)
                .mockRejectedValueOnce(SERVER_ERROR);

            const budgetRef = { current: 24576 };
            await expect(
                callGeminiReducingBudget(
                    'prompt',
                    MODEL,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toEqual(SERVER_ERROR);

            // Must be 12288 (reduced), not 24576 (initial)
            // withRetry's next attempt will start from this reduced budget
            expect(budgetRef.current).toBe(12288);
        });
    });

    describe('callGeminiWithRetry', () => {
        it('delegates to withRetry with the configured retry policy', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            await callGeminiWithRetry('prompt', MODEL, 'key', {
                maxAttempts: 7,
                abortIfCumulativeDelayReachesMs: 15000,
            });

            expect(mockWithRetry).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    maxAttempts: 7,
                    baseDelayMs: AI_RETRY_DELAY_MS,
                    abortIfCumulativeDelayReachesMs: 15000,
                })
            );
        });

        it('uses provided budgetRef as starting budget', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            // Simulate budget already reduced to 12288 by prior free key attempts
            const budgetRef = { current: 12288 };
            await callGeminiWithRetry('prompt', MODEL, 'paid-key', {
                budgetRef,
            });

            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 12288 })
            );
        });

        it('creates new budgetRef from GEMINI_MODEL_THINKING_BUDGET[model] when not provided', async () => {
            mockCallGemini.mockResolvedValueOnce('result');

            await callGeminiWithRetry('prompt', MODEL, 'key');

            // gemini-2.5-flash-lite default thinking budget = 24576
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
                MODEL,
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

        it('passes the same budgetRef to paid key after free key exhaustion', async () => {
            // Free key call reduces the shared budgetRef before failing.
            // Paid key call must resume from that reduced budget, not the initial budget.
            mockCallGemini
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // free, budget=24576 → reduces to 12288
                .mockRejectedValueOnce(SERVER_ERROR) // free, budget=12288 → fail and fall back
                .mockResolvedValueOnce('paid-result'); // paid, budget=12288 → success

            const result = await callGeminiWithKeyFallback(
                'prompt',
                MODEL,
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
                callGeminiWithKeyFallback('prompt', MODEL, undefined, 30000)
            ).rejects.toMatchObject({ name: 'AbortError' });

            expect(mockCallGemini).toHaveBeenCalledTimes(1);
        });

        it('calls paid key directly when freeApiKey is not configured', async () => {
            // jest.requireMock는 unknown 반환 — jest.mock('../config', ...) 로 형태 보장됨
            const { config } = jest.requireMock('../config') as {
                config: { gemini: { freeApiKey: string } };
            };
            jest.replaceProperty(config.gemini, 'freeApiKey', '');
            mockCallGemini.mockResolvedValueOnce('result');

            await callGeminiWithKeyFallback('prompt', MODEL, undefined, 30000);

            expect(mockCallGemini).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ apiKey: 'paid-key' })
            );
            expect(mockCallGemini).toHaveBeenCalledTimes(1);
        });

        it('propagates error when paid key also fails', async () => {
            const paidKeyError = new Error('paid key exhausted');
            mockCallGemini
                .mockRejectedValueOnce(SERVER_ERROR) // free key fails
                .mockRejectedValueOnce(paidKeyError); // paid key fails

            await expect(
                callGeminiWithKeyFallback('prompt', MODEL, undefined, 30000)
            ).rejects.toThrow('paid key exhausted');
        });
    });
});
