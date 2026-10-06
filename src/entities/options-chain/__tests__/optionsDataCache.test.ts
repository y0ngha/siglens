/**
 * Unit tests for optionsDataCache delegation.
 *
 * The `'use cache'` directive is a Next.js compiler directive — in the vitest
 * runtime it has no effect, and `cacheLife` / `cacheTag` from `next/cache`
 * are already mocked to noops in `vitest.setup.base.ts`. We therefore verify the
 * functions' *forwarding* contract: that arguments and return values flow
 * unchanged through the wrapper to the underlying `YahooOptionsAdapter`.
 */

// release-it 경유 실행 시 `.env.local`의 UPSTASH_REDIS_REST_*가 부모 프로세스에 주입되어,
// module-level에서 import되는 `hasOptionsMarket`/`fetchOptionsSnapshot`이 cached Redis 인스턴스를
// 만들고 redis 경로를 타게 된다(mock 미설정 시 cache hit 오인). 첫 번째 describe block들의
// "adapter 직행 forwarding" 검증을 보존하기 위해 import 평가 전에 unset 한다.
// `loadWithEnv` 기반 describe들은 isolateModulesAsync로 env를 명시 주입하므로 영향 없음.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

vi.mock('server-only', () => ({}));

const {
    mockHasOptionsMarket,
    mockFetchSnapshot,
    mockRedisGet,
    mockRedisSet,
    mockRedisMget,
    mockRedisConstructor,
} = vi.hoisted(() => ({
    mockHasOptionsMarket: vi.fn(),
    mockFetchSnapshot: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisMget: vi.fn(),
    mockRedisConstructor: vi.fn(),
}));

vi.mock('../lib/YahooOptionsAdapter', () => ({
    YahooOptionsAdapter: vi.fn().mockImplementation(function () {
        return {
            hasOptionsMarket: mockHasOptionsMarket,
            fetchSnapshot: mockFetchSnapshot,
        };
    }),
}));

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisConstructor(opts);
        return { get: mockRedisGet, set: mockRedisSet, mget: mockRedisMget };
    }),
}));

vi.mock('../lib/optionsCacheLife', () => ({
    getOptionsCacheLifeProfile: vi.fn(() => 'options-market-open'),
}));

import {
    hasOptionsMarket,
    fetchOptionsSnapshot,
    HAS_OPTIONS_MARKET_TTL_SECONDS,
    LAST_GOOD_SNAPSHOT_TTL_SECONDS,
    OPTIONS_SNAPSHOT_TTL_SECONDS,
    SUBSTITUTED_SNAPSHOT_MIN_TTL_SECONDS,
} from '../lib/optionsDataCache';
import { getOptionsCacheLifeProfile } from '../lib/optionsCacheLife';
import {
    COMPRESSED_VALUE_PREFIX,
    decodeCacheValue,
} from '@/shared/cache/cacheValueCodec';

/**
 * optionsDataCache가 module-scope에서 Redis 인스턴스를 캐싱(`cachedRedis`)하므로
 * env를 토글한 케이스마다 모듈을 isolate해서 다시 import해야 한다.
 */
async function loadWithEnv(opts: {
    url?: string;
    token?: string;
}): Promise<typeof import('../lib/optionsDataCache')> {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    const mod = await import('../lib/optionsDataCache');
    return mod;
}

// 파일 최상단(line 16-17)에서 Redis env를 unset해 module-level import의 redis 경로를
// 차단했다. afterEach는 `loadWithEnv`가 세팅한 변수를 매 케이스마다 동일한 unset 상태로
// 되돌려 케이스 간 leak을 막는다. `process.env.X = undefined`는 Node에서 문자열
// 'undefined'로 강제 변환되므로 `delete`가 올바른 idiom.
afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('hasOptionsMarket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the symbol to YahooOptionsAdapter.hasOptionsMarket', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);

        const result = await hasOptionsMarket('AAPL');

        expect(mockHasOptionsMarket).toHaveBeenCalledWith('AAPL');
        expect(mockHasOptionsMarket).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
    });

    it('returns false when the adapter reports no options market', async () => {
        mockHasOptionsMarket.mockResolvedValue(false);

        const result = await hasOptionsMarket('NOOPT');

        expect(result).toBe(false);
    });

    it('propagates the adapter return value verbatim', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        await expect(hasOptionsMarket('MSFT')).resolves.toBe(true);

        mockHasOptionsMarket.mockResolvedValue(false);
        await expect(hasOptionsMarket('MSFT')).resolves.toBe(false);
    });
});

