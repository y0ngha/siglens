vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { withRetry } from '@/shared/lib/withRetry';
import {
    isNeonTransientError,
    NEON_TRANSIENT_RETRY,
} from '@/shared/db/isNeonTransientError';
import { NeonDbError } from '@neondatabase/serverless';

function createNeonError(code: string, message: string): NeonDbError {
    const err = new NeonDbError(message);
    (err as NeonDbError & { code: string }).code = code;
    return err;
}

describe('Database retry and transient error detection', () => {
    describe('isNeonTransientError', () => {
        it('detects admin_shutdown (57P01) via code field', () => {
            const err = createNeonError('57P01', 'admin shutdown');
            expect(isNeonTransientError(err)).toBe(true);
        });

        it('detects connection_failure (08006) via code field', () => {
            const err = createNeonError('08006', 'connection failure');
            expect(isNeonTransientError(err)).toBe(true);
        });

        it('detects too_many_connections (53300) via code field', () => {
            const err = createNeonError('53300', 'too many connections');
            expect(isNeonTransientError(err)).toBe(true);
        });

        it('detects transient error via message needle (fetch failed)', () => {
            const err = new NeonDbError(
                'Error connecting to database: TypeError: fetch failed'
            );
            expect(isNeonTransientError(err)).toBe(true);
        });

        it('detects transient error in cause chain (Drizzle wrapping)', () => {
            const inner = createNeonError('57P01', 'admin_shutdown');
            const outer = new Error('Failed query: SELECT ...', {
                cause: inner,
            });
            expect(isNeonTransientError(outer)).toBe(true);
        });

        it('returns false for non-retryable error (23505 unique violation)', () => {
            const err = createNeonError(
                '23505',
                'duplicate key value violates unique constraint'
            );
            expect(isNeonTransientError(err)).toBe(false);
        });

        it('returns false for plain Error without NeonDbError in chain', () => {
            const err = new Error('something else');
            expect(isNeonTransientError(err)).toBe(false);
        });

        it('returns false for non-Error values', () => {
            expect(isNeonTransientError('string error')).toBe(false);
            expect(isNeonTransientError(42)).toBe(false);
            expect(isNeonTransientError(null)).toBe(false);
        });

        it('handles deeply nested cause chain up to MAX_CAUSE_DEPTH', () => {
            let current: Error = createNeonError(
                '57P01',
                'buried transient error'
            );
            for (let i = 0; i < 7; i++) {
                current = new Error(`wrapper-${i}`, { cause: current });
            }
            expect(isNeonTransientError(current)).toBe(true);
        });

        it('does not match SQLSTATE code embedded in user data (no word boundary)', () => {
            const err = new NeonDbError('user_57P01ABC_check');
            expect(isNeonTransientError(err)).toBe(false);
        });
    });

    describe('withRetry exhaustion', () => {
        it('throws after all retries are exhausted', async () => {
            const transientError = createNeonError('57P01', 'shutdown');
            let callCount = 0;
            const fn = vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.reject(transientError);
            });

            await expect(
                withRetry(fn, {
                    maxRetries: 2,
                    baseDelayMs: 10,
                    isRetryable: isNeonTransientError,
                })
            ).rejects.toThrow('shutdown');

            expect(callCount).toBe(3);
        });

        it('does not retry non-retryable errors', async () => {
            const uniqueViolation = createNeonError(
                '23505',
                'unique violation'
            );
            const fn = vi.fn().mockRejectedValue(uniqueViolation);

            await expect(
                withRetry(fn, {
                    maxRetries: 3,
                    baseDelayMs: 10,
                    isRetryable: isNeonTransientError,
                })
            ).rejects.toThrow('unique violation');

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('succeeds on retry after transient failure', async () => {
            const transientError = createNeonError(
                '08006',
                'connection_failure'
            );
            const fn = vi
                .fn()
                .mockRejectedValueOnce(transientError)
                .mockResolvedValueOnce('success');

            const result = await withRetry(fn, {
                maxRetries: 2,
                baseDelayMs: 10,
                isRetryable: isNeonTransientError,
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('respects backoff budget and throws early', async () => {
            const transientError = createNeonError('57P01', 'shutdown');
            const fn = vi.fn().mockRejectedValue(transientError);

            await expect(
                withRetry(fn, {
                    maxRetries: 10,
                    baseDelayMs: 1000,
                    isRetryable: isNeonTransientError,
                    backoffBudgetMs: 1,
                })
            ).rejects.toThrow('shutdown');

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('NEON_TRANSIENT_RETRY preset', () => {
        it('has expected configuration', () => {
            expect(NEON_TRANSIENT_RETRY.maxRetries).toBe(3);
            expect(NEON_TRANSIENT_RETRY.baseDelayMs).toBe(200);
            expect(NEON_TRANSIENT_RETRY.backoffBudgetMs).toBe(5000);
            expect(NEON_TRANSIENT_RETRY.isRetryable).toBe(isNeonTransientError);
        });
    });
});
