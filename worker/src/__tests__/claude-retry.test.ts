import { callClaude } from '../claude';
import {
    callClaudeReducingBudget,
    callClaudeWithRetry,
} from '../claude-retry';
import type { ClaudeModel } from '../models';
import { AI_RETRY_DELAY_MS, withRetry } from '../retry';

jest.mock('../claude', () => ({
    callClaude: jest.fn(),
    MAX_TOKENS_CODE: 'CLAUDE_MAX_TOKENS',
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

const mockCallClaude = callClaude as jest.MockedFunction<typeof callClaude>;
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

// claude-opus-4-7의 thinking budget = 32000 — 2단계 halving 시퀀스 검증에 적합
const MODEL_WITH_THINKING: ClaudeModel = 'claude-opus-4-7';
// haiku는 thinking 미지원 (기본 budget 0)
const MODEL_WITHOUT_THINKING: ClaudeModel = 'claude-haiku-3-5';

describe('claude-retry', () => {
    let MAX_TOKENS_ERROR: Error & { code: string };
    let SERVER_ERROR: Error & { status: number };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        MAX_TOKENS_ERROR = Object.assign(new Error('MAX_TOKENS'), {
            code: 'CLAUDE_MAX_TOKENS',
        });
        SERVER_ERROR = Object.assign(new Error('5xx'), { status: 503 });
    });

    describe('callClaudeReducingBudget', () => {
        it('returns result on successful first call', async () => {
            mockCallClaude.mockResolvedValueOnce('result');

            const budgetRef = { current: 32000 };
            const result = await callClaudeReducingBudget(
                'prompt',
                MODEL_WITH_THINKING,
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallClaude).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({
                    model: MODEL_WITH_THINKING,
                    apiKey: 'key',
                    thinkingBudget: 32000,
                    thinking: true,
                })
            );
        });

        it('reduces budget on MAX_TOKENS and retries with halved step', async () => {
            mockCallClaude
                .mockRejectedValueOnce(MAX_TOKENS_ERROR)
                .mockResolvedValueOnce('result');

            const budgetRef = { current: 32000 };
            const result = await callClaudeReducingBudget(
                'prompt',
                MODEL_WITH_THINKING,
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallClaude).toHaveBeenNthCalledWith(
                1,
                'prompt',
                expect.objectContaining({ thinkingBudget: 32000 })
            );
            expect(mockCallClaude).toHaveBeenNthCalledWith(
                2,
                'prompt',
                expect.objectContaining({ thinkingBudget: 16000 })
            );
        });

        it('falls through two halving steps before THINKING_BUDGET_STEPS', async () => {
            // 32000 → 16000 → 8000 → 4096 → 2048 → 0
            mockCallClaude
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 32000
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 16000
                .mockResolvedValueOnce('result'); // 8000

            const budgetRef = { current: 32000 };
            const result = await callClaudeReducingBudget(
                'prompt',
                MODEL_WITH_THINKING,
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallClaude).toHaveBeenNthCalledWith(
                3,
                'prompt',
                expect.objectContaining({ thinkingBudget: 8000 })
            );
            expect(budgetRef.current).toBe(8000);
        });

        it('disables thinking when budget reaches zero', async () => {
            // initial=4096 → sequence [4096, 2048, 1024, 0]
            // 3 rejections → 4th attempt at budget=0 with thinking disabled
            mockCallClaude
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 4096
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 2048
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 1024
                .mockResolvedValueOnce('result'); // 0 (thinking off)

            const budgetRef = { current: 4096 };
            const result = await callClaudeReducingBudget(
                'prompt',
                MODEL_WITH_THINKING,
                'key',
                undefined,
                budgetRef
            );

            expect(result).toBe('result');
            expect(mockCallClaude).toHaveBeenNthCalledWith(
                4,
                'prompt',
                expect.objectContaining({
                    thinking: false,
                    thinkingBudget: 0,
                })
            );
        });

        it('throws when MAX_TOKENS occurs with thinking already disabled', async () => {
            mockCallClaude.mockRejectedValue(MAX_TOKENS_ERROR);

            const budgetRef = { current: 0 };
            await expect(
                callClaudeReducingBudget(
                    'prompt',
                    MODEL_WITHOUT_THINKING,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toThrow('MAX_TOKENS');
        });

        it('propagates 5xx error and preserves current budget in budgetRef', async () => {
            mockCallClaude.mockRejectedValueOnce(SERVER_ERROR);

            const budgetRef = { current: 32000 };
            await expect(
                callClaudeReducingBudget(
                    'prompt',
                    MODEL_WITH_THINKING,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toEqual(SERVER_ERROR);

            expect(budgetRef.current).toBe(32000);
        });

        it('propagates null error (isMaxTokensError: null path)', async () => {
            mockCallClaude.mockRejectedValueOnce(null);

            const budgetRef = { current: 32000 };
            await expect(
                callClaudeReducingBudget(
                    'prompt',
                    MODEL_WITH_THINKING,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toBeNull();
        });

        it('propagates string error (isMaxTokensError: non-object path)', async () => {
            mockCallClaude.mockRejectedValueOnce('unexpected error');

            const budgetRef = { current: 32000 };
            await expect(
                callClaudeReducingBudget(
                    'prompt',
                    MODEL_WITH_THINKING,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toBe('unexpected error');
        });

        it('preserves reduced budget when 5xx follows MAX_TOKENS', async () => {
            mockCallClaude
                .mockRejectedValueOnce(MAX_TOKENS_ERROR) // 32000
                .mockRejectedValueOnce(SERVER_ERROR); // 16000 → 5xx

            const budgetRef = { current: 32000 };
            await expect(
                callClaudeReducingBudget(
                    'prompt',
                    MODEL_WITH_THINKING,
                    'key',
                    undefined,
                    budgetRef
                )
            ).rejects.toEqual(SERVER_ERROR);

            expect(budgetRef.current).toBe(16000);
        });
    });

    describe('callClaudeWithRetry', () => {
        it('delegates to withRetry with the configured retry policy', async () => {
            mockCallClaude.mockResolvedValueOnce('result');

            await callClaudeWithRetry('prompt', MODEL_WITH_THINKING, 'key', {
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
            mockCallClaude.mockResolvedValueOnce('result');

            const budgetRef = { current: 16000 };
            await callClaudeWithRetry(
                'prompt',
                MODEL_WITH_THINKING,
                'key',
                { budgetRef }
            );

            expect(mockCallClaude).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 16000 })
            );
        });

        it('creates new budgetRef from CLAUDE_MODEL_THINKING_BUDGET[model] when not provided', async () => {
            mockCallClaude.mockResolvedValueOnce('result');

            await callClaudeWithRetry('prompt', MODEL_WITH_THINKING, 'key');

            // claude-opus-4-7 default thinking budget = 32000
            expect(mockCallClaude).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({ thinkingBudget: 32000 })
            );
        });

        it('initializes budget to 0 for thinking-unsupported model', async () => {
            mockCallClaude.mockResolvedValueOnce('result');

            await callClaudeWithRetry('prompt', MODEL_WITHOUT_THINKING, 'key');

            // claude-haiku-3-5 default thinking budget = 0 (thinking 미지원)
            expect(mockCallClaude).toHaveBeenCalledWith(
                'prompt',
                expect.objectContaining({
                    thinking: false,
                    thinkingBudget: 0,
                })
            );
        });
    });
});