describe('hasOptionsMarket — Redis 캐시 레이어', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Redis env가 없으면 Redis 인스턴스를 만들지 않고 adapter로 직행한다', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);

        const mod = await loadWithEnv({});
        const result = await mod.hasOptionsMarket('AAPL');

        expect(mockRedisConstructor).not.toHaveBeenCalled();
        expect(mockHasOptionsMarket).toHaveBeenCalledWith('AAPL');
        expect(result).toBe(true);
    });

    it('Redis cache hit 시 adapter를 호출하지 않고 캐시 값을 그대로 반환', async () => {
        mockRedisGet.mockResolvedValue(true);

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.hasOptionsMarket('AAPL');

        expect(mockRedisGet).toHaveBeenCalledWith('options:has-market:AAPL');
        expect(mockHasOptionsMarket).not.toHaveBeenCalled();
        expect(mockRedisSet).not.toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it('Redis cache miss(null) 시 adapter를 호출하고 결과를 redis.set으로 저장', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockHasOptionsMarket.mockResolvedValue(true);
        mockRedisSet.mockResolvedValue('OK');

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.hasOptionsMarket('AAPL');

        expect(mockHasOptionsMarket).toHaveBeenCalledWith('AAPL');
        expect(mockRedisSet).toHaveBeenCalledWith(
            'options:has-market:AAPL',
            true,
            { ex: HAS_OPTIONS_MARKET_TTL_SECONDS }
        );
        expect(result).toBe(true);
    });

    it('Redis get 예외는 흡수하고 adapter로 fallback', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockHasOptionsMarket.mockResolvedValue(false);
        mockRedisSet.mockResolvedValue('OK');

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.hasOptionsMarket('AAPL');

        expect(errSpy).toHaveBeenCalled();
        expect(mockHasOptionsMarket).toHaveBeenCalledWith('AAPL');
        expect(result).toBe(false);
        errSpy.mockRestore();
    });

    it('Redis set 예외는 흡수하고 fresh 값을 정상 반환', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockHasOptionsMarket.mockResolvedValue(true);
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.hasOptionsMarket('AAPL');

        expect(errSpy).toHaveBeenCalled();
        expect(result).toBe(true);
        errSpy.mockRestore();
    });

    it('adapter.hasOptionsMarket 예외는 false로 흡수해 sitemap 빌드를 보호', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockHasOptionsMarket.mockRejectedValue(new Error('yahoo 503'));

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.hasOptionsMarket('AAPL');

        expect(errSpy).toHaveBeenCalled();
        expect(result).toBe(false);
        // adapter가 실패했으므로 cache write는 발생하지 않아야 한다.
        expect(mockRedisSet).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });
});

describe('fetchOptionsSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the symbol to YahooOptionsAdapter.fetchSnapshot', async () => {
        const snapshot = {
            symbol: 'AAPL',
            underlyingPrice: 195,
            chains: [],
            capturedAt: '2026-05-14T16:00:00Z',
        };
        mockFetchSnapshot.mockResolvedValue(snapshot);

        const result = await fetchOptionsSnapshot('AAPL');

        expect(mockFetchSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
        expect(result).toBe(snapshot);
    });

    it('returns null when the adapter has no snapshot', async () => {
        mockFetchSnapshot.mockResolvedValue(null);

        const result = await fetchOptionsSnapshot('NOOPT');

        expect(result).toBeNull();
    });

    it('preserves the adapter snapshot object identity (no shallow copy)', async () => {
        const snapshot = {
            symbol: 'TSLA',
            underlyingPrice: 250,
            chains: [],
            capturedAt: '2026-05-14T16:00:00Z',
        };
        mockFetchSnapshot.mockResolvedValue(snapshot);

        const result = await fetchOptionsSnapshot('TSLA');

        expect(result).toBe(snapshot);
    });
});

