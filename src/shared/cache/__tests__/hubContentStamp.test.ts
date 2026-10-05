vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockTtl, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockTtl = vi.fn();
    const mockRedis: Pick<
        import('@upstash/redis').Redis,
        'get' | 'set' | 'ttl'
    > = {
        get: mockGet,
        set: mockSet,
        ttl: mockTtl,
    };
    return { mockGet, mockSet, mockTtl, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    hashHubBody,
    readHubContentStamp,
    recordHubContentStamp,
    STAMP_TTL_SECONDS,
} from '../hubContentStamp';

type RedisLike = import('@upstash/redis').Redis;

const T1 = new Date('2026-10-04T01:00:00.000Z');
const T2 = new Date('2026-10-04T02:00:00.000Z');

/**
 * 실제 Upstash처럼 **JSON을 거쳐** 저장하고 되돌려 주는 인메모리 Redis.
 * `get`이 파싱된 값을 돌려준다는 계약(문자열이 아니다)을 그대로 따른다.
 */
function useInMemoryRedis(): {
    store: Map<string, unknown>;
    /** 키의 남은 TTL(초)을 직접 줄여 시간 경과를 흉내 낸다. */
    setRemainingTtl: (key: string, seconds: number) => void;
} {
    const store = new Map<string, unknown>();
    const remaining = new Map<string, number>();
    mockGet.mockImplementation(async (key: string) =>
        store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : null
    );
    mockSet.mockImplementation(
        async (key: string, value: unknown, opts?: { ex?: number }) => {
            store.set(key, JSON.parse(JSON.stringify(value)));
            if (opts?.ex !== undefined) remaining.set(key, opts.ex);
            return 'OK';
        }
    );
    mockTtl.mockImplementation(async (key: string) =>
        store.has(key) ? (remaining.get(key) ?? -1) : -2
    );
    return {
        store,
        setRemainingTtl: (key, seconds) => remaining.set(key, seconds),
    };
}

