vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getOrSetCache,
    setCacheValue,
    __resetInFlightForTests,
} from '@/shared/cache/getOrSetCache';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    COMPRESSED_VALUE_PREFIX,
    decodeCacheValue,
} from '@/shared/cache/cacheValueCodec';

const mockedGetRedisClient = vi.mocked(getRedisClient);

interface RedisStub {
    store: Map<string, unknown>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
}

function createRedisStub(): RedisStub {
    const store = new Map<string, unknown>();
    return {
        store,
        get: vi.fn((key: string) => (store.has(key) ? store.get(key) : null)),
        set: vi.fn((key: string, value: unknown) => {
            store.set(key, value);
            return 'OK';
        }),
    };
}

describe('getOrSetCache 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetInFlightForTests();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Redis 미설정 시 fetcher 결과를 반환한다', async () => {
        mockedGetRedisClient.mockReturnValue(null);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('캐시 히트 시 fetcher를 호출하지 않고 envelope 안의 값을 반환한다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: 'cached' });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('cached');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('캐시 미스 시 fetcher를 호출하고 envelope으로 감싸 TTL과 함께 저장한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 120, fetcher);

        expect(result).toBe('fresh');
        expect(redis.set).toHaveBeenCalledWith(
            'k',
            { data: 'fresh' },
            { ex: 120 }
        );
    });

    it('ttlSeconds가 함수이면 fetch된 값을 받아 반환값을 ex로 사용한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(42);
        const ttlFn = vi.fn((value: number) => value * 10); // 42 → 420

        const result = await getOrSetCache('k', ttlFn, fetcher);

        expect(result).toBe(42);
        expect(ttlFn).toHaveBeenCalledWith(42);
        expect(redis.set).toHaveBeenCalledWith('k', { data: 42 }, { ex: 420 });
    });

    it('빈 배열도 envelope으로 캐싱한다(legit empty)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue([]);

        await getOrSetCache('k', 60, fetcher);

        expect(redis.set).toHaveBeenCalledWith('k', { data: [] }, { ex: 60 });
    });

    it('null 결과도 envelope으로 캐싱한다(데이터 없음 = stable)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(null);

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBeNull();
        expect(redis.set).toHaveBeenCalledWith('k', { data: null }, { ex: 60 });
    });

    it('레거시 raw 엔트리(envelope 아님)는 miss로 취급해 fetch 후 envelope으로 갱신한다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { bars: [] }); // 이전 포맷 — `.data` 필드 없음
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(redis.set).toHaveBeenCalledWith(
            'k',
            { data: 'fresh' },
            { ex: 60 }
        );
    });

    it('저장된 null envelope은 캐시 히트로 처리해 fetcher를 호출하지 않는다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: null });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('shouldCache가 false면 fresh 값은 반환하되 저장하지 않는다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue({ bars: [] });

        const result = await getOrSetCache<{ bars: unknown[] }>(
            'k',
            60,
            fetcher,
            value => value.bars.length > 0
        );

        expect(result).toEqual({ bars: [] });
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('get 실패 시 fetcher로 graceful fallback하고 에러를 로깅한다', async () => {
        const redis = createRedisStub();
        redis.get.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(console.error).toHaveBeenCalledWith(
            '[getOrSetCache] get failed: k',
            expect.any(Error)
        );
    });

    it('set 실패해도 fresh 값을 반환하고 에러를 로깅한다', async () => {
        const redis = createRedisStub();
        redis.set.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(console.error).toHaveBeenCalledWith(
            '[getOrSetCache] set failed: k',
            expect.any(Error)
        );
    });

    it('isFresh가 false를 반환하면 캐시 히트도 miss로 취급해 refetch 후 덮어쓴다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: 'stale' });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache(
            'k',
            60,
            fetcher,
            () => true, // shouldCache
            value => value === 'fresh' // isFresh: 'stale'은 false
        );

        expect(result).toBe('fresh');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(redis.store.get('k')).toEqual({ data: 'fresh' });
    });

    it('isFresh 미전달 시 캐시 히트를 그대로 반환한다(기본값 항상 fresh)', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: 'cached' });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('cached');
        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe('getOrSetCache의 값 압축은', () => {
    // 운영 `bars:eodhist`와 같은 모양 — 직렬화 크기가 압축 임계값(1KB)을 넘는다.
    const bars = Array.from({ length: 200 }, (_, i) => ({
        time: 1727308800 + i * 86400,
        open: 48.99 + i / 7,
        high: 49.5 + i / 7,
        low: 48.1 + i / 7,
        close: 49.03 + i / 7,
        volume: 1000 + i,
    }));

    beforeEach(() => {
        vi.clearAllMocks();
        __resetInFlightForTests();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('큰 값은 압축 문자열로 저장하고, 다음 호출은 그것을 풀어 fetch 없이 반환한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(bars);

        await getOrSetCache('bars:eodhist:AAPL:2026-10-02', 60, fetcher);
        const stored = redis.store.get('bars:eodhist:AAPL:2026-10-02');
        const second = await getOrSetCache(
            'bars:eodhist:AAPL:2026-10-02',
            60,
            fetcher
        );

        expect(typeof stored).toBe('string');
        expect(stored as string).toMatch(
            new RegExp(`^${COMPRESSED_VALUE_PREFIX}`)
        );
        expect(redis.set).toHaveBeenCalledWith(
            'bars:eodhist:AAPL:2026-10-02',
            stored,
            { ex: 60 }
        );
        expect(second).toEqual(bars);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('압축 도입 전에 저장된 큰 envelope 객체도 그대로 캐시 히트로 읽는다', async () => {
        const redis = createRedisStub();
        redis.store.set('bars:eodhist:AAPL:2026-10-02', { data: bars });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue([]);

        const result = await getOrSetCache(
            'bars:eodhist:AAPL:2026-10-02',
            60,
            fetcher
        );

        expect(result).toEqual(bars);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('해독할 수 없는 압축 엔트리는 miss로 흡수해 refetch 후 유효한 값으로 덮어쓴다', async () => {
        const redis = createRedisStub();
        redis.store.set(
            'bars:eodhist:AAPL:2026-10-02',
            `${COMPRESSED_VALUE_PREFIX}bm90LXpzdGQ=`
        );
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(bars);

        const result = await getOrSetCache(
            'bars:eodhist:AAPL:2026-10-02',
            60,
            fetcher
        );

        expect(result).toEqual(bars);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
            '[getOrSetCache] get failed: bars:eodhist:AAPL:2026-10-02',
            expect.any(Error)
        );
        expect(
            await decodeCacheValue(
                redis.store.get('bars:eodhist:AAPL:2026-10-02')
            )
        ).toEqual({ data: bars });
    });
});

describe('getOrSetCache의 in-flight 중복 제거는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetInFlightForTests();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('같은 키의 동시 miss를 fetch 1회 + set 1회로 접는다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        let release!: (value: string) => void;
        const fetcher = vi.fn(
            () =>
                new Promise<string>(resolve => {
                    release = resolve;
                })
        );

        const calls = [
            getOrSetCache('k', 60, fetcher),
            getOrSetCache('k', 60, fetcher),
            getOrSetCache('k', 60, fetcher),
        ];
        // 세 호출이 모두 miss를 통과해 in-flight 맵에 도달한 뒤 fetcher를 완료시킨다.
        // 마이크로태스크 개수(get→decode 체인 길이)에 묶이지 않도록 매크로태스크까지 비운다.
        await new Promise(resolve => setTimeout(resolve, 0));
        release('fresh');
        const results = await Promise.all(calls);

        expect(results).toEqual(['fresh', 'fresh', 'fresh']);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('키가 다르면 각각 독립적으로 fetch한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn(async () => 'fresh');

        await Promise.all([
            getOrSetCache('a', 60, fetcher),
            getOrSetCache('b', 60, fetcher),
        ]);

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('완료 후에는 맵에서 제거되어 다음 miss가 다시 fetch한다', async () => {
        mockedGetRedisClient.mockReturnValue(null);
        const fetcher = vi.fn(async () => 'fresh');

        await getOrSetCache('k', 60, fetcher);
        await getOrSetCache('k', 60, fetcher);

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('fetcher가 throw하면 대기 중인 호출에도 전파되고 맵이 정리된다', async () => {
        mockedGetRedisClient.mockReturnValue(null);
        const boom = new Error('fmp down');
        const failing = vi.fn(async () => {
            throw boom;
        });

        const calls = [
            getOrSetCache('k', 60, failing).catch((e: unknown) => e),
            getOrSetCache('k', 60, failing).catch((e: unknown) => e),
        ];
        expect(await Promise.all(calls)).toEqual([boom, boom]);
        expect(failing).toHaveBeenCalledTimes(1);

        // 맵이 비워졌으므로 다음 호출은 새로 fetch한다.
        const ok = vi.fn(async () => 'fresh');
        await expect(getOrSetCache('k', 60, ok)).resolves.toBe('fresh');
    });

    it('공유 결과가 대기자의 isFresh를 통과하지 못하면 대기자만 직접 fetch한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        // 소유자는 짧은 시리즈를, 대기자는 더 긴 시리즈를 요구한다.
        const fetcher = vi.fn(async () => ['b']);

        const owner = getOrSetCache('k', 60, fetcher);
        const waiter = getOrSetCache(
            'k',
            60,
            fetcher,
            () => true, // shouldCache
            value => value.length >= 2 // isFresh: 공유 결과(길이 1)는 불충분
        );
        const [ownerValue, waiterValue] = await Promise.all([owner, waiter]);

        expect(ownerValue).toEqual(['b']);
        expect(waiterValue).toEqual(['b']);
        // 소유자 1회 + 대기자 폴백 1회.
        expect(fetcher).toHaveBeenCalledTimes(2);
        // 대기자의 폴백은 캐시를 덮어쓰지 않는다 — 소유자의 set 1회뿐.
        expect(redis.set).toHaveBeenCalledTimes(1);
    });
});

describe('setCacheValue 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetInFlightForTests();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('getOrSetCache가 hit으로 읽는 포맷(envelope)으로 쓴다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);

        await expect(setCacheValue('k', { v: 1 }, 90)).resolves.toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
            'k',
            { data: { v: 1 } },
            { ex: 90 }
        );

        const fetcher = vi.fn();
        await expect(getOrSetCache('k', 60, fetcher)).resolves.toEqual({
            v: 1,
        });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('1KB 이상 값은 압축해 쓰고 getOrSetCache가 그대로 풀어 읽는다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const big = { rows: Array.from({ length: 200 }, (_, i) => `row-${i}`) };

        await setCacheValue('big', big, 60);
        const stored = redis.store.get('big');
        expect(typeof stored).toBe('string');
        expect((stored as string).startsWith(COMPRESSED_VALUE_PREFIX)).toBe(
            true
        );
        await expect(decodeCacheValue(stored)).resolves.toEqual({ data: big });
        await expect(getOrSetCache('big', 60, vi.fn())).resolves.toEqual(big);
    });

    it('Redis 미설정이면 쓰지 않고 false', async () => {
        mockedGetRedisClient.mockReturnValue(null);
        await expect(setCacheValue('k', 1, 60)).resolves.toBe(false);
    });

    it('쓰기 실패는 흡수하고 false', async () => {
        const redis = createRedisStub();
        redis.set.mockRejectedValue(new Error('down'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        await expect(setCacheValue('k', 1, 60)).resolves.toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});
