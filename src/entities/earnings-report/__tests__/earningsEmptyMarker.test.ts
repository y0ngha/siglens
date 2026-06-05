import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EARNINGS_EMPTY_MARKER_TTL_SECONDS,
    isEarningsKnownEmpty,
    markEarningsEmpty,
} from '@/entities/earnings-report';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

describe('earnings empty marker', () => {
    beforeEach(() => {
        store.clear();
        redisEnabled = true;
        fakeRedis.get.mockClear();
        fakeRedis.set.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('TTL 상수는 24시간(SECONDS_PER_DAY)', () => {
        expect(EARNINGS_EMPTY_MARKER_TTL_SECONDS).toBe(SECONDS_PER_DAY);
    });

    it('markEarningsEmpty는 earnings:empty:<SYM> 키를 TTL과 함께 set한다 (심볼 대문자화)', async () => {
        await markEarningsEmpty('aapl');
        expect(fakeRedis.set).toHaveBeenCalledWith('earnings:empty:AAPL', 1, {
            ex: SECONDS_PER_DAY,
        });
        expect(store.has('earnings:empty:AAPL')).toBe(true);
    });

    it('isEarningsKnownEmpty는 마커가 있으면 true, 없으면 false (심볼 대문자화)', async () => {
        expect(await isEarningsKnownEmpty('aapl')).toBe(false);
        await markEarningsEmpty('AAPL');
        expect(await isEarningsKnownEmpty('aapl')).toBe(true);
    });

    it('Redis 미설정이면 isEarningsKnownEmpty=false, markEarningsEmpty=no-op (graceful)', async () => {
        redisEnabled = false;
        expect(await isEarningsKnownEmpty('AAPL')).toBe(false);
        await markEarningsEmpty('AAPL');
        expect(store.size).toBe(0);
    });

    it('redis.get throw 시 false로 degrade', async () => {
        fakeRedis.get.mockRejectedValueOnce(new Error('redis down'));
        const spy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        expect(await isEarningsKnownEmpty('AAPL')).toBe(false);
        expect(spy).toHaveBeenCalledWith(
            '[isEarningsKnownEmpty] redis get failed:',
            expect.any(Error)
        );
    });

    it('redis.set throw 시 조용히 무시(throw 안 함)', async () => {
        fakeRedis.set.mockRejectedValueOnce(new Error('redis down'));
        const spy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        await expect(markEarningsEmpty('AAPL')).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalledWith(
            '[markEarningsEmpty] redis set failed:',
            expect.any(Error)
        );
    });
});
