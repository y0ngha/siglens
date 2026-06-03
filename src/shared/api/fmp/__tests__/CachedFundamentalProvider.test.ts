import { beforeEach, describe, expect, it, vi } from 'vitest';

// 인메모리 fake Redis. envelope 포맷({data})을 그대로 저장/반환.
// NOTE: react는 mock하지 않는다 — vitest에서 React.cache는 pass-through이므로
// 두 번째 호출도 실제로 getOrSetCache에 재진입해 fake redis 히트를 검증하게 된다.
const store = new Map<string, unknown>();
const fakeRedis = {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
    }),
};
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

import { CachedFundamentalProvider } from '@/shared/api/fmp/CachedFundamentalProvider';
import type { FundamentalProvider } from '@/shared/api/fmp/getFundamentalDataProvider';

function makeInner(
    overrides: Partial<FundamentalProvider> = {}
): FundamentalProvider {
    return {
        getProfile: vi.fn(async (s: string) => ({
            symbol: s.toUpperCase(),
            companyName: 'X',
            sector: 'Tech',
            industry: 'SW',
            marketCap: 1e12,
            ceo: 'A',
            website: 'w',
            description: 'd',
        })),
        getKeyMetricsTtm: vi.fn(async () => ({
            peRatioTTM: 10,
            priceToSalesRatioTTM: 3,
            pbRatioTTM: null,
            pegRatioTTM: null,
            enterpriseValueOverEBITDATTM: null,
            epsTTM: null,
        })),
        getRatiosTtm: vi.fn(async () => null),
        getCashFlowStatement: vi.fn(async () => null),
        getIncomeStatementGrowth: vi.fn(async () => null),
        getFinancialScores: vi.fn(async () => null),
        getStockPeers: vi.fn(async () => []),
        getAnalystEstimates: vi.fn(async () => null),
        getGrades: vi.fn(async () => []),
        getGradesConsensus: vi.fn(async () => null),
        getPriceTargetConsensus: vi.fn(async () => null),
        getPriceTargetSummary: vi.fn(async () => null),
        getSectorPerformanceSnapshot: vi.fn(async () => []),
        getHistoricalSectorPerformance: vi.fn(async () => []),
        getEarningsReport: vi.fn(async () => null),
        getEarningsReports: vi.fn(async () => []),
        ...overrides,
    } as FundamentalProvider;
}

beforeEach(() => {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
});