describe('hashHubBody', () => {
    it('객체 키 순서가 달라도 같은 해시다 — 중첩 객체와 배열 안 객체까지', () => {
        const a = { summary: 's', sectors: { a: 1, b: [{ x: 1, y: 2 }] } };
        const b = { sectors: { b: [{ y: 2, x: 1 }], a: 1 }, summary: 's' };

        expect(hashHubBody(a)).toBe(hashHubBody(b));
    });

    it('값이 다르면 다른 해시다', () => {
        expect(hashHubBody({ summary: 'a' })).not.toBe(
            hashHubBody({ summary: 'b' })
        );
    });

    it('배열 순서는 의미가 있다', () => {
        expect(hashHubBody({ items: [1, 2] })).not.toBe(
            hashHubBody({ items: [2, 1] })
        );
    });

    /**
     * 페이지 읽기 경로는 `unstable_cache`(JSON 직렬화)를 거치고 크론은 core가 준 객체를
     * 그대로 해시한다. `undefined` 필드가 해시에 남으면 같은 본문이 서로 다른 해시가 된다.
     */
    it('undefined 필드는 JSON 왕복 뒤와 같은 해시를 낸다', () => {
        const live = { summary: 's', vixLevel: undefined, tags: ['a'] };
        const roundTripped = JSON.parse(JSON.stringify(live));

        expect(hashHubBody(live)).toBe(hashHubBody(roundTripped));
    });

    it('sha256 hex(64자)다', () => {
        expect(hashHubBody({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
    });

    it('문자열 본문도 해시한다', () => {
        expect(hashHubBody('text')).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('hubContentStamp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as RedisLike
        );
    });

    it('표면 이름을 고정 접두 `hub-content-stamp:`로 키에 붙인다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:market:us', { a: 1 }, T1);

        expect(mockGet).toHaveBeenCalledWith('hub-content-stamp:rss:market:us');
        expect(mockSet.mock.calls[0]?.[0]).toBe(
            'hub-content-stamp:rss:market:us'
        );
    });

    it('처음 보는 본문은 해시와 현재 시각(ISO)을 저장한다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);

        await expect(readHubContentStamp('rss:economy')).resolves.toEqual({
            hash: hashHubBody({ a: 1 }),
            at: T1.toISOString(),
        });
    });

    it('새 해시를 썼는지 돌려준다 — 처음·본문 변경은 true, 같은 본문 재확인은 false', async () => {
        useInMemoryRedis();

        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T1)
        ).resolves.toBe(true);
        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T2)
        ).resolves.toBe(false);
        await expect(
            recordHubContentStamp('rss:economy', { a: 2 }, T2)
        ).resolves.toBe(true);
    });

    it('TTL만 되돌린 경우도 false — 본문이 바뀐 것이 아니다', async () => {
        useInMemoryRedis();
        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        // 남은 TTL이 절반 밑이 되게 한다.
        mockTtl.mockResolvedValue(10);

        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T2)
        ).resolves.toBe(false);
    });

    it('7일 TTL로 저장한다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);

        expect(STAMP_TTL_SECONDS).toBe(7 * SECONDS_PER_DAY);
        expect(mockSet).toHaveBeenCalledWith(
            'hub-content-stamp:rss:economy',
            expect.anything(),
            { ex: STAMP_TTL_SECONDS }
        );
    });

    /**
     * 이 시각이 RSS `pubDate`다. 같은 본문을 크론이 5분마다 다시 확인하므로, 매번
     * 덮어쓰면 pubDate가 항상 "방금"이 되어 리더가 매 tick 새 글로 본다.
     */
    it('같은 본문을 다시 기록해도 처음 나타난 시각을 유지한다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        await recordHubContentStamp('rss:economy', { a: 1 }, T2);

        const stamp = await readHubContentStamp('rss:economy');
        expect(stamp?.at).toBe(T1.toISOString());
    });

    it('남은 TTL이 절반 이상이면 같은 본문에 다시 쓰지 않는다 — tick마다 SET을 내지 않는다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        await recordHubContentStamp('rss:economy', { a: 1 }, T2);

        expect(mockSet).toHaveBeenCalledTimes(1);
    });

    /**
     * TTL을 되돌리지 않으면 7일 넘게 안 바뀐 본문의 키가 만료되고, 다음 확인 때 `at`이
     * 늦은 시각으로 새로 찍힌다 — 같은 글의 pubDate가 앞으로 움직인다.
     */
    it('남은 TTL이 절반 밑이면 at을 그대로 두고 TTL을 7일로 되돌린다', async () => {
        const redis = useInMemoryRedis();
        const key = 'hub-content-stamp:rss:economy';
        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        redis.setRemainingTtl(key, STAMP_TTL_SECONDS / 2 - 1);
        mockSet.mockClear();

        await recordHubContentStamp('rss:economy', { a: 1 }, T2);

        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(
            key,
            { hash: hashHubBody({ a: 1 }), at: T1.toISOString() },
            { ex: STAMP_TTL_SECONDS }
        );
        expect(await mockTtl(key)).toBe(STAMP_TTL_SECONDS);
        expect((await readHubContentStamp('rss:economy'))?.at).toBe(
            T1.toISOString()
        );
    });

    it('만료 없는 키(ttl -1)에는 TTL을 다시 붙인다', async () => {
        const redis = useInMemoryRedis();
        const key = 'hub-content-stamp:rss:economy';
        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        redis.setRemainingTtl(key, -1);
        mockSet.mockClear();

        await recordHubContentStamp('rss:economy', { a: 1 }, T2);

        expect(mockSet).toHaveBeenCalledWith(key, expect.anything(), {
            ex: STAMP_TTL_SECONDS,
        });
    });

    it('키 순서만 다른 같은 본문도 시각을 유지한다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1, b: 2 }, T1);
        await recordHubContentStamp('rss:economy', { b: 2, a: 1 }, T2);

        expect((await readHubContentStamp('rss:economy'))?.at).toBe(
            T1.toISOString()
        );
    });

    it('본문이 바뀌면 해시와 시각을 새로 쓴다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);
        await recordHubContentStamp('rss:economy', { a: 2 }, T2);

        await expect(readHubContentStamp('rss:economy')).resolves.toEqual({
            hash: hashHubBody({ a: 2 }),
            at: T2.toISOString(),
        });
    });

    it('표면마다 독립이다', async () => {
        useInMemoryRedis();

        await recordHubContentStamp('rss:market:us', { a: 1 }, T1);
        await recordHubContentStamp('rss:market:kr', { a: 1 }, T2);

        expect((await readHubContentStamp('rss:market:us'))?.at).toBe(
            T1.toISOString()
        );
        expect((await readHubContentStamp('rss:market:kr'))?.at).toBe(
            T2.toISOString()
        );
    });

    it('저장된 적 없으면 null이다', async () => {
        useInMemoryRedis();

        await expect(readHubContentStamp('rss:economy')).resolves.toBeNull();
    });

    it('모양이 어긋난 저장값은 null로 취급한다 — 타입이 아니라 값을 확인한다', async () => {
        mockGet.mockResolvedValue({ hash: 123, at: null });

        await expect(readHubContentStamp('rss:economy')).resolves.toBeNull();
    });

    it('모양이 어긋난 저장값 위에는 새로 기록한다', async () => {
        mockGet.mockResolvedValue('garbage');

        await recordHubContentStamp('rss:economy', { a: 1 }, T1);

        expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('Redis가 없으면 읽기는 null, 기록은 조용히 넘어간다', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);

        await expect(readHubContentStamp('rss:economy')).resolves.toBeNull();
        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T1)
        ).resolves.toBe(false);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('Redis가 던져도 읽기는 null, 기록은 삼키고 로그한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockGet.mockRejectedValue(new Error('upstash down'));
        mockSet.mockRejectedValue(new Error('upstash down'));

        await expect(readHubContentStamp('rss:economy')).resolves.toBeNull();
        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T1)
        ).resolves.toBe(false);
        expect(errorSpy).toHaveBeenCalledTimes(2);
        errorSpy.mockRestore();
    });

    it('쓰기만 던져도 기록은 삼킨다', async () => {
        useInMemoryRedis();
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockSet.mockRejectedValue(new Error('upstash down'));

        await expect(
            recordHubContentStamp('rss:economy', { a: 1 }, T1)
        ).resolves.toBe(false);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });
});
