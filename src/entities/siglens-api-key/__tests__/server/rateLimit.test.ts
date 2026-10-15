const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));

import {
    consumeRateLimit,
    peekRateLimits,
    RateLimiterUnavailableError,
} from '@/entities/siglens-api-key/server/rateLimit';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';

const KEY_ID = '33333333-3333-4333-8333-333333333333';
/** 2026-10-15T12:34:56Z — 분·일 창 경계에서 떨어진 시각. */
const NOW = new Date('2026-10-15T12:34:56.000Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const MINUTE_ID = Math.floor(NOW_SEC / 60);
const DAY_ID = Math.floor(NOW_SEC / 86400);
const MINUTE_KEY = `siglens-api:rl:${KEY_ID}:data:m:${MINUTE_ID}`;
const DAY_KEY = `siglens-api:rl:${KEY_ID}:data:d:${DAY_ID}`;
const { perMinute, perDay } = PUBLIC_API_RATE_LIMITS.data;

/** INCR 결과를 키별로 정해 주는 fake — MULTI 안에서 어떤 키를 올렸는지도 기록한다. */
function makeRedis(counts: Record<string, number>) {
    const incrs: string[] = [];
    const expires: Array<[string, number]> = [];
    const multi = vi.fn(() => {
        const queue: Array<() => number> = [];
        const pipeline = {
            incr: (key: string) => {
                queue.push(() => {
                    incrs.push(key);
                    counts[key] = (counts[key] ?? 0) + 1;
                    return counts[key];
                });
                return pipeline;
            },
            expire: (key: string, seconds: number) => {
                queue.push(() => {
                    expires.push([key, seconds]);
                    return 1;
                });
                return pipeline;
            },
            exec: async () => queue.map(run => run()),
        };
        return pipeline;
    });
    return { redis: { multi, mget: vi.fn() }, incrs, expires, counts };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('consumeRateLimit — 분 창 경계', () => {
    it(`${perMinute}번째 요청은 허용, ${perMinute + 1}번째는 거절`, async () => {
        const fx = makeRedis({ [MINUTE_KEY]: perMinute - 1 });
        mockGetRedis.mockReturnValue(fx.redis);

        const sixtieth = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(sixtieth.allowed).toBe(true);
        expect(sixtieth.remaining).toBe(0);

        const sixtyFirst = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(sixtyFirst.allowed).toBe(false);
        expect(sixtyFirst.window).toBe('minute');
        expect(sixtyFirst.remaining).toBe(0);
    });

    it('헤더 값: 한도·남은 횟수·창 끝 시각(분 버킷 기준)', async () => {
        const fx = makeRedis({ [MINUTE_KEY]: 9 });
        mockGetRedis.mockReturnValue(fx.redis);
        const verdict = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(verdict).toMatchObject({
            allowed: true,
            window: 'minute',
            limit: perMinute,
            remaining: perMinute - 10,
            resetAtEpochSeconds: (MINUTE_ID + 1) * 60,
        });
    });

    it('거절이면 다음 창까지 남은 초를 Retry-After 값으로 준다', async () => {
        const fx = makeRedis({ [MINUTE_KEY]: perMinute });
        mockGetRedis.mockReturnValue(fx.redis);
        const verdict = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(verdict.retryAfterSeconds).toBe((MINUTE_ID + 1) * 60 - NOW_SEC);
        expect(verdict.retryAfterSeconds).toBe(4);
    });

    it('분 한도에 막힌 요청은 일 카운터를 올리지 않는다', async () => {
        const fx = makeRedis({ [MINUTE_KEY]: perMinute });
        mockGetRedis.mockReturnValue(fx.redis);
        await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(fx.incrs).toEqual([MINUTE_KEY]);
    });

    it('다음 분에는 새 키라 카운터가 처음부터 시작한다', async () => {
        const fx = makeRedis({ [MINUTE_KEY]: perMinute });
        mockGetRedis.mockReturnValue(fx.redis);
        const next = new Date(NOW.getTime() + 60_000);
        const verdict = await consumeRateLimit(KEY_ID, 'data', next);
        expect(verdict.allowed).toBe(true);
        expect(fx.incrs[0]).toBe(
            `siglens-api:rl:${KEY_ID}:data:m:${MINUTE_ID + 1}`
        );
    });
});

describe('consumeRateLimit — 일 창', () => {
    it(`일 ${perDay}번째는 허용, ${perDay + 1}번째는 일 창으로 거절`, async () => {
        const fx = makeRedis({ [DAY_KEY]: perDay - 1 });
        mockGetRedis.mockReturnValue(fx.redis);
        expect((await consumeRateLimit(KEY_ID, 'data', NOW)).allowed).toBe(
            true
        );

        const over = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(over).toMatchObject({
            allowed: false,
            window: 'day',
            limit: perDay,
            remaining: 0,
            resetAtEpochSeconds: (DAY_ID + 1) * 86400,
        });
    });

    it('일 창 거절의 Retry-After는 UTC 자정까지 남은 초', async () => {
        const fx = makeRedis({ [DAY_KEY]: perDay });
        mockGetRedis.mockReturnValue(fx.redis);
        const over = await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(over.retryAfterSeconds).toBe((DAY_ID + 1) * 86400 - NOW_SEC);
    });
});

describe('consumeRateLimit — 키·버킷 분리', () => {
    it('버킷마다 별도 카운터를 쓴다', async () => {
        const fx = makeRedis({});
        mockGetRedis.mockReturnValue(fx.redis);
        await consumeRateLimit(KEY_ID, 'ai', NOW);
        expect(fx.incrs).toEqual([
            `siglens-api:rl:${KEY_ID}:ai:m:${MINUTE_ID}`,
            `siglens-api:rl:${KEY_ID}:ai:d:${DAY_ID}`,
        ]);
    });

    it('ai 버킷은 자기 한도(분 10회)를 적용한다', async () => {
        const aiMinute = PUBLIC_API_RATE_LIMITS.ai.perMinute;
        const fx = makeRedis({
            [`siglens-api:rl:${KEY_ID}:ai:m:${MINUTE_ID}`]: aiMinute,
        });
        mockGetRedis.mockReturnValue(fx.redis);
        const verdict = await consumeRateLimit(KEY_ID, 'ai', NOW);
        expect(verdict).toMatchObject({ allowed: false, limit: aiMinute });
    });

    it('다른 키의 카운터는 영향을 주지 않는다', async () => {
        const otherKey = '44444444-4444-4444-8444-444444444444';
        const fx = makeRedis({
            [`siglens-api:rl:${otherKey}:data:m:${MINUTE_ID}`]: perMinute,
        });
        mockGetRedis.mockReturnValue(fx.redis);
        expect((await consumeRateLimit(KEY_ID, 'data', NOW)).allowed).toBe(
            true
        );
    });

    it('INCR과 EXPIRE를 같은 MULTI로 보내 만료 없는 키가 남지 않게 한다', async () => {
        const fx = makeRedis({});
        mockGetRedis.mockReturnValue(fx.redis);
        await consumeRateLimit(KEY_ID, 'data', NOW);
        expect(fx.redis.multi).toHaveBeenCalledTimes(2);
        expect(fx.expires).toEqual([
            [MINUTE_KEY, 120],
            [DAY_KEY, 86400 + 3600],
        ]);
    });
});

describe('consumeRateLimit — 장애는 fail-closed', () => {
    it('Redis 미설정이면 RateLimiterUnavailableError', async () => {
        mockGetRedis.mockReturnValue(null);
        await expect(
            consumeRateLimit(KEY_ID, 'data', NOW)
        ).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    });

    it('명령이 던지면 RateLimiterUnavailableError로 감싸 던진다', async () => {
        mockGetRedis.mockReturnValue({
            multi: () => ({
                incr: () => ({
                    expire: () => ({
                        exec: () => Promise.reject(new Error('ETIMEDOUT')),
                    }),
                }),
            }),
        });
        const error = await consumeRateLimit(KEY_ID, 'data', NOW).catch(
            (e: unknown) => e
        );
        expect(error).toBeInstanceOf(RateLimiterUnavailableError);
        expect((error as Error).cause).toEqual(new Error('ETIMEDOUT'));
    });

    it('INCR가 숫자가 아닌 값을 주면 허용하지 않고 장애로 본다', async () => {
        mockGetRedis.mockReturnValue({
            multi: () => ({
                incr: () => ({
                    expire: () => ({ exec: async () => [null, 1] }),
                }),
            }),
        });
        await expect(
            consumeRateLimit(KEY_ID, 'data', NOW)
        ).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    });
});

describe('peekRateLimits', () => {
    it('소비 없이 버킷·창별 남은 횟수를 돌려준다', async () => {
        const fx = makeRedis({});
        // 순서: data 분, data 일, ai 분, ai 일
        fx.redis.mget.mockResolvedValue([5, '120', null, 3]);
        mockGetRedis.mockReturnValue(fx.redis);
        const snapshot = await peekRateLimits(KEY_ID, NOW);
        expect(fx.redis.multi).not.toHaveBeenCalled();
        expect(fx.redis.mget).toHaveBeenCalledWith(
            MINUTE_KEY,
            DAY_KEY,
            `siglens-api:rl:${KEY_ID}:ai:m:${MINUTE_ID}`,
            `siglens-api:rl:${KEY_ID}:ai:d:${DAY_ID}`
        );
        expect(snapshot).toEqual({
            data: {
                minute: {
                    limit: perMinute,
                    remaining: perMinute - 5,
                    resetAtEpochSeconds: (MINUTE_ID + 1) * 60,
                },
                day: {
                    limit: perDay,
                    remaining: perDay - 120,
                    resetAtEpochSeconds: (DAY_ID + 1) * 86400,
                },
            },
            ai: {
                minute: {
                    limit: PUBLIC_API_RATE_LIMITS.ai.perMinute,
                    remaining: PUBLIC_API_RATE_LIMITS.ai.perMinute,
                    resetAtEpochSeconds: (MINUTE_ID + 1) * 60,
                },
                day: {
                    limit: PUBLIC_API_RATE_LIMITS.ai.perDay,
                    remaining: PUBLIC_API_RATE_LIMITS.ai.perDay - 3,
                    resetAtEpochSeconds: (DAY_ID + 1) * 86400,
                },
            },
        });
    });

    it('한도를 넘긴 카운터는 남은 횟수 0으로 바닥을 친다', async () => {
        const fx = makeRedis({});
        fx.redis.mget.mockResolvedValue([perMinute + 40, 0, 0, 0]);
        mockGetRedis.mockReturnValue(fx.redis);
        const snapshot = await peekRateLimits(KEY_ID, NOW);
        expect(snapshot?.data.minute.remaining).toBe(0);
    });

    it('Redis가 없거나 읽기가 실패하면 null', async () => {
        mockGetRedis.mockReturnValue(null);
        await expect(peekRateLimits(KEY_ID, NOW)).resolves.toBeNull();
        mockGetRedis.mockReturnValue({
            mget: vi.fn().mockRejectedValue(new Error('down')),
        });
        await expect(peekRateLimits(KEY_ID, NOW)).resolves.toBeNull();
    });
});
