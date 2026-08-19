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
import { SECTOR_STOCKS } from '@/shared/config/dashboard-tickers';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';

const sampleResult: SectorSignalsResult = {
    computedAt: '2026-06-04T00:00:00Z',
    stocks: [
        {
            symbol: 'AAPL',
            koreanName: '애플',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 1.5,
            trend: 'uptrend',
            signals: [],
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
    return import('../api/sectorSignalsCache');
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
        const r = await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
        expect(mockRedisCtor).not.toHaveBeenCalled();
        expect(mockGetSectorSignals).toHaveBeenCalledWith(
            mockProvider,
            SECTOR_STOCKS,
            '1Day'
        );
        expect(r).toEqual(sampleResult);
    });

    it('Redis hit 시 getSectorSignals 미호출, 종목 목록 fingerprint 캐시값 반환', async () => {
        mockRedisGet.mockResolvedValue({ data: sampleResult });
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        const r = await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Hour'
        );
        expect(mockRedisGet).toHaveBeenCalledWith(
            expect.stringMatching(/^sector-signals:us:1Hour:[a-f0-9]{12}$/)
        );
        expect(mockGetSectorSignals).not.toHaveBeenCalled();
        expect(r).toEqual(sampleResult);
    });

    it('Redis miss 시 getSectorSignals 호출 후 fingerprint key로 저장', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(sampleResult);
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '15Min'
        );
        expect(mockRedisSet).toHaveBeenCalledWith(
            expect.stringMatching(/^sector-signals:us:15Min:[a-f0-9]{12}$/),
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
        await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    /**
     * `result.stocks`는 "조회 성공한 종목"이 아니라 **"신호가 잡힌 종목"**이다
     * (core `computeStockSignalResult`가 신호 0개면 `null`을 돌린다). 설정 종목 수
     * 대비 비율로 완전성을 재면 조용한 장에서 캐시 쓰기가 통째로 막힌다 —
     * 한때 그렇게 만들었다가 되돌린 자리라 회귀를 고정해 둔다. 여기서 1종목 결과를
     * 수십 종목짜리 미국 설정에 물리는 것이 그 회귀를 재현하는 조합이다.
     */
    it('(guard: true) stocks가 있으면 설정 종목 수와 무관하게 set 호출', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(sampleResult); // 1종목
        mockRedisSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });

        await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE, // 실제 설정은 수십 종목
            '1Day'
        );

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
        const r = await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
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
        const r = await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
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
        await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
        expect(mockRedisGet).toHaveBeenCalledWith(
            expect.stringMatching(/^sector-signals:us:1Day:[a-f0-9]{12}$/)
        );
        vi.clearAllMocks();
        mockRedisGet.mockResolvedValue({ data: sampleResult });
        await mod.getCachedSectorSignals(
            mockProvider,
            US_DASHBOARD_SCOPE,
            '15Min'
        );
        expect(mockRedisGet).toHaveBeenCalledWith(
            expect.stringMatching(/^sector-signals:us:15Min:[a-f0-9]{12}$/)
        );
    });

    /** scope.id가 키에 들어가는 것이 두 시장을 가르는 유일한 장치다. */
    it('kr scope는 kr 접두 키를 쓴다', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockGetSectorSignals.mockResolvedValue(emptyResult);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });

        await mod.getCachedSectorSignals(
            mockProvider,
            KR_DASHBOARD_SCOPE,
            '1Hour'
        );

        expect(mockRedisGet).toHaveBeenCalledWith(
            expect.stringMatching(/^sector-signals:kr:1Hour:[a-f0-9]{12}$/)
        );
    });
});
