delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

vi.mock('server-only', () => ({}));

const { mockFetch, mockRedisGet, mockRedisSet, mockRedisCtor } = vi.hoisted(
    () => ({
        mockFetch: vi.fn(),
        mockRedisGet: vi.fn(),
        mockRedisSet: vi.fn(),
        mockRedisCtor: vi.fn(),
    })
);

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    fetchBarsWithIndicators: mockFetch,
    computeBarsEffectiveTtl: vi.fn(() => 60),
}));

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisCtor(opts);
        return { get: mockRedisGet, set: mockRedisSet };
    }),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import type { BarsData } from '@y0ngha/siglens-core';

const sampleBars: BarsData = {
    bars: [{ time: 1, open: 1, high: 2, low: 0, close: 1, volume: 10 }],
    indicators: {} as BarsData['indicators'],
};

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/barsDataCache');
}

describe('getCachedBarsWithIndicators', () => {
    beforeEach(() => vi.clearAllMocks());

    afterEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('Redis env 없으면 fetch 직행', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({});
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisCtor).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledWith('AAPL', '1Day', undefined);
        expect(r).toEqual(sampleBars);
    });

    it('Redis hit 시 fetch 안 함', async () => {
        mockRedisGet.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisGet).toHaveBeenCalledWith('bars:AAPL:1Day');
        expect(mockFetch).not.toHaveBeenCalled();
        expect(r).toEqual(sampleBars);
    });

    it('Redis miss 시 fetch 후 computeBarsEffectiveTtl TTL로 set', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(sampleBars);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisSet).toHaveBeenCalledWith(
            'bars:AAPL:1Day',
            sampleBars,
            { ex: 60 }
        );
    });

    it('fmpSymbol을 키에 포함', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedBarsWithIndicators('SPX', '1Day', '^SPX');
        expect(mockRedisGet).toHaveBeenCalledWith('bars:SPX:1Day:^SPX');
    });

    it('빈 봉은 캐시하지 않음', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue({ ...sampleBars, bars: [] });
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('Redis get 예외는 흡수하고 fetch fallback', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockFetch.mockResolvedValue(sampleBars);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleBars);
        errSpy.mockRestore();
    });

    it('Redis set 예외는 흡수하고 fresh 값을 정상 반환', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(sampleBars);
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleBars);
        errSpy.mockRestore();
    });

    it('getRedis 싱글턴 캐시 — 두 번째 호출은 재생성 없이 반환', async () => {
        mockRedisGet.mockResolvedValue(sampleBars);
        // Load the module once, then call twice — second call hits cachedRedis fast-path
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        await mod.getCachedBarsWithIndicators('AAPL', '1Day');
        // Redis constructor must have been called exactly once (singleton reused)
        expect(mockRedisCtor).toHaveBeenCalledTimes(1);
    });
});