describe('fetchOptionsSnapshot — Redis 캐시 레이어', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const sampleSnapshot = {
        symbol: 'AAPL',
        underlyingPrice: 195,
        chains: [],
        capturedAt: '2026-05-14T16:00:00Z',
    };

    it('Redis env가 없으면 adapter로 직행한다', async () => {
        mockFetchSnapshot.mockResolvedValue(sampleSnapshot);

        const mod = await loadWithEnv({});
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(mockRedisConstructor).not.toHaveBeenCalled();
        expect(mockFetchSnapshot).toHaveBeenCalledWith('AAPL');
        expect(result).toEqual(sampleSnapshot);
    });

    it('Redis cache hit 시 adapter를 호출하지 않고 캐시 값을 그대로 반환', async () => {
        mockRedisGet.mockResolvedValue({
            data: { snapshot: sampleSnapshot, substituted: false },
        });

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(mockRedisGet).toHaveBeenCalledWith('options:snapshot:v2:AAPL');
        expect(mockFetchSnapshot).not.toHaveBeenCalled();
        expect(mockRedisSet).not.toHaveBeenCalled();
        expect(result).toEqual(sampleSnapshot);
    });

    it('Redis cache miss 시 adapter 결과를 market-aware TTL로 저장', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetchSnapshot.mockResolvedValue(sampleSnapshot);
        mockRedisSet.mockResolvedValue('OK');

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        await mod.fetchOptionsSnapshot('AAPL');

        // beforeEach 위에서 getOptionsCacheLifeProfile mock이 'options-market-open' 반환
        // getOrSetCache 포맷: { data } envelope(1KB 미만이라 압축 없이 그대로).
        expect(mockRedisSet).toHaveBeenCalledWith(
            'options:snapshot:v2:AAPL',
            { data: { snapshot: sampleSnapshot, substituted: false } },
            { ex: OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-open'] }
        );
    });

    it('옛 포맷(v1 키의 raw 스냅샷)은 읽지 않는다 — 롤링 배포 중 옛 빌드와 키를 나눈다', async () => {
        mockRedisGet.mockImplementation(async (key: string) =>
            key === 'options:snapshot:AAPL' ? sampleSnapshot : null
        );
        mockFetchSnapshot.mockResolvedValue(sampleSnapshot);

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        await mod.fetchOptionsSnapshot('AAPL');

        expect(mockRedisGet).not.toHaveBeenCalledWith('options:snapshot:AAPL');
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
    });

    it('같은 종목의 동시 miss는 Yahoo 호출 한 번으로 접힌다(요청 간 in-flight dedup)', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
        let release: (v: typeof sampleSnapshot) => void = () => {};
        mockFetchSnapshot.mockReturnValue(
            new Promise(r => {
                release = r;
            })
        );

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const a = mod.fetchOptionsSnapshot('AAPL');
        const b = mod.fetchOptionsSnapshot('AAPL');
        // 두 호출 모두 Redis GET을 마치고 in-flight 맵에 닿을 때까지 기다린다.
        await vi.waitFor(() => expect(mockFetchSnapshot).toHaveBeenCalled());
        release(sampleSnapshot);

        await expect(Promise.all([a, b])).resolves.toEqual([
            sampleSnapshot,
            sampleSnapshot,
        ]);
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
    });

    it('adapter가 null을 반환하면 negative cache를 남기지 않는다', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetchSnapshot.mockResolvedValue(null);

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.fetchOptionsSnapshot('NOOPT');

        expect(result).toBeNull();
        // Yahoo 일시 장애를 TTL 동안 굳히지 않도록 null은 캐시하지 않는다.
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('Redis get 예외는 흡수하고 adapter fresh로 진행', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockFetchSnapshot.mockResolvedValue(sampleSnapshot);
        mockRedisSet.mockResolvedValue('OK');

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(errSpy).toHaveBeenCalled();
        expect(mockFetchSnapshot).toHaveBeenCalledWith('AAPL');
        expect(result).toEqual(sampleSnapshot);
        errSpy.mockRestore();
    });

    it('Redis set 예외는 흡수하고 fresh 값을 정상 반환', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockFetchSnapshot.mockResolvedValue(sampleSnapshot);
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));

        const mod = await loadWithEnv({
            url: 'https://example.upstash.io',
            token: 'tok',
        });
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(errSpy).toHaveBeenCalled();
        expect(result).toEqual(sampleSnapshot);
        errSpy.mockRestore();
    });
});

