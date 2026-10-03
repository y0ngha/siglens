vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { withRetry } from '@/shared/lib/withRetry';
import {
    isTransientDbError,
    DB_TRANSIENT_RETRY,
} from '@/shared/db/isTransientDbError';
import postgres from 'postgres';

function createPostgresError(
    code: string,
    message: string
): postgres.PostgresError {
    // 실제 postgres-js가 서버 에러를 만드는 방식과 같다. 런타임 생성자는 응답 필드
    // 객체를 받아 Object.assign하지만 선언 타입은 string이라 캐스트가 필요하다.
    return new postgres.PostgresError({ code, message } as unknown as string);
}

describe('Database retry and transient error detection', () => {
    describe('isTransientDbError', () => {
        it('detects admin_shutdown (57P01) via code field', () => {
            const err = createPostgresError('57P01', 'admin shutdown');
            expect(isTransientDbError(err)).toBe(true);
        });

        it('detects connection_failure (08006) via code field', () => {
            const err = createPostgresError('08006', 'connection failure');
            expect(isTransientDbError(err)).toBe(true);
        });

        it('detects too_many_connections (53300) via code field', () => {
            const err = createPostgresError('53300', 'too many connections');
            expect(isTransientDbError(err)).toBe(true);
        });

        it('detects postgres-js connection error (CONNECTION_CLOSED)', () => {
            const err = Object.assign(
                new Error('write CONNECTION_CLOSED db.example:5432'),
                { code: 'CONNECTION_CLOSED' }
            );
            expect(isTransientDbError(err)).toBe(true);
        });

        it('detects transient error in cause chain (Drizzle wrapping)', () => {
            const inner = createPostgresError('57P01', 'admin_shutdown');
            const outer = new Error('Failed query: SELECT ...', {
                cause: inner,
            });
            expect(isTransientDbError(outer)).toBe(true);
        });

        it('returns false for non-retryable error (23505 unique violation)', () => {
            const err = createPostgresError(
                '23505',
                'duplicate key value violates unique constraint'
            );
            expect(isTransientDbError(err)).toBe(false);
        });

        it('returns false for plain Error without a DB error in chain', () => {
            const err = new Error('something else');
            expect(isTransientDbError(err)).toBe(false);
        });

        it('returns false for non-Error values', () => {
            expect(isTransientDbError('string error')).toBe(false);
            expect(isTransientDbError(42)).toBe(false);
            expect(isTransientDbError(null)).toBe(false);
        });

        it('handles deeply nested cause chain up to MAX_CAUSE_DEPTH', () => {
            let current: Error = createPostgresError(
                '57P01',
                'buried transient error'
            );
            for (let i = 0; i < 7; i++) {
                current = new Error(`wrapper-${i}`, { cause: current });
            }
            expect(isTransientDbError(current)).toBe(true);
        });

        it('does not match SQLSTATE text embedded in the message (code field only)', () => {
            const err = new Error('user_57P01ABC_check');
            expect(isTransientDbError(err)).toBe(false);
        });
    });

    describe('withRetry exhaustion', () => {
        it('throws after all retries are exhausted', async () => {
            const transientError = createPostgresError('57P01', 'shutdown');
            let callCount = 0;
            const fn = vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.reject(transientError);
            });

            await expect(
                withRetry(fn, {
                    maxRetries: 2,
                    baseDelayMs: 10,
                    isRetryable: isTransientDbError,
                })
            ).rejects.toThrow('shutdown');

            expect(callCount).toBe(3);
        });

        it('does not retry non-retryable errors', async () => {
            const uniqueViolation = createPostgresError(
                '23505',
                'unique violation'
            );
            const fn = vi.fn().mockRejectedValue(uniqueViolation);

            await expect(
                withRetry(fn, {
                    maxRetries: 3,
                    baseDelayMs: 10,
                    isRetryable: isTransientDbError,
                })
            ).rejects.toThrow('unique violation');

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('succeeds on retry after transient failure', async () => {
            const transientError = createPostgresError(
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
                isRetryable: isTransientDbError,
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('respects backoff budget and throws early', async () => {
            const transientError = createPostgresError('57P01', 'shutdown');
            const fn = vi.fn().mockRejectedValue(transientError);

            await expect(
                withRetry(fn, {
                    maxRetries: 10,
                    baseDelayMs: 1000,
                    isRetryable: isTransientDbError,
                    backoffBudgetMs: 1,
                })
            ).rejects.toThrow('shutdown');

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('DB_TRANSIENT_RETRY preset', () => {
        it('has expected configuration', () => {
            expect(DB_TRANSIENT_RETRY.maxRetries).toBe(3);
            expect(DB_TRANSIENT_RETRY.baseDelayMs).toBe(200);
            expect(DB_TRANSIENT_RETRY.backoffBudgetMs).toBe(5000);
            expect(DB_TRANSIENT_RETRY.isRetryable).toBe(isTransientDbError);
        });
    });
});
