const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));

import { consumeRateLimit } from '@/entities/siglens-api-key/server/rateLimit';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-15T12:34:56.000Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const MINUTE_ID = Math.floor(NOW_SEC / 60);
const DAY_ID = Math.floor(NOW_SEC / 86400);
const AI_MINUTE_KEY = `siglens-api:rl:${USER_ID}:ai:m:${MINUTE_ID}`;
const AI_DAY_KEY = `siglens-api:rl:${USER_ID}:ai:d:${DAY_ID}`;
const DATA_MINUTE_KEY = `siglens-api:rl:${USER_ID}:data:m:${MINUTE_ID}`;
const { perMinute, perDay } = PUBLIC_API_RATE_LIMITS.ai;

function makeRedis(counts: Record<string, number>) {
    const incrs: string[] = [];
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
            expire: () => {
                queue.push(() => 1);
                return pipeline;
            },
            exec: async () => queue.map(run => run()),
        };
        return pipeline;
    });
    return { redis: { multi, mget: vi.fn() }, incrs };
}

beforeEach(() => vi.clearAllMocks());

describe('consumeRateLimit — ai 버킷 경계 (분 10회·일 200회)', () => {
    it(`분 ${perMinute}번째는 허용, ${perMinute + 1}번째는 분 창으로 거절`, async () => {
        const fx = makeRedis({ [AI_MINUTE_KEY]: perMinute - 1 });
        mockGetRedis.mockReturnValue(fx.redis);

        const last = await consumeRateLimit(USER_ID, 'ai', NOW);
        expect(last).toMatchObject({
            allowed: true,
            limit: perMinute,
            remaining: 0,
        });

        const over = await consumeRateLimit(USER_ID, 'ai', NOW);
        expect(over).toMatchObject({
            allowed: false,
            window: 'minute',
            limit: perMinute,
            remaining: 0,
        });
    });

    it(`일 ${perDay}번째는 허용, ${perDay + 1}번째는 일 창으로 거절`, async () => {
        const fx = makeRedis({ [AI_DAY_KEY]: perDay - 1 });
        mockGetRedis.mockReturnValue(fx.redis);

        expect((await consumeRateLimit(USER_ID, 'ai', NOW)).allowed).toBe(true);
        const over = await consumeRateLimit(USER_ID, 'ai', NOW);
        expect(over).toMatchObject({
            allowed: false,
            window: 'day',
            limit: perDay,
            resetAtEpochSeconds: (DAY_ID + 1) * 86400,
        });
    });

    it('data 버킷이 가득 차도 ai 카운터는 영향을 받지 않는다(캐시 적중은 ai를 쓰지 않는다)', async () => {
        const fx = makeRedis({
            [DATA_MINUTE_KEY]: PUBLIC_API_RATE_LIMITS.data.perMinute,
        });
        mockGetRedis.mockReturnValue(fx.redis);

        expect((await consumeRateLimit(USER_ID, 'ai', NOW)).allowed).toBe(true);
        expect(fx.incrs).toEqual([AI_MINUTE_KEY, AI_DAY_KEY]);
    });

    it('ai 분 한도에 막힌 시도는 ai 일 카운터를 올리지 않는다', async () => {
        const fx = makeRedis({ [AI_MINUTE_KEY]: perMinute });
        mockGetRedis.mockReturnValue(fx.redis);
        await consumeRateLimit(USER_ID, 'ai', NOW);
        expect(fx.incrs).toEqual([AI_MINUTE_KEY]);
    });

    it('카운터는 회원 단위다 — 다른 회원의 ai 카운터와 섞이지 않는다', async () => {
        const other = '22222222-2222-4222-8222-222222222222';
        const fx = makeRedis({
            [`siglens-api:rl:${other}:ai:m:${MINUTE_ID}`]: perMinute,
        });
        mockGetRedis.mockReturnValue(fx.redis);
        expect((await consumeRateLimit(USER_ID, 'ai', NOW)).allowed).toBe(true);
    });
});
