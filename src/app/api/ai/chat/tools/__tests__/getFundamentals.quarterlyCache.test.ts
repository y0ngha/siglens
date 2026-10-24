import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `recentQuarters` must come from the financials tab's own cached rows — the
 * same Redis key (`financials:income:<SYM>:quarter`) the tab's quarter toggle
 * fills — never a second FMP request. Only the outer edges are faked here:
 * the Redis read (`getOrSetCache`) and the FMP HTTP client, which fails the
 * test if anything reaches it. The provider factory, the Redis-caching
 * decorator and the FMP adapter between them are the real ones.
 */
const { getOrSetCache, fmpGet } = vi.hoisted(() => ({
    getOrSetCache: vi.fn(),
    fmpGet: vi.fn(),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet }));
// 지수 편입 목록은 Wikipedia를 읽으므로 이 테스트의 관심사(분기 캐시)와 분리한다.
vi.mock('@/app/api/ai/chat/tools/indexMembership', () => ({
    loadIndexMemberships: async () => null,
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: async () => true,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: async () => 'us-equity',
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: async () => null,
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({
        getProfile: async () => ({
            symbol: 'STX',
            companyName: 'Seagate',
            sector: 'Technology',
            industry: 'Storage',
            marketCap: 1,
            ceo: null,
            website: null,
            description: null,
        }),
        getKeyMetricsTtm: async () => null,
        getRatiosTtm: async () => null,
        getIncomeStatementGrowth: async () => null,
        getFinancialScores: async () => null,
        getCashFlowStatement: async () => null,
        getGradesConsensus: async () => null,
        getPriceTargetConsensus: async () => null,
        getAnalystEstimates: async () => null,
    }),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: async () => null }),
}));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsSchedule: async () => null,
    listReportedEarningsDates: async () => [],
}));
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
    getCachedBarsWithIndicators: async () => ({ bars: [], indicators: {} }),
}));
vi.mock('@/app/api/ai/chat/tools/loadSecQuarters', () => ({
    loadSecQuarters: async () => null,
}));
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
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

describe('get_fundamentals recentQuarters source', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fmpGet.mockRejectedValue(new Error('unexpected FMP request'));
    });

    it("reads the financials tab's cached quarterly income key and makes no FMP request", async () => {
        const cachedRow = {
            fiscalYear: '2026',
            period: 'Q4',
            date: '2026-07-03',
            filingDate: '2026-08-01',
            reportedCurrency: 'USD',
            revenue: 2_440_000_000,
            grossProfit: null,
            operatingIncome: null,
            netIncome: null,
            ebitda: null,
            eps: 5.7,
            epsDiluted: 5.58,
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
        };
        getOrSetCache.mockImplementation(async (key: string) => {
            if (key === 'financials:income:STX:quarter') return [cachedRow];
            // Dividend history is its own Redis key; an empty list = non-payer.
            return key === 'dividends:STX' ? [] : null;
        });

        const r = (await getFundamentalsTool({ symbol: 'STX' }, ctx, rt)) as {
            recentQuarters: Array<{ periodEnd: string; filingDate: string }>;
        };

        expect(getOrSetCache).toHaveBeenCalledWith(
            'financials:income:STX:quarter',
            expect.any(Number),
            expect.any(Function)
        );
        expect(fmpGet).not.toHaveBeenCalled();
        expect(r.recentQuarters).toEqual([
            expect.objectContaining({
                periodEnd: '2026-07-03',
                filingDate: '2026-08-01',
                epsDiluted: 5.58,
            }),
        ]);
    });
});
