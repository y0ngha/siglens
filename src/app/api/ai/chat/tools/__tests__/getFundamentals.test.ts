import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    isTabAllowed,
    getProvider,
    resolveMarketProfile,
    getNextEarningsReport,
} = vi.hoisted(() => ({
    isTabAllowed: vi.fn(),
    getProvider: vi.fn(),
    resolveMarketProfile: vi.fn(),
    getNextEarningsReport: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile,
}));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
    }),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: getProvider,
}));
vi.mock('@/entities/earnings-report', () => ({ getNextEarningsReport }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'fake-db' }),
}));

import { getFundamentalsTool } from '@/app/api/ai/chat/tools/getFundamentals';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

function fakeProvider(overrides: Record<string, unknown> = {}) {
    return {
        getProfile: vi.fn().mockResolvedValue({
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            ceo: null,
            website: null,
            description: null,
        }),
        getKeyMetricsTtm: vi.fn().mockResolvedValue({
            peRatioTTM: 30,
            priceToSalesRatioTTM: 8,
            pbRatioTTM: 40,
            pegRatioTTM: 2,
            enterpriseValueOverEBITDATTM: 22,
            epsTTM: 6.1,
        }),
        getRatiosTtm: vi.fn().mockResolvedValue({
            returnOnEquityTTM: 1.5,
            returnOnAssetsTTM: 0.3,
            operatingProfitMarginTTM: 0.3,
            netProfitMarginTTM: 0.25,
            debtRatioTTM: 0.8,
            currentRatioTTM: 1.0,
        }),
        getIncomeStatementGrowth: vi
            .fn()
            .mockResolvedValue({ growthRevenue: 0.08, growthEPS: 0.1 }),
        getFinancialScores: vi
            .fn()
            .mockResolvedValue({ altmanZScore: 8, piotroskiScore: 7 }),
        getCashFlowStatement: vi
            .fn()
            .mockResolvedValue({ operatingCashFlow: 1_000_000 }),
        getGradesConsensus: vi.fn().mockResolvedValue({
            strongBuy: 10,
            buy: 20,
            hold: 5,
            sell: 1,
            strongSell: 0,
        }),
        getPriceTargetConsensus: vi.fn().mockResolvedValue({
            targetHigh: 300,
            targetLow: 200,
            targetMedian: 250,
            targetConsensus: 245,
        }),
        getAnalystEstimates: vi.fn().mockResolvedValue({
            estimatedEpsAvg: 2,
            estimatedRevenueAvg: 1e11,
        }),
        ...overrides,
    };
}

describe('getFundamentalsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
        resolveMarketProfile.mockResolvedValue('us-equity');
        getNextEarningsReport.mockResolvedValue(null);
    });

    it('크립토 등 fundamental 탭이 없는 심볼은 프로바이더 호출 없이 available:false', async () => {
        isTabAllowed.mockResolvedValue(false);
        const r = await getFundamentalsTool({ symbol: 'BTCUSD' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'BTCUSD',
            available: false,
            reason: 'tab_not_available',
        });
        expect(getProvider).not.toHaveBeenCalled();
    });

    it('profile이 없으면 available:false (no_profile)', async () => {
        const provider = fakeProvider({
            getProfile: vi.fn().mockResolvedValue(null),
        });
        getProvider.mockReturnValue(provider);
        const r = await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'AAPL',
            available: false,
            reason: 'no_profile',
        });
    });

    it('전 섹션이 채워지면 통화·밸류에이션·헬스·애널리스트를 투영한다', async () => {
        getProvider.mockReturnValue(fakeProvider());
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            profile: { currency: string; name: string };
            valuation: { pe: number };
            health: { altmanZScore: number; operatingCashFlow: number };
            analyst: { consensus: { strongBuy: number } };
        };
        expect(r.available).toBe(true);
        expect(r.profile).toEqual({
            name: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            currency: 'USD',
        });
        expect(r.valuation.pe).toBe(30);
        expect(r.health.altmanZScore).toBe(8);
        expect(r.health.operatingCashFlow).toBe(1_000_000);
        expect(r.analyst.consensus.strongBuy).toBe(10);
    });

    it('밸류에이션 조회가 실패해도(allSettled) 프로필·다른 섹션은 살아남는다', async () => {
        const provider = fakeProvider({
            getKeyMetricsTtm: vi.fn().mockRejectedValue(new Error('fmp 500')),
        });
        getProvider.mockReturnValue(provider);
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            valuation: unknown;
            growth: unknown;
        };
        expect(r.available).toBe(true);
        expect(r.valuation).toBeNull();
        expect(r.growth).not.toBeNull();
    });

    it('다음 실적일이 있으면 analyst.nextEarningsDate에 실린다 — DB 캐시 로더를 심볼·db로 호출', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getNextEarningsReport.mockResolvedValue({
            symbol: 'AAPL',
            earningsDate: '2026-10-30',
            epsActual: null,
            epsEstimated: 1.5,
            revenueActual: null,
            revenueEstimated: 1e11,
            lastUpdated: '2026-09-01T00:00:00.000Z',
        });
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            analyst: { nextEarningsDate: string | null };
        };
        expect(r.analyst.nextEarningsDate).toBe('2026-10-30');
        // Reuses the shared DB-backed cached loader (entities/earnings-report)
        // rather than an uncached provider call — this is the assertion that
        // fails if the caching wrapper is dropped.
        expect(getNextEarningsReport).toHaveBeenCalledWith('AAPL', 'fake-db');
    });

    it('실적일 조회가 실패해도(allSettled) 나머지 섹션은 살아남고 nextEarningsDate는 null', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getNextEarningsReport.mockRejectedValue(new Error('db down'));
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            analyst: { nextEarningsDate: string | null; consensus: unknown };
        };
        expect(r.available).toBe(true);
        expect(r.analyst.nextEarningsDate).toBeNull();
        expect(r.analyst.consensus).not.toBeNull();
    });

    it('한국 종목은 KRW 통화로 투영된다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getProvider.mockReturnValue(fakeProvider());
        const r = (await getFundamentalsTool(
            { symbol: '005930.KS' },
            ctx,
            rt
        )) as { profile: { currency: string } };
        expect(r.profile.currency).toBe('KRW');
    });
});
