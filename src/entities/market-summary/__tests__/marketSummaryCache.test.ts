delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

vi.mock('server-only', () => ({}));

const { mockGetMarketSummary, mockRedisGet, mockRedisSet, mockRedisCtor } =
    vi.hoisted(() => ({
        mockGetMarketSummary: vi.fn(),
        mockRedisGet: vi.fn(),
        mockRedisSet: vi.fn(),
        mockRedisCtor: vi.fn(),
    }));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    getMarketSummary: mockGetMarketSummary,
    computeBarsEffectiveTtl: vi.fn(() => 60),
}));

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisCtor(opts);
        return { get: mockRedisGet, set: mockRedisSet };
    }),
}));

import type { MarketSummaryData } from '@y0ngha/siglens-core';

const sampleSummary: MarketSummaryData = {
    indices: [
        {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: 'S&P 500',
            price: 5000,
            changesPercentage: 0.5,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 200,
            changesPercentage: 1.2,
        },
    ],
};

const zeroSummary: MarketSummaryData = {
    indices: [
        {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: 'S&P 500',
            price: 0,
            changesPercentage: 0,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 0,
            changesPercentage: 0,
        },
    ],
};

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/marketSummaryCache');
}

describe('getCachedMarketSummary', () => {
    beforeEach(() => vi.clearAllMocks());

    afterEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('Redis env 없으면 getMarketSummary 직행', async () => {
        mockGetMarketSummary.mockResolvedValue(sampleSummary);
        const mod = await loadWithEnv({});
        const r = await mod.getCachedMarketSummary(mockProvider);
        expect(mockRedisCtor).not.toHaveBeenCalled();
        expect(mockGetMarketSummary).toHaveBeenCalledWith(mockProvider);
        expect(r).toEqual(sampleSummary);
    });

    it('Redis hit 시 getMarketSummary 미호출, 캐시값 반환, key market:summary', async () => {
        mockRedisGet.mockResolvedValue(sampleSummary);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedMarketSummary(mockProvider);
        expect(mockRedisGet).toHaveBeenCalledWith('market:summary');
        expect(mockGetMarketSummary).not.toHaveBeenCalled();
        expect(r).toEqual(sampleSummary);
    });

    it('Redis miss 시 getMarketSummary 호출 후 redis.set(market:summary, fresh, { ex: 60 })', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetMarketSummary.mockResolvedValue(sampleSummary);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedMarketSummary(mockProvider);
        expect(mockRedisSet).toHaveBeenCalledWith(
            'market:summary',
            sampleSummary,
            { ex: 60 }
        );
    });

    it('전 종목 price=0 번들은 set 미호출', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetMarketSummary.mockResolvedValue(zeroSummary);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedMarketSummary(mockProvider);
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('Redis get 예외는 흡수하고 provider fallback', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockGetMarketSummary.mockResolvedValue(sampleSummary);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedMarketSummary(mockProvider);
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleSummary);
        errSpy.mockRestore();
    });

    it('Redis set 예외는 흡수하고 fresh 반환', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockGetMarketSummary.mockResolvedValue(sampleSummary);
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedMarketSummary(mockProvider);
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleSummary);
        errSpy.mockRestore();
    });
});
