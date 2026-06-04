delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

vi.mock('server-only', () => ({}));

const { mockGetSectorSignals, mockRedisGet, mockRedisSet, mockRedisCtor } =
    vi.hoisted(() => ({
        mockGetSectorSignals: vi.fn(),
        mockRedisGet: vi.fn(),
        mockRedisSet: vi.fn(),
        mockRedisCtor: vi.fn(),
    }));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    getSectorSignals: mockGetSectorSignals,
    computeBarsEffectiveTtl: vi.fn(() => 60),
}));

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisCtor(opts);
        return { get: mockRedisGet, set: mockRedisSet };
    }),
}));

import type { SectorSignalsResult } from '@y0ngha/siglens-core';

const sampleResult: SectorSignalsResult = {
    computedAt: '2026-06-04T00:00:00Z',
    stocks: [
        {
            symbol: 'AAPL',
            sectorSymbol: 'XLK',
            signals: [],
            summary: { bullish: 0, bearish: 0, neutral: 0 },
        },
    ],
};

const emptyResult: SectorSignalsResult = {
    computedAt: '2026-06-04T00:00:00Z',
    stocks: [],
};

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/sectorSignalsCache');
}

describe('getCachedSectorSignals', () => {
    beforeEach(() => vi.clearAllMocks());

    afterEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('Redis env 없으면 getSectorSignals 직행', async () => {
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        const mod = await loadWithEnv({});
        const r = await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(mockRedisCtor).not.toHaveBeenCalled();
        expect(mockGetSectorSignals).toHaveBeenCalledWith(mockProvider, '1Day');
        expect(r).toEqual(sampleResult);
    });

    it('Redis hit 시 getSectorSignals 미호출, 캐시값 반환, key sector-signals:{tf}', async () => {
        mockRedisGet.mockResolvedValue({ data: sampleResult });
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedSectorSignals(mockProvider, '1Hour');
        expect(mockRedisGet).toHaveBeenCalledWith('sector-signals:1Hour');
        expect(mockGetSectorSignals).not.toHaveBeenCalled();
        expect(r).toEqual(sampleResult);
    });

    it('Redis miss 시 getSectorSignals 호출 후 redis.set(sector-signals:{tf}, fresh, { ex: 60 })', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedSectorSignals(mockProvider, '15Min');
        expect(mockRedisSet).toHaveBeenCalledWith(
            'sector-signals:15Min',
            { data: sampleResult },
            { ex: 60 }
        );
    });

    it('(guard: false) stocks 빈 결과는 set 미호출', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(emptyResult);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('(guard: true) stocks 비어있지 않으면 set 호출', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(mockRedisSet).toHaveBeenCalled();
    });

    it('Redis get 예외는 흡수하고 provider fallback', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleResult);
        errSpy.mockRestore();
    });

    it('Redis set 예외는 흡수하고 fresh 반환', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(errSpy).toHaveBeenCalled();
        expect(r).toEqual(sampleResult);
        errSpy.mockRestore();
    });

    it('timeframe별로 다른 캐시 키 사용', async () => {
        mockRedisGet.mockResolvedValue({ data: sampleResult });
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedSectorSignals(mockProvider, '1Day');
        expect(mockRedisGet).toHaveBeenCalledWith('sector-signals:1Day');
        vi.clearAllMocks();
        mockRedisGet.mockResolvedValue({ data: sampleResult });
        await mod.getCachedSectorSignals(mockProvider, '15Min');
        expect(mockRedisGet).toHaveBeenCalledWith('sector-signals:15Min');
    });
});