describe('fetchOptionsSnapshot — last-good fallback', () => {
    const REDIS_ENV = { url: 'https://example.upstash.io', token: 'tok' };
    const LAST_GOOD_KEY = 'options:snapshot:last-good:AAPL';
    const MAIN_KEY = 'options:snapshot:v2:AAPL';

    // 2026-10-05(월) 05:00 UTC = 14:00 KST = 01:00 ET → 미국 정규장 밖.
    const SESSION_CLOSED_NOW = new Date('2026-10-05T05:00:00.000Z');
    // 2026-10-05(월) 15:00 UTC = 11:00 ET → 미국 정규장 중.
    const SESSION_OPEN_NOW = new Date('2026-10-05T15:00:00.000Z');

    function contract(openInterest: number) {
        return {
            contractSymbol: 'AAPL261009C00195000',
            strike: 195,
            lastPrice: 1,
            bid: 1,
            ask: 1,
            volume: 0,
            openInterest,
            impliedVolatility: 0.3,
            inTheMoney: false,
        };
    }

    function snapshotWith(
        openInterest: number,
        expirations: Array<[string, number]>,
        capturedAt = '2026-10-02T20:00:00.000Z'
    ) {
        return {
            symbol: 'AAPL',
            underlyingPrice: 195,
            capturedAt,
            chains: expirations.map(([expirationDate, daysToExpiration]) => ({
                expirationDate,
                daysToExpiration,
                calls: [contract(openInterest)],
                puts: [contract(openInterest)],
            })),
        };
    }

    // Yahoo가 정규장 밖에 돌려주는, 미결제약정이 전부 0인 스냅샷.
    const staleFresh = snapshotWith(
        0,
        [
            ['2026-10-09', 4],
            ['2026-10-16', 11],
        ],
        '2026-10-05T05:00:00.000Z'
    );
    const healthyFresh = snapshotWith(
        500,
        [
            ['2026-10-09', 4],
            ['2026-10-16', 11],
        ],
        '2026-10-05T15:00:00.000Z'
    );
    // 금요일 장 마감 직후 저장된 정상 스냅샷 — 만기 2026-10-02는 이미 지났다.
    const storedLastGood = snapshotWith(500, [
        ['2026-10-02', 0],
        ['2026-10-09', 7],
        ['2026-10-16', 14],
    ]);

    /** key별로 다른 값을 돌려주는 Redis get — mock.calls 인덱스에 기대지 않는다. */
    function redisHolds(values: Record<string, unknown>): void {
        mockRedisGet.mockImplementation(async (key: string) =>
            key in values ? values[key] : null
        );
    }

    function setCallsFor(key: string) {
        return mockRedisSet.mock.calls.filter(([k]) => k === key);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockRedisSet.mockResolvedValue('OK');
        vi.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('OI가 채워진 스냅샷이면 last-good을 5일 TTL로 저장한다', async () => {
        vi.setSystemTime(SESSION_OPEN_NOW);
        redisHolds({});
        mockFetchSnapshot.mockResolvedValue(healthyFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(healthyFresh);
        expect(setCallsFor(LAST_GOOD_KEY)).toEqual([
            [
                LAST_GOOD_KEY,
                healthyFresh,
                { ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS },
            ],
        ]);
    });

    describe('장중 last-good 재기록 간격(30분)', () => {
        const CAPTURED_AT_KEY = 'options:snapshot:last-good-at:AAPL';

        it('저장된 last-good이 30분 안이면 장중 miss가 다시 쓰지 않는다', async () => {
            vi.setSystemTime(SESSION_OPEN_NOW);
            redisHolds({
                [CAPTURED_AT_KEY]: new Date(
                    SESSION_OPEN_NOW.getTime() - 29 * 60_000
                ).toISOString(),
            });
            mockFetchSnapshot.mockResolvedValue(healthyFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            const result = await mod.fetchOptionsSnapshot('AAPL');

            expect(result).toEqual(healthyFresh);
            expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(0);
            expect(setCallsFor(CAPTURED_AT_KEY)).toHaveLength(0);
            // 일반 캐시는 그대로 쓴다.
            expect(setCallsFor(MAIN_KEY)).toHaveLength(1);
        });

        it('30분 이상 지났으면 장중에도 다시 쓴다', async () => {
            vi.setSystemTime(SESSION_OPEN_NOW);
            redisHolds({
                [CAPTURED_AT_KEY]: new Date(
                    SESSION_OPEN_NOW.getTime() - 30 * 60_000
                ).toISOString(),
            });
            mockFetchSnapshot.mockResolvedValue(healthyFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(1);
        });

        it('정규장 밖이면 방금 쓴 last-good이 있어도 다시 쓴다(마감 뒤 확정 OI)', async () => {
            vi.setSystemTime(SESSION_CLOSED_NOW);
            redisHolds({
                [CAPTURED_AT_KEY]: new Date(
                    SESSION_CLOSED_NOW.getTime() - 60_000
                ).toISOString(),
            });
            mockFetchSnapshot.mockResolvedValue(healthyFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(1);
        });

        it('보조 키 읽기가 실패하면 쓰는 쪽으로 판단한다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            vi.setSystemTime(SESSION_OPEN_NOW);
            mockRedisGet.mockImplementation(async (key: string) => {
                if (key === CAPTURED_AT_KEY) throw new Error('redis down');
                return null;
            });
            mockFetchSnapshot.mockResolvedValue(healthyFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(1);
            errSpy.mockRestore();
        });
    });

    describe('last-good 압축', () => {
        // 1KB를 넘겨 압축 경로를 타도록 계약을 늘린 정상 스냅샷.
        const largeHealthy = {
            ...healthyFresh,
            chains: healthyFresh.chains.map(c => ({
                ...c,
                calls: Array.from({ length: 20 }, () => contract(500)),
                puts: Array.from({ length: 20 }, () => contract(500)),
            })),
        };

        it('큰 last-good은 zstd로 압축해 쓰고, 읽으면 원래 객체로 돌아온다', async () => {
            vi.setSystemTime(SESSION_OPEN_NOW);
            redisHolds({});
            mockFetchSnapshot.mockResolvedValue(largeHealthy);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            const [write] = setCallsFor(LAST_GOOD_KEY);
            expect(typeof write[1]).toBe('string');
            expect(
                (write[1] as string).startsWith(COMPRESSED_VALUE_PREFIX)
            ).toBe(true);
            expect(await decodeCacheValue(write[1])).toEqual(largeHealthy);
            // 일반 캐시 값도 압축된다.
            const [main] = setCallsFor(MAIN_KEY);
            expect(
                (main[1] as string).startsWith(COMPRESSED_VALUE_PREFIX)
            ).toBe(true);
        });

        it('압축된 last-good도 정규장 밖 대체에 그대로 쓰인다', async () => {
            vi.setSystemTime(SESSION_OPEN_NOW);
            redisHolds({});
            mockFetchSnapshot.mockResolvedValue(largeHealthy);
            const writer = await loadWithEnv(REDIS_ENV);
            await writer.fetchOptionsSnapshot('AAPL');
            const [write] = setCallsFor(LAST_GOOD_KEY);

            vi.clearAllMocks();
            mockRedisSet.mockResolvedValue('OK');
            vi.setSystemTime(SESSION_CLOSED_NOW);
            redisHolds({ [LAST_GOOD_KEY]: write[1] });
            mockFetchSnapshot.mockResolvedValue(staleFresh);
            const reader = await loadWithEnv(REDIS_ENV);
            const result = await reader.fetchOptionsSnapshot('AAPL');

            expect(result?.capturedAt).toBe(largeHealthy.capturedAt);
            expect(result?.chains[0].calls[0].openInterest).toBe(500);
        });
    });

    it('last-good TTL은 주말·연휴를 덮는 5일이다', () => {
        expect(LAST_GOOD_SNAPSHOT_TTL_SECONDS).toBe(5 * 24 * 60 * 60);
    });

    it('OI가 비어 있는 스냅샷으로는 last-good을 덮어쓰지 않는다', async () => {
        vi.setSystemTime(SESSION_OPEN_NOW);
        redisHolds({});
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        await mod.fetchOptionsSnapshot('AAPL');

        expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(0);
    });

    it('정규장 밖에 stale이 오면 last-good을 오늘 기준으로 맞춰 대신 낸다', async () => {
        vi.setSystemTime(SESSION_CLOSED_NOW);
        redisHolds({ [LAST_GOOD_KEY]: storedLastGood });
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result?.chains.map(c => c.expirationDate)).toEqual([
            '2026-10-09',
            '2026-10-16',
        ]);
        // 2026-10-05 ET 기준 4일·11일 — 저장 당시 7·14가 아니다.
        expect(result?.chains.map(c => c.daysToExpiration)).toEqual([4, 11]);
        expect(result?.chains[0].calls[0].openInterest).toBe(500);
        // 수집 시각은 저장 당시 값 그대로 — 화면이 "직전 정규장 기준"을 밝히는 근거다.
        expect(result?.capturedAt).toBe(storedLastGood.capturedAt);
    });

    it('대체한 결과를 일반 캐시 키에도 저장해 다음 요청이 Yahoo를 다시 치지 않게 한다', async () => {
        vi.setSystemTime(SESSION_CLOSED_NOW);
        redisHolds({ [LAST_GOOD_KEY]: storedLastGood });
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        const mainWrites = setCallsFor(MAIN_KEY);
        expect(mainWrites).toHaveLength(1);
        expect(await decodeCacheValue(mainWrites[0][1])).toEqual({
            data: { snapshot: result, substituted: true },
        });
        // 대체 결과가 last-good을 덮어쓰지는 않는다.
        expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(0);
    });

    describe('대체 값의 일반 캐시 TTL', () => {
        // getOptionsCacheLifeProfile은 이 파일에서 'options-market-open'으로 목이다 —
        // 케이스별로 닫힘/주말 프로파일을 돌려준다.
        const mockProfile = vi.mocked(getOptionsCacheLifeProfile);

        async function substitutedMainTtl(now: Date): Promise<number> {
            vi.setSystemTime(now);
            redisHolds({ [LAST_GOOD_KEY]: storedLastGood });
            mockFetchSnapshot.mockResolvedValue(staleFresh);
            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');
            const [write] = setCallsFor(MAIN_KEY);
            return (write[2] as { ex: number }).ex;
        }

        afterEach(() => {
            mockProfile.mockReturnValue('options-market-open');
        });

        it('개장까지 한참 남았으면 닫힘 프로파일 TTL(30분) 그대로다', async () => {
            mockProfile.mockReturnValue('options-market-closed');
            // 월요일 01:00 ET → 개장까지 8.5시간.
            expect(await substitutedMainTtl(SESSION_CLOSED_NOW)).toBe(
                OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-closed']
            );
        });

        it('개장 10분 전이면 개장까지 남은 시간(600초)으로 줄어든다', async () => {
            mockProfile.mockReturnValue('options-market-closed');
            // 2026-10-05 13:20 UTC = 09:20 EDT.
            expect(
                await substitutedMainTtl(new Date('2026-10-05T13:20:00.000Z'))
            ).toBe(600);
        });

        it('주말 프로파일(4h)도 개장 전 남은 시간을 넘지 않는다', async () => {
            mockProfile.mockReturnValue('options-weekend');
            // 휴장일 프로파일이 걸린 평일 개장 30분 전(예시) — 4h보다 짧은 1800초가 된다.
            expect(
                await substitutedMainTtl(new Date('2026-10-05T13:00:00.000Z'))
            ).toBe(1800);
        });

        it('개장 직전(30초 전)에도 60초 아래로 내려가지 않는다', async () => {
            mockProfile.mockReturnValue('options-market-closed');
            expect(
                await substitutedMainTtl(new Date('2026-10-05T13:29:30.000Z'))
            ).toBe(SUBSTITUTED_SNAPSHOT_MIN_TTL_SECONDS);
        });

        it('대체가 아닌 일반 fresh 값의 TTL은 프로파일 그대로다', async () => {
            vi.setSystemTime(new Date('2026-10-05T13:29:30.000Z'));
            mockProfile.mockReturnValue('options-market-closed');
            redisHolds({});
            mockFetchSnapshot.mockResolvedValue(healthyFresh);
            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            const [write] = setCallsFor(MAIN_KEY);
            expect(write[2]).toEqual({
                ex: OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-closed'],
            });
        });
    });

    it('정규장 중에는 stale이어도 대체하지 않는다', async () => {
        vi.setSystemTime(SESSION_OPEN_NOW);
        redisHolds({ [LAST_GOOD_KEY]: storedLastGood });
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(staleFresh);
        expect(mockRedisGet).not.toHaveBeenCalledWith(LAST_GOOD_KEY);
    });

    it('만기가 모두 지난 last-good은 쓰지 않고 fresh를 낸다', async () => {
        vi.setSystemTime(SESSION_CLOSED_NOW);
        redisHolds({
            [LAST_GOOD_KEY]: snapshotWith(500, [['2026-10-02', 0]]),
        });
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(staleFresh);
    });

    it('last-good이 없으면 stale fresh를 그대로 낸다', async () => {
        vi.setSystemTime(SESSION_CLOSED_NOW);
        redisHolds({});
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(staleFresh);
    });

    describe('last-good을 못 쓸 때의 커버리지 로그(reason 포함)', () => {
        async function unavailableLog(
            values: Record<string, unknown>
        ): Promise<string[]> {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.setSystemTime(SESSION_CLOSED_NOW);
            redisHolds(values);
            mockFetchSnapshot.mockResolvedValue(staleFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            const lines = warnSpy.mock.calls.map(([line]) => String(line));
            warnSpy.mockRestore();
            return lines;
        }

        it('저장된 값이 정말 없으면 reason=absent다', async () => {
            const lines = await unavailableLog({});
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain('last-good unavailable for AAPL');
            expect(lines[0]).toContain('reason=absent');
        });

        it('값은 있지만 맞추고 나면 남는 만기가 없으면 reason=no_expiry_after_rebase다', async () => {
            const lines = await unavailableLog({
                [LAST_GOOD_KEY]: snapshotWith(500, [['2026-10-02', 0]]),
            });
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain('reason=no_expiry_after_rebase');
        });

        it('값은 있지만 맞춘 결과가 stale이면 reason=stale_after_rebase다', async () => {
            const lines = await unavailableLog({
                [LAST_GOOD_KEY]: snapshotWith(0, [
                    ['2026-10-09', 7],
                    ['2026-10-16', 14],
                ]),
            });
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain('reason=stale_after_rebase');
        });

        it('읽기가 실패하면 reason=read_error다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.setSystemTime(SESSION_CLOSED_NOW);
            mockRedisGet.mockImplementation(async (key: string) => {
                if (key === LAST_GOOD_KEY) throw new Error('redis down');
                return null;
            });
            mockFetchSnapshot.mockResolvedValue(staleFresh);

            const mod = await loadWithEnv(REDIS_ENV);
            await mod.fetchOptionsSnapshot('AAPL');

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(String(warnSpy.mock.calls[0][0])).toContain(
                'reason=read_error'
            );
            warnSpy.mockRestore();
            errSpy.mockRestore();
        });
    });

    it('last-good으로 대체했거나 정규장 중이면 unavailable 로그를 남기지 않는다', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.setSystemTime(SESSION_CLOSED_NOW);
        redisHolds({ [LAST_GOOD_KEY]: storedLastGood });
        mockFetchSnapshot.mockResolvedValue(staleFresh);
        const mod = await loadWithEnv(REDIS_ENV);
        await mod.fetchOptionsSnapshot('AAPL');

        vi.setSystemTime(SESSION_OPEN_NOW);
        redisHolds({});
        const openMod = await loadWithEnv(REDIS_ENV);
        await openMod.fetchOptionsSnapshot('AAPL');

        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('Redis가 없으면 보관할 곳이 없으므로 대체 없이 fresh를 낸다', async () => {
        vi.setSystemTime(SESSION_CLOSED_NOW);
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv({});
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(staleFresh);
        expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('last-good 읽기가 실패해도 fresh로 진행한다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.setSystemTime(SESSION_CLOSED_NOW);
        mockRedisGet.mockImplementation(async (key: string) => {
            if (key === LAST_GOOD_KEY) throw new Error('redis down');
            return null;
        });
        mockFetchSnapshot.mockResolvedValue(staleFresh);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.fetchOptionsSnapshot('AAPL');

        expect(result).toEqual(staleFresh);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});

describe('refreshLastGoodSnapshot', () => {
    const REDIS_ENV = { url: 'https://example.upstash.io', token: 'tok' };
    const LAST_GOOD_KEY = 'options:snapshot:last-good:AAPL';
    const MAIN_KEY = 'options:snapshot:v2:AAPL';
    // 2026-10-05(월) 20:30 UTC = 16:30 EDT — 마감 직후, Yahoo가 아직 OI를 들고 있는 구간.
    const WARM_NOW = new Date('2026-10-05T20:30:00.000Z');

    function chain(openInterest: number) {
        const contract = {
            contractSymbol: 'AAPL261009C00195000',
            strike: 195,
            lastPrice: 1,
            bid: 1,
            ask: 1,
            volume: 0,
            openInterest,
            impliedVolatility: 0.3,
            inTheMoney: false,
        };
        return {
            expirationDate: '2026-10-09',
            daysToExpiration: 4,
            calls: [contract],
            puts: [contract],
        };
    }

    function snapshotWith(openInterest: number) {
        return {
            symbol: 'AAPL',
            underlyingPrice: 195,
            capturedAt: WARM_NOW.toISOString(),
            chains: [chain(openInterest), { ...chain(openInterest) }],
        };
    }

    const healthy = snapshotWith(500);
    const stale = snapshotWith(0);

    function setCallsFor(key: string) {
        return mockRedisSet.mock.calls.filter(([k]) => k === key);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
    });

    afterEach(() => {
        vi.mocked(getOptionsCacheLifeProfile).mockReturnValue(
            'options-market-open'
        );
    });

    it('OI가 채워진 스냅샷이면 last-good(5일)과 일반 캐시(프로파일 TTL)를 함께 쓴다', async () => {
        // 워밍 구간(마감 직후)의 실제 프로파일은 닫힘(30분)이다 — 이 파일은 프로파일을
        // 'options-market-open'으로 목 처리하므로 여기서 실제 구간에 맞춰 바꾼다.
        vi.mocked(getOptionsCacheLifeProfile).mockReturnValue(
            'options-market-closed'
        );
        mockFetchSnapshot.mockResolvedValue(healthy);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('written');
        expect(setCallsFor(LAST_GOOD_KEY)).toEqual([
            [LAST_GOOD_KEY, healthy, { ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS }],
        ]);
        expect(setCallsFor(MAIN_KEY)).toEqual([
            [
                MAIN_KEY,
                { data: { snapshot: healthy, substituted: false } },
                { ex: 30 * 60 },
            ],
        ]);
        expect(OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-closed']).toBe(
            30 * 60
        );
    });

    it('last-good과 같은 TTL로 capturedAt 보조 키를 함께 쓴다', async () => {
        mockFetchSnapshot.mockResolvedValue(healthy);

        const mod = await loadWithEnv(REDIS_ENV);
        await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(setCallsFor('options:snapshot:last-good-at:AAPL')).toEqual([
            [
                'options:snapshot:last-good-at:AAPL',
                healthy.capturedAt,
                { ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS },
            ],
        ]);
    });

    it('보조 키 쓰기만 실패해도 last-good은 갱신됐으므로 written이다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFetchSnapshot.mockResolvedValue(healthy);
        mockRedisSet.mockImplementation(async (key: string) => {
            if (key === 'options:snapshot:last-good-at:AAPL') {
                throw new Error('redis write fail');
            }
            return 'OK';
        });

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('written');
        expect(setCallsFor(MAIN_KEY)).toHaveLength(1);
        errSpy.mockRestore();
    });

    it('stale이면 보조 키도 쓰지 않는다', async () => {
        mockFetchSnapshot.mockResolvedValue(stale);

        const mod = await loadWithEnv(REDIS_ENV);
        await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(setCallsFor('options:snapshot:last-good-at:AAPL')).toHaveLength(
            0
        );
    });

    it('일반 캐시에 값이 있어도 hit 경로를 우회해 Yahoo를 직접 친다', async () => {
        mockRedisGet.mockImplementation(async (key: string) =>
            key === MAIN_KEY ? stale : null
        );
        mockFetchSnapshot.mockResolvedValue(healthy);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
        expect(mockFetchSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockRedisGet).not.toHaveBeenCalledWith(MAIN_KEY);
        expect(result).toBe('written');
        expect(setCallsFor(LAST_GOOD_KEY)[0][1]).toBe(healthy);
    });

    it('OI가 비어 있는(stale) 스냅샷은 아무것도 쓰지 않고 stale을 돌려준다', async () => {
        mockFetchSnapshot.mockResolvedValue(stale);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('stale');
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('스냅샷이 없으면(null) none이고 아무것도 쓰지 않는다', async () => {
        mockFetchSnapshot.mockResolvedValue(null);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('none');
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('Yahoo 오류는 흡수하고 none을 돌려준다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFetchSnapshot.mockRejectedValue(new Error('yahoo 503'));

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('none');
        expect(errSpy).toHaveBeenCalled();
        expect(mockRedisSet).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('last-good 쓰기가 실패하면 none이고 일반 캐시도 쓰지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFetchSnapshot.mockResolvedValue(healthy);
        mockRedisSet.mockImplementation(async (key: string) => {
            if (key === LAST_GOOD_KEY) throw new Error('redis write fail');
            return 'OK';
        });

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('none');
        expect(errSpy).toHaveBeenCalled();
        expect(setCallsFor(MAIN_KEY)).toHaveLength(0);
        errSpy.mockRestore();
    });

    it('일반 캐시 쓰기만 실패해도 last-good은 갱신됐으므로 written이다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFetchSnapshot.mockResolvedValue(healthy);
        mockRedisSet.mockImplementation(async (key: string) => {
            if (key === MAIN_KEY) throw new Error('redis write fail');
            return 'OK';
        });

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('written');
        expect(setCallsFor(LAST_GOOD_KEY)).toHaveLength(1);
        errSpy.mockRestore();
    });

    it('Redis가 없으면 Yahoo를 치지 않고 none을 돌려준다', async () => {
        const mod = await loadWithEnv({});
        const result = await mod.refreshLastGoodSnapshot('AAPL', WARM_NOW);

        expect(result).toBe('none');
        expect(mockFetchSnapshot).not.toHaveBeenCalled();
    });
});

describe('readLastGoodCapturedAtBatch', () => {
    const REDIS_ENV = { url: 'https://example.upstash.io', token: 'tok' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('보조 키를 MGET 한 번으로 읽고 값이 있는 종목만 맵에 담는다', async () => {
        mockRedisMget.mockResolvedValue([
            '2026-10-05T20:30:00.000Z',
            null,
            '2026-10-05T20:40:00.000Z',
        ]);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.readLastGoodCapturedAtBatch([
            'AAPL',
            'msft',
            'NVDA',
        ]);

        expect(mockRedisMget).toHaveBeenCalledTimes(1);
        expect(mockRedisMget).toHaveBeenCalledWith(
            'options:snapshot:last-good-at:AAPL',
            'options:snapshot:last-good-at:MSFT',
            'options:snapshot:last-good-at:NVDA'
        );
        expect(Object.fromEntries(result)).toEqual({
            AAPL: '2026-10-05T20:30:00.000Z',
            NVDA: '2026-10-05T20:40:00.000Z',
        });
        // 스냅샷 전체 키는 읽지 않는다.
        expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('문자열이 아닌 값(깨진 데이터)은 미확보로 본다', async () => {
        mockRedisMget.mockResolvedValue([123, { a: 1 }]);

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.readLastGoodCapturedAtBatch(['AAPL', 'MSFT']);

        expect(result.size).toBe(0);
    });

    it('종목이 없으면 Redis를 부르지 않는다', async () => {
        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.readLastGoodCapturedAtBatch([]);

        expect(result.size).toBe(0);
        expect(mockRedisMget).not.toHaveBeenCalled();
    });

    it('Redis 오류는 흡수하고 빈 맵이다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisMget.mockRejectedValue(new Error('redis down'));

        const mod = await loadWithEnv(REDIS_ENV);
        const result = await mod.readLastGoodCapturedAtBatch(['AAPL']);

        expect(result.size).toBe(0);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('Redis가 없으면 빈 맵이다', async () => {
        const mod = await loadWithEnv({});
        const result = await mod.readLastGoodCapturedAtBatch(['AAPL']);

        expect(result.size).toBe(0);
        expect(mockRedisMget).not.toHaveBeenCalled();
    });
});

describe('OPTIONS_SNAPSHOT_TTL_SECONDS', () => {
    it('시장 시간대별 TTL은 open < closed < weekend 순으로 늘어난다', () => {
        // freshness vs Yahoo 호출량 trade-off — 정규장 중에는 분 단위로 짧게,
        // 주말에는 시간 단위로 길게 캐시하는 정책이 invariant.
        expect(
            OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-open']
        ).toBeLessThan(OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-closed']);
        expect(
            OPTIONS_SNAPSHOT_TTL_SECONDS['options-market-closed']
        ).toBeLessThan(OPTIONS_SNAPSHOT_TTL_SECONDS['options-weekend']);
    });
});
