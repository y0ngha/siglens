const { redisState, mockGetRedis } = vi.hoisted(() => {
    const redisState = { store: new Map<string, string>(), fail: false };
    const fake = {
        get: vi.fn(async (key: string) => {
            if (redisState.fail) throw new Error('upstash down');
            return redisState.store.get(key) ?? null;
        }),
        incr: vi.fn(async (key: string) => {
            if (redisState.fail) throw new Error('upstash down');
            const next = Number(redisState.store.get(key) ?? '0') + 1;
            redisState.store.set(key, String(next));
            return next;
        }),
        expire: vi.fn(async () => 1),
        set: vi.fn(async (key: string, value: string) => {
            redisState.store.set(key, value);
            return 'OK';
        }),
    };
    return {
        redisState,
        mockGetRedis: vi.fn((): typeof fake | null => fake),
    };
});
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DART_DAILY_CALL_BUDGET,
    DART_QUOTA_BREAKER_KEY,
    dartDailyCallCounterKey,
    openQuotaBreaker,
    reserveCall,
    resetDartQuotaGuardForTests,
    secondsUntilNextKstMidnight,
} from '../dartQuotaGuard';

const TODAY_KST = '2026-10-16';

describe('dartQuotaGuard', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-16T01:00:00Z'));
        redisState.store.clear();
        redisState.fail = false;
        mockGetRedis.mockClear();
        resetDartQuotaGuardForTests();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('pins the Redis key names', () => {
        expect(DART_QUOTA_BREAKER_KEY).toBe('dart:quota-blocked:v1');
        expect(dartDailyCallCounterKey('2026-10-16')).toBe(
            'dart:calls:v1:2026-10-16'
        );
    });

    describe('reserveCall', () => {
        it('counts the call and lets it through', async () => {
            expect(await reserveCall()).toBeNull();
            expect(
                redisState.store.get(dartDailyCallCounterKey(TODAY_KST))
            ).toBe('1');
        });

        it('reports the open breaker without touching the counter', async () => {
            redisState.store.set(DART_QUOTA_BREAKER_KEY, TODAY_KST);
            expect(await reserveCall()).toBe('daily quota breaker is open');
            expect(
                redisState.store.has(dartDailyCallCounterKey(TODAY_KST))
            ).toBe(false);
        });

        it('reports the budget once the counter passes it', async () => {
            redisState.store.set(
                dartDailyCallCounterKey(TODAY_KST),
                String(DART_DAILY_CALL_BUDGET)
            );
            expect(await reserveCall()).toBe(
                `daily call budget ${DART_DAILY_CALL_BUDGET} reached`
            );
        });

        it('fails open when Redis is down', async () => {
            redisState.fail = true;
            expect(await reserveCall()).toBeNull();
        });

        it('fails open without a Redis client', async () => {
            mockGetRedis.mockReturnValueOnce(null);
            expect(await reserveCall()).toBeNull();
        });
    });

    describe('openQuotaBreaker', () => {
        it('stores the breaker key and short-circuits later calls', async () => {
            await openQuotaBreaker();
            expect(redisState.store.get(DART_QUOTA_BREAKER_KEY)).toBe(
                TODAY_KST
            );
            mockGetRedis.mockClear();
            expect(await reserveCall()).toBe('daily quota breaker is open');
            expect(mockGetRedis).not.toHaveBeenCalled();
        });
    });

    describe('secondsUntilNextKstMidnight', () => {
        it('counts to the next 00:00 KST', () => {
            expect(
                secondsUntilNextKstMidnight(new Date('2026-10-16T14:00:00Z'))
            ).toBe(60 * 60); // 23:00 KST
        });

        it('never returns less than a minute', () => {
            expect(
                secondsUntilNextKstMidnight(new Date('2026-10-16T14:59:59Z'))
            ).toBe(60);
        });
    });
});