describe('CachedFundamentalProvider — simple cached methods', () => {
    it('caches getProfile under fundamental:profile:<SYM> and uppercases symbol', async () => {
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);

        const first = await provider.getProfile('aapl');
        expect(first?.symbol).toBe('AAPL');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
        expect(store.has('fundamental:profile:AAPL')).toBe(true);

        const second = await provider.getProfile('aapl');
        expect(second?.symbol).toBe('AAPL');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
    });

    it('caches null result (no-data ticker) so it is not refetched', async () => {
        const inner = makeInner({
            getCashFlowStatement: vi.fn(async () => null),
        });
        const provider = new CachedFundamentalProvider(inner);

        expect(await provider.getCashFlowStatement('NODATA')).toBeNull();
        expect(await provider.getCashFlowStatement('NODATA')).toBeNull();
        expect(inner.getCashFlowStatement).toHaveBeenCalledTimes(1);
    });

    it('caches empty array result for getGrades under fundamental:grades:<SYM>', async () => {
        const inner = makeInner({ getGrades: vi.fn(async () => []) });
        const provider = new CachedFundamentalProvider(inner);

        expect(await provider.getGrades('EMPTY')).toEqual([]);
        expect(await provider.getGrades('EMPTY')).toEqual([]);
        expect(inner.getGrades).toHaveBeenCalledTimes(1);
        expect(store.has('fundamental:grades:EMPTY')).toBe(true);
    });

    it('propagates inner errors WITHOUT caching them (worst case)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getFinancialScores: boom });
        const provider = new CachedFundamentalProvider(inner);

        await expect(provider.getFinancialScores('ERR')).rejects.toThrow(
            'FMP 502'
        );
        expect(store.has('fundamental:scores:ERR')).toBe(false);
        await expect(provider.getFinancialScores('ERR')).rejects.toThrow(
            'FMP 502'
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getKeyMetricsTtm: inner throw → null, NOT cached (valuation poison fix)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getKeyMetricsTtm: boom });
        const provider = new CachedFundamentalProvider(inner);

        // decorator catches the throw and returns graceful null
        expect(await provider.getKeyMetricsTtm('ERR')).toBeNull();
        // the failure is NOT cached
        expect(store.has('fundamental:key-metrics:ERR')).toBe(false);
        // 2nd call re-invokes inner (no poisoned null served from cache)
        expect(await provider.getKeyMetricsTtm('ERR')).toBeNull();
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getRatiosTtm: inner throw → null, NOT cached (valuation poison fix)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getRatiosTtm: boom });
        const provider = new CachedFundamentalProvider(inner);

        expect(await provider.getRatiosTtm('ERR')).toBeNull();
        expect(store.has('fundamental:ratios:ERR')).toBe(false);
        expect(await provider.getRatiosTtm('ERR')).toBeNull();
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('falls back to inner when Redis is unavailable (worst case)', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);

        const profile = await provider.getProfile('TSLA');
        expect(profile?.symbol).toBe('TSLA');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
        expect(store.size).toBe(0);
    });

    it('caches keyMetrics/ratios/growth/estimates/gradesConsensus/priceTarget under their keys', async () => {
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);

        await provider.getKeyMetricsTtm('aapl');
        await provider.getRatiosTtm('aapl');
        await provider.getIncomeStatementGrowth('aapl');
        await provider.getAnalystEstimates('aapl');
        await provider.getGradesConsensus('aapl');
        await provider.getPriceTargetConsensus('aapl');
        await provider.getPriceTargetSummary('aapl');

        expect(store.has('fundamental:key-metrics:AAPL')).toBe(true);
        expect(store.has('fundamental:ratios:AAPL')).toBe(true);
        expect(store.has('fundamental:growth:AAPL')).toBe(true);
        expect(store.has('fundamental:estimates:AAPL')).toBe(true);
        expect(store.has('fundamental:grades-consensus:AAPL')).toBe(true);
        expect(store.has('fundamental:price-target-consensus:AAPL')).toBe(true);
        expect(store.has('fundamental:price-target-summary:AAPL')).toBe(true);
    });
});

