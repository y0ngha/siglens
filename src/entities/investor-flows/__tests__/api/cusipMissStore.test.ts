import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createRedisCusipMissStore,
    MISS_TTL_SECONDS,
} from '../../api/cusipMissStore';

vi.mock('server-only', () => ({}));

const { redis, getRedisClient } = vi.hoisted(() => {
    const pipeline = {
        set: vi.fn(),
        incr: vi.fn(),
        expire: vi.fn(),
        del: vi.fn(),
        exec: vi.fn(async (): Promise<unknown[]> => []),
    };
    for (const method of [
        pipeline.set,
        pipeline.incr,
        pipeline.expire,
        pipeline.del,
    ]) {
        method.mockReturnValue(pipeline);
    }
    const redis = {
        mget: vi.fn(),
        pipeline: vi.fn(() => pipeline),
        _pipeline: pipeline,
    };
    return { redis, getRedisClient: vi.fn(() => redis as unknown) };
});
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient }));

const DAY = '2026-10-16';
/** Keys written as a miss (the day-gate `SET NX` also goes through `set`). */
const missWrites = (): string[] =>
    redis._pipeline.set.mock.calls
        .map(call => String(call[0]))
        .filter(key => key.includes(':cusip-miss:'));

describe('createRedisCusipMissStore', () => {
    beforeEach(() => {
        redis.mget.mockReset();
        redis.pipeline.mockClear();
        for (const method of Object.values(redis._pipeline)) method.mockClear();
        getRedisClient.mockReturnValue(redis);
    });

    it('returns the symbols whose miss key exists', async () => {
        redis.mget.mockResolvedValue([null, '1', null]);
        const misses = await createRedisCusipMissStore().findRecentMisses([
            'AAA',
            'BBB',
            'CCC',
        ]);
        expect([...misses]).toEqual(['BBB']);
        expect(redis.mget).toHaveBeenCalledWith(
            'investor-flows:cusip-miss:v1:AAA',
            'investor-flows:cusip-miss:v1:BBB',
            'investor-flows:cusip-miss:v1:CCC'
        );
    });

    it('writes misses with their own TTL in one pipeline', async () => {
        await createRedisCusipMissStore().recordMisses([
            { symbol: 'SPY', ttlSeconds: MISS_TTL_SECONDS.notCommonStock },
            { symbol: 'ZZZ', ttlSeconds: MISS_TTL_SECONDS.noProfile },
        ]);
        expect(redis._pipeline.set).toHaveBeenCalledWith(
            'investor-flows:cusip-miss:v1:SPY',
            '1',
            { ex: MISS_TTL_SECONDS.notCommonStock }
        );
        expect(redis._pipeline.set).toHaveBeenCalledWith(
            'investor-flows:cusip-miss:v1:ZZZ',
            '1',
            { ex: MISS_TTL_SECONDS.noProfile }
        );
        expect(redis._pipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('reports no misses and writes nothing when Redis is unavailable', async () => {
        getRedisClient.mockReturnValue(null);
        const store = createRedisCusipMissStore();
        expect((await store.findRecentMisses(['AAA'])).size).toBe(0);
        await store.recordMisses([{ symbol: 'AAA', ttlSeconds: 1 }]);
        expect(redis.mget).not.toHaveBeenCalled();
        expect(redis.pipeline).not.toHaveBeenCalled();
    });

    it('swallows a Redis read failure (no misses known → retry next time)', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        redis.mget.mockRejectedValue(new Error('down'));
        const misses = await createRedisCusipMissStore().findRecentMisses([
            'AAA',
        ]);
        expect(misses.size).toBe(0);
        error.mockRestore();
    });

    describe('recordFailures (consecutive-failure counter → miss at the threshold)', () => {
        it('counts below the threshold without marking, and sets the counter lifetime only once (NX)', async () => {
            redis._pipeline.exec
                .mockResolvedValueOnce(['OK', 'OK'])
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([]);
            const marked = await createRedisCusipMissStore().recordFailures(
                ['AAA', 'BBB'],
                3,
                MISS_TTL_SECONDS.persistentError,
                DAY
            );
            expect(marked).toEqual([]);
            expect(redis._pipeline.incr).toHaveBeenCalledWith(
                'investor-flows:cusip-fail:v1:AAA'
            );
            expect(missWrites()).toEqual([]);
            expect(redis._pipeline.expire).toHaveBeenCalledWith(
                'investor-flows:cusip-fail:v1:AAA',
                expect.any(Number),
                'NX'
            );
        });

        it('at the threshold it writes the miss with the short TTL, drops the counter and returns the symbol', async () => {
            redis._pipeline.exec
                .mockResolvedValueOnce(['OK', 'OK'])
                .mockResolvedValueOnce([3, 1])
                .mockResolvedValueOnce([]);
            const marked = await createRedisCusipMissStore().recordFailures(
                ['AAA', 'BBB'],
                3,
                MISS_TTL_SECONDS.persistentError,
                DAY
            );
            expect(marked).toEqual(['AAA']);
            expect(redis._pipeline.set).toHaveBeenCalledWith(
                'investor-flows:cusip-miss:v1:AAA',
                '1',
                { ex: MISS_TTL_SECONDS.persistentError }
            );
            expect(redis._pipeline.del).toHaveBeenCalledWith(
                'investor-flows:cusip-fail:v1:AAA'
            );
            expect(missWrites()).toEqual(['investor-flows:cusip-miss:v1:AAA']);
        });

        it('counts a symbol at most once per UTC day: a symbol already gated today is not incremented', async () => {
            // AAA already counted today (SET NX returns null); BBB is new today
            redis._pipeline.exec
                .mockResolvedValueOnce([null, 'OK'])
                .mockResolvedValueOnce([1])
                .mockResolvedValueOnce([]);
            await createRedisCusipMissStore().recordFailures(
                ['AAA', 'BBB'],
                3,
                MISS_TTL_SECONDS.persistentError,
                DAY
            );
            expect(redis._pipeline.set).toHaveBeenCalledWith(
                `investor-flows:cusip-fail-day:v1:AAA:${DAY}`,
                '1',
                expect.objectContaining({ nx: true })
            );
            expect(redis._pipeline.incr).toHaveBeenCalledTimes(1);
            expect(redis._pipeline.incr).toHaveBeenCalledWith(
                'investor-flows:cusip-fail:v1:BBB'
            );
        });

        it('when every symbol was already counted today nothing is incremented or marked', async () => {
            redis._pipeline.exec.mockResolvedValueOnce([null, null]);
            const marked = await createRedisCusipMissStore().recordFailures(
                ['AAA', 'BBB'],
                1,
                MISS_TTL_SECONDS.persistentError,
                DAY
            );
            expect(marked).toEqual([]);
            expect(redis._pipeline.incr).not.toHaveBeenCalled();
        });

        it('the persistent-error miss is short (a week) so the symbol becomes eligible again', () => {
            expect(MISS_TTL_SECONDS.persistentError).toBeLessThan(
                MISS_TTL_SECONDS.noProfile
            );
        });

        it('does nothing without Redis and swallows a Redis failure', async () => {
            getRedisClient.mockReturnValue(null);
            expect(
                await createRedisCusipMissStore().recordFailures(
                    ['A'],
                    3,
                    1,
                    DAY
                )
            ).toEqual([]);
            getRedisClient.mockReturnValue(redis);
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            redis._pipeline.exec.mockRejectedValueOnce(new Error('down'));
            expect(
                await createRedisCusipMissStore().recordFailures(
                    ['A'],
                    3,
                    1,
                    DAY
                )
            ).toEqual([]);
            error.mockRestore();
        });
    });
});
