vi.mock('server-only', () => ({}));

const { redis } = vi.hoisted(() => {
    const store = new Map<string, number>();
    return {
        redis: {
            store,
            available: true as boolean,
            failing: false as boolean,
            /** 이 문자열을 포함하는 키에서 EXPIRE가 실패한다(빈 문자열이면 실패 없음). */
            expireFailingKey: '' as string,
            client: {
                incrby: vi.fn(async (key: string, n: number) => {
                    if (redis.failing) throw new Error('boom');
                    const next = (store.get(key) ?? 0) + n;
                    store.set(key, next);
                    return next;
                }),
                decrby: vi.fn(async (key: string, n: number) => {
                    const next = (store.get(key) ?? 0) - n;
                    store.set(key, next);
                    return next;
                }),
                expire: vi.fn(
                    async (key: string, _ttl: number, _option?: string) => {
                        if (
                            redis.expireFailingKey !== '' &&
                            key.includes(redis.expireFailingKey)
                        )
                            throw new Error('expire boom');
                        return 1;
                    }
                ),
            },
        },
    };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redis.available ? redis.client : null),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetXDailyBudgetForTests,
    refundXReads,
    reserveXReads,
} from '../xDailyBudget';

const NOW = new Date('2026-11-16T23:59:00Z');
const KEY = 'x:reads:v1:2026-11-16';
const GUEST_KEY = 'x:reads:guest:v1:2026-11-16';
const member = { guest: false, now: NOW };
const guest = { guest: true, now: NOW };

beforeEach(() => {
    redis.store.clear();
    redis.available = true;
    redis.failing = false;
    redis.expireFailingKey = '';
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    __resetXDailyBudgetForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('reserveXReads', () => {
    it('기본 상한 400: 경계까지 예약하고, 넘는 예약은 되돌린 뒤 exhausted(표식 로그)', async () => {
        expect(await reserveXReads(390, member)).toBe('reserved');
        expect(await reserveXReads(10, member)).toBe('reserved');
        expect(redis.store.get(KEY)).toBe(400);
        expect(await reserveXReads(1, member)).toBe('exhausted');
        expect(redis.store.get(KEY)).toBe(400);
        expect(console.warn).toHaveBeenCalledWith(
            '[xPosts] daily read budget exhausted',
            { limit: 400 }
        );
    });

    it('예약마다 TTL 없는 키에만 TTL을 건다(EXPIRE NX, UTC 날짜 키)', async () => {
        await reserveXReads(3, member);
        await reserveXReads(3, member);
        expect(redis.client.expire).toHaveBeenCalledTimes(2);
        for (const call of redis.client.expire.mock.calls)
            expect(call).toEqual([KEY, 172_800, 'NX']);
    });

    it('게스트는 전체 상한의 1/4(100)까지만 쓰고, 그 뒤에도 회원은 남은 전체 예산을 쓴다', async () => {
        expect(await reserveXReads(100, guest)).toBe('reserved');
        expect(redis.store.get(GUEST_KEY)).toBe(100);
        expect(await reserveXReads(1, guest)).toBe('exhausted');
        // 게스트 몫 초과는 전체 카운터에서도 되돌린다.
        expect(redis.store.get(KEY)).toBe(100);
        expect(redis.store.get(GUEST_KEY)).toBe(100);
        expect(await reserveXReads(300, member)).toBe('reserved');
        expect(await reserveXReads(1, member)).toBe('exhausted');
    });

    it('AGENT_X_POSTS_PER_DAY로 상한을 바꾸고, 양의 정수가 아니면 경고 후 기본값', async () => {
        vi.stubEnv('AGENT_X_POSTS_PER_DAY', '5');
        expect(await reserveXReads(5, member)).toBe('reserved');
        expect(await reserveXReads(1, member)).toBe('exhausted');
        redis.store.clear();
        vi.stubEnv('AGENT_X_POSTS_PER_DAY', '-3');
        expect(await reserveXReads(400, member)).toBe('reserved');
        expect(console.warn).toHaveBeenCalledWith(
            '[xPosts] AGENT_X_POSTS_PER_DAY is not a positive integer — using the default'
        );
    });

    it('Redis가 없거나 실패하면 unavailable(fail-closed)', async () => {
        redis.available = false;
        expect(await reserveXReads(1, member)).toBe('unavailable');
        redis.available = true;
        redis.failing = true;
        expect(await reserveXReads(1, member)).toBe('unavailable');
    });

    it('더한 뒤 TTL 걸기가 실패해도 예약이 새지 않는다(되돌리고 unavailable)', async () => {
        redis.expireFailingKey = 'x:reads:v1';
        expect(await reserveXReads(7, member)).toBe('unavailable');
        expect(redis.store.get(KEY)).toBe(0);
        redis.expireFailingKey = '';
        expect(await reserveXReads(3, member)).toBe('reserved');
        expect(redis.store.get(KEY)).toBe(3);
    });

    it('게스트 카운터에서 실패하면 전체 카운터에 더한 것도 되돌린다', async () => {
        redis.expireFailingKey = 'guest';
        expect(await reserveXReads(4, guest)).toBe('unavailable');
        expect(redis.store.get(KEY)).toBe(0);
        expect(redis.store.get(GUEST_KEY)).toBe(0);
    });
});

describe('refundXReads', () => {
    it('쓰지 않은 수를 돌려주고(게스트는 두 카운터 모두), 0 이하는 아무것도 하지 않는다', async () => {
        await reserveXReads(10, guest);
        await refundXReads(7, guest);
        expect(redis.store.get(KEY)).toBe(3);
        expect(redis.store.get(GUEST_KEY)).toBe(3);
        await refundXReads(0, guest);
        expect(redis.client.decrby).toHaveBeenCalledTimes(2);
    });
});
