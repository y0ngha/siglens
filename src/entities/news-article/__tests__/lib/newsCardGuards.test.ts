const { mockGetRedisClient } = vi.hoisted(() => ({
    mockGetRedisClient: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withNewsCardAnalysisLock } from '@/entities/news-article/lib/newsCardAnalysisLock';
import {
    NEWS_REFRESH_FLAG_TTL_SECONDS,
    NEWS_REFRESH_RETRY_TTL_SECONDS,
    shortenNewsRefreshClaim,
    tryClaimNewsRefresh,
} from '@/entities/news-article/lib/newsRefreshFlag';
import {
    loadNewsCardFailures,
    nextFailureState,
    recordNewsCardFailures,
    retryDelayMs,
} from '@/entities/news-article/lib/newsCardFailureBackoff';
import { MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';

describe('tryClaimNewsRefresh', () => {
    beforeEach(() => vi.clearAllMocks());

    it('claims atomically with SET NX EX on the refresh key', async () => {
        const set = vi.fn().mockResolvedValue('OK');
        mockGetRedisClient.mockReturnValue({ set });

        expect(await tryClaimNewsRefresh('aapl')).toBe(true);
        expect(set).toHaveBeenCalledWith('news:refresh:AAPL', '1', {
            nx: true,
            ex: NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
    });

    it('returns false when another request already holds the window', async () => {
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockResolvedValue(null),
        });
        expect(await tryClaimNewsRefresh('AAPL')).toBe(false);
    });

    it('fails open when Redis is unconfigured or erroring', async () => {
        mockGetRedisClient.mockReturnValue(null);
        expect(await tryClaimNewsRefresh('AAPL')).toBe(true);

        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockRejectedValue(new Error('down')),
        });
        expect(await tryClaimNewsRefresh('AAPL')).toBe(true);
    });
});

describe('shortenNewsRefreshClaim', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rewrites only an existing claim with the short retry TTL (SET XX EX)', async () => {
        const set = vi.fn().mockResolvedValue('OK');
        mockGetRedisClient.mockReturnValue({ set });

        await shortenNewsRefreshClaim('aapl');

        expect(set).toHaveBeenCalledWith('news:refresh:AAPL', '1', {
            xx: true,
            ex: NEWS_REFRESH_RETRY_TTL_SECONDS,
        });
        expect(NEWS_REFRESH_RETRY_TTL_SECONDS).toBeLessThan(
            NEWS_REFRESH_FLAG_TTL_SECONDS
        );
    });

    it('never throws when Redis fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockRejectedValue(new Error('down')),
        });
        await expect(shortenNewsRefreshClaim('AAPL')).resolves.toBeUndefined();
    });
});

describe('withNewsCardAnalysisLock', () => {
    beforeEach(() => vi.clearAllMocks());

    it('runs and releases with a token-compare delete when the lock is free', async () => {
        const set = vi.fn().mockResolvedValue('OK');
        const evalFn = vi.fn().mockResolvedValue(1);
        mockGetRedisClient.mockReturnValue({ set, eval: evalFn });
        const run = vi.fn().mockResolvedValue(undefined);

        expect(await withNewsCardAnalysisLock('aapl', run)).toBe(true);

        expect(run).toHaveBeenCalledOnce();
        const token = set.mock.calls[0][1];
        expect(set).toHaveBeenCalledWith(
            'news:cards:inflight:AAPL',
            token,
            expect.objectContaining({ nx: true })
        );
        expect(evalFn).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('del'"),
            ['news:cards:inflight:AAPL'],
            [token]
        );
    });

    it('skips the work when another path holds the lock', async () => {
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockResolvedValue(null),
            eval: vi.fn(),
        });
        const run = vi.fn();

        expect(await withNewsCardAnalysisLock('AAPL', run)).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    it('releases the lock even when the work throws', async () => {
        const evalFn = vi.fn().mockResolvedValue(1);
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockResolvedValue('OK'),
            eval: evalFn,
        });

        await expect(
            withNewsCardAnalysisLock('AAPL', () =>
                Promise.reject(new Error('llm'))
            )
        ).rejects.toThrow('llm');
        expect(evalFn).toHaveBeenCalledOnce();
    });

    it('runs without a lock when Redis is unconfigured', async () => {
        mockGetRedisClient.mockReturnValue(null);
        const run = vi.fn().mockResolvedValue(undefined);
        expect(await withNewsCardAnalysisLock('AAPL', run)).toBe(true);
        expect(run).toHaveBeenCalledOnce();
    });
});

describe('newsCardFailureBackoff', () => {
    beforeEach(() => vi.clearAllMocks());

    it('doubles the delay from 30 minutes and caps it at 24 hours', () => {
        expect(retryDelayMs(1)).toBe(30 * MS_PER_MINUTE);
        expect(retryDelayMs(2)).toBe(MS_PER_HOUR);
        expect(retryDelayMs(3)).toBe(2 * MS_PER_HOUR);
        expect(retryDelayMs(20)).toBe(24 * MS_PER_HOUR);
    });

    it('increments attempts from the previous record', () => {
        const now = 1_000_000;
        expect(nextFailureState(undefined, now)).toEqual({
            attempts: 1,
            retryAfter: now + 30 * MS_PER_MINUTE,
        });
        expect(nextFailureState({ attempts: 2, retryAfter: 0 }, now)).toEqual({
            attempts: 3,
            retryAfter: now + 2 * MS_PER_HOUR,
        });
    });

    it('loads only well-formed records keyed by article id', async () => {
        const mget = vi
            .fn()
            .mockResolvedValue([
                { attempts: 1, retryAfter: 5 },
                null,
                'garbage',
            ]);
        mockGetRedisClient.mockReturnValue({ mget });

        const loaded = await loadNewsCardFailures(['a', 'b', 'c']);

        expect(mget).toHaveBeenCalledWith(
            'news:card:fail:a',
            'news:card:fail:b',
            'news:card:fail:c'
        );
        expect([...loaded.entries()]).toEqual([
            ['a', { attempts: 1, retryAfter: 5 }],
        ]);
    });

    it('records the next state for each failed id in one pipeline', async () => {
        const pipelineSet = vi.fn();
        const exec = vi.fn().mockResolvedValue([]);
        mockGetRedisClient.mockReturnValue({
            pipeline: () => ({ set: pipelineSet, exec }),
        });

        await recordNewsCardFailures(
            ['a', 'b'],
            new Map([['a', { attempts: 1, retryAfter: 0 }]]),
            0
        );

        expect(pipelineSet).toHaveBeenCalledWith(
            'news:card:fail:a',
            { attempts: 2, retryAfter: MS_PER_HOUR },
            expect.objectContaining({ ex: expect.any(Number) })
        );
        expect(pipelineSet).toHaveBeenCalledWith(
            'news:card:fail:b',
            { attempts: 1, retryAfter: 30 * MS_PER_MINUTE },
            expect.objectContaining({ ex: expect.any(Number) })
        );
        expect(exec).toHaveBeenCalledOnce();
    });

    it('is a no-op without Redis', async () => {
        mockGetRedisClient.mockReturnValue(null);
        expect((await loadNewsCardFailures(['a'])).size).toBe(0);
        await expect(
            recordNewsCardFailures(['a'], new Map())
        ).resolves.toBeUndefined();
    });
});
