/**
 * Unit tests for optionsDataCache delegation.
 *
 * The `'use cache'` directive is a Next.js compiler directive — in the jest
 * runtime it has no effect, and `cacheLife` / `cacheTag` from `next/cache`
 * are already mocked to noops in `jest.setup.ts`. We therefore verify the
 * functions' *forwarding* contract: that arguments and return values flow
 * unchanged through the wrapper to the underlying `YahooOptionsAdapter`.
 */

jest.mock('server-only', () => ({}), { virtual: true });

const mockHasOptionsMarket = jest.fn();
const mockFetchSnapshot = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisConstructor = jest.fn();

jest.mock('@/infrastructure/options/YahooOptionsAdapter', () => ({
    YahooOptionsAdapter: jest.fn().mockImplementation(() => ({
        hasOptionsMarket: mockHasOptionsMarket,
        fetchSnapshot: mockFetchSnapshot,
    })),
}));

jest.mock('@upstash/redis', () => ({
    Redis: jest.fn().mockImplementation((opts: unknown) => {
        mockRedisConstructor(opts);
        return { get: mockRedisGet, set: mockRedisSet };
    }),
}));

jest.mock('@/infrastructure/options/optionsCacheLife', () => ({
    getOptionsCacheLifeProfile: jest.fn(() => 'options-market-open'),
}));

import {
    hasOptionsMarket,
    fetchOptionsSnapshot,
    HAS_OPTIONS_MARKET_TTL_SECONDS,
} from '@/infrastructure/options/optionsDataCache';

const ORIGINAL_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIGINAL_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * optionsDataCache가 module-scope에서 Redis 인스턴스를 캐싱(`cachedRedis`)하므로
 * env를 토글한 케이스마다 모듈을 isolate해서 다시 import해야 한다.
 */
async function loadWithEnv(opts: {
    url?: string;
    token?: string;
}): Promise<typeof import('@/infrastructure/options/optionsDataCache')> {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    let mod!: typeof import('@/infrastructure/options/optionsDataCache');
    await jest.isolateModulesAsync(async () => {
        mod = await import('@/infrastructure/options/optionsDataCache');
    });
    return mod;
}

afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_REDIS_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_REDIS_TOKEN;
});

describe('hasOptionsMarket', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
        jest.clearAllMocks();
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
        const errSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
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
        const errSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
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
        const errSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
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
        jest.clearAllMocks();
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