describe('CachedFundamentalProvider — getStockPeers enrich', () => {
    it('caches raw peers and enriches per/psr from getKeyMetricsTtm', async () => {
        const inner = makeInner({
            getStockPeers: vi.fn(async () => [
                { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2e12 },
                { symbol: 'GOOG', companyName: 'Alphabet', marketCap: 1.5e12 },
            ]),
            getKeyMetricsTtm: vi.fn(async (s: string) =>
                s === 'MSFT'
                    ? {
                          peRatioTTM: 30,
                          priceToSalesRatioTTM: 11,
                          pbRatioTTM: null,
                          pegRatioTTM: null,
                          enterpriseValueOverEBITDATTM: null,
                          epsTTM: null,
                      }
                    : null
            ),
        });
        const provider = new CachedFundamentalProvider(inner);

        const peers = await provider.getStockPeers('AAPL');

        expect(peers).toEqual([
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                marketCap: 2e12,
                per: 30,
                psr: 11,
            },
            {
                symbol: 'GOOG',
                companyName: 'Alphabet',
                marketCap: 1.5e12,
                per: null,
                psr: null,
            },
        ]);
        expect(store.has('fundamental:peers:AAPL')).toBe(true);
        // raw peer 목록 캐싱: 두 번째 호출 시 inner.getStockPeers 재호출 없음
        await provider.getStockPeers('AAPL');
        expect(inner.getStockPeers).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for a symbol with no peers (worst case)', async () => {
        const inner = makeInner({ getStockPeers: vi.fn(async () => []) });
        const provider = new CachedFundamentalProvider(inner);
        expect(await provider.getStockPeers('NONE')).toEqual([]);
    });

    it('enriches each peer sequentially via cached getKeyMetricsTtm', async () => {
        const inner = makeInner({
            getStockPeers: vi.fn(async () => [
                { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2e12 },
                { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2e12 },
            ]),
            getKeyMetricsTtm: vi.fn(async () => ({
                peRatioTTM: 30,
                priceToSalesRatioTTM: 11,
                pbRatioTTM: null,
                pegRatioTTM: null,
                enterpriseValueOverEBITDATTM: null,
                epsTTM: null,
            })),
        });
        const provider = new CachedFundamentalProvider(inner);
        const peers = await provider.getStockPeers('AAPL');
        // 동일 peer 심볼 → getKeyMetricsTtm 결과가 Redis(fundamental:key-metrics:MSFT)로 캐싱돼
        // 두 번째 peer는 캐시 히트(inner.getKeyMetricsTtm 1회)
        expect(inner.getKeyMetricsTtm).toHaveBeenCalledTimes(1);
        expect(peers).toHaveLength(2);
        expect(peers[0].per).toBe(30);
    });
});

describe('CachedFundamentalProvider — sector + pass-through', () => {
    it('caches sector performance under fundamental:sector-performance:<DATE>', async () => {
        const inner = makeInner({
            getSectorPerformanceSnapshot: vi.fn(async () => [
                { sector: 'Technology', changesPercentage: 1.2 },
            ]),
        });
        const provider = new CachedFundamentalProvider(inner);

        const out = await provider.getSectorPerformanceSnapshot('2026-06-04');
        expect(out).toEqual([{ sector: 'Technology', changesPercentage: 1.2 }]);
        expect(store.has('fundamental:sector-performance:2026-06-04')).toBe(
            true
        );

        await provider.getSectorPerformanceSnapshot('2026-06-04');
        expect(inner.getSectorPerformanceSnapshot).toHaveBeenCalledTimes(1);
    });

    it('keys sector snapshot by date, not symbol (different dates miss separately)', async () => {
        const inner = makeInner({
            getSectorPerformanceSnapshot: vi.fn(async () => [
                { sector: 'Energy', changesPercentage: -0.5 },
            ]),
        });
        const provider = new CachedFundamentalProvider(inner);
        await provider.getSectorPerformanceSnapshot('2026-06-04');
        await provider.getSectorPerformanceSnapshot('2026-06-05');
        expect(inner.getSectorPerformanceSnapshot).toHaveBeenCalledTimes(2);
        expect(store.has('fundamental:sector-performance:2026-06-04')).toBe(
            true
        );
        expect(store.has('fundamental:sector-performance:2026-06-05')).toBe(
            true
        );
    });

    it('does NOT cache earnings (pass-through, fresh each call)', async () => {
        const inner = makeInner({
            getEarningsReports: vi.fn(async () => []),
            getEarningsReport: vi.fn(async () => null),
        });
        const provider = new CachedFundamentalProvider(inner);

        await provider.getEarningsReports('AAPL', 5);
        await provider.getEarningsReports('AAPL', 5);
        await provider.getEarningsReport('AAPL');
        await provider.getEarningsReport('AAPL');

        expect(inner.getEarningsReports).toHaveBeenCalledTimes(2);
        expect(inner.getEarningsReport).toHaveBeenCalledTimes(2);
        expect(store.size).toBe(0);
    });

    it('passes through historical sector performance without caching', async () => {
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);
        expect(
            await provider.getHistoricalSectorPerformance('Technology')
        ).toEqual([]);
        expect(store.size).toBe(0);
    });
});
