import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockFinancials,
    mockScorecard,
    mockProvider,
    mockSchedule,
    mockListReportedEps,
} = vi.hoisted(() => ({
    mockFinancials: vi.fn(),
    mockScorecard: vi.fn(),
    mockProvider: {
        getPriceTargetConsensus: vi.fn(),
        getPriceTargetSummary: vi.fn(),
        getGradesConsensus: vi.fn(),
    },
    mockSchedule: vi.fn(),
    mockListReportedEps: vi.fn(),
}));

vi.mock(
    '@/entities/financials-statements/server/getFinancialsSnapshot',
    () => ({ getFinancialsSnapshot: mockFinancials })
);
vi.mock('@/entities/investor-flows/server/getInvestorFlowsScorecard', () => ({
    getInvestorFlowsScorecard: mockScorecard,
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => mockProvider,
}));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsSchedule: mockSchedule,
}));
vi.mock('@/entities/earnings-report/server/earningsReportsRepository', () => ({
    DrizzleEarningsReportsRepository: class {
        listReportedEps = mockListReportedEps;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/shared/lib/etTimeUtils', () => ({
    kstDateKey: () => '2026-11-08',
}));

import { getFundamentalFacts } from '../server/getFundamentalFacts';

const flowsScorecard = {
    dilution: {
        metrics: {
            filingsInWindow: 1,
            atmFilings: 1,
            shelfFilings: 0,
            latestFilingDate: '2026-10-01',
        },
    },
    insider: {
        metrics: {
            buyCount: 0,
            sellCount: 3,
            buyValueUsd: 0,
            sellValueUsd: 170_294,
        },
    },
    short: { metrics: { shortInterestPctFloat: 4.4, daysToCover: 2.03 } },
    freshness: {
        dilutionWindow: { from: null, to: null, days: 180 },
        insiderWindow: { from: null, to: null, days: 90 },
        shortInterestSettlementDate: '2026-10-15',
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    // 2026-11-07 23:00 ET = 11-08 13:00 KST — 미국 종목은 ET 날짜, 한국 종목은 KST 날짜를 쓴다.
    vi.useFakeTimers({
        now: new Date('2026-11-08T04:00:00Z'),
        toFake: ['Date'],
    });
    mockFinancials.mockResolvedValue({
        income: [
            { date: '2025-12-31', netIncome: -40 },
            { date: '2024-12-31', netIncome: 3 },
        ],
        balance: [
            { date: '2024-12-31', cashAndShortTermInvestments: 1 },
            { date: '2025-12-31', cashAndShortTermInvestments: 482 },
        ],
        cashFlow: [
            {
                date: '2025-12-31',
                operatingCashFlow: -43,
                reportedCurrency: 'USD',
            },
            {
                date: '2024-12-31',
                operatingCashFlow: 5,
                reportedCurrency: 'USD',
            },
        ],
        incomeGrowth: [],
        financialGrowth: [],
        cashFlowGrowth: [],
    });
    mockScorecard.mockResolvedValue({
        scorecard: flowsScorecard,
        degraded: false,
    });
    mockProvider.getPriceTargetConsensus.mockResolvedValue({
        targetConsensus: 5.875,
        targetHigh: 8,
        targetLow: 3.75,
        targetMedian: 5.875,
    });
    mockProvider.getPriceTargetSummary.mockResolvedValue(null);
    mockProvider.getGradesConsensus.mockResolvedValue(null);
    mockSchedule.mockResolvedValue({ earningsDate: '2026-11-20' });
    mockListReportedEps.mockResolvedValue([
        { earningsDate: '2026-09-11', epsActual: -0.13, epsEstimated: -0.1 },
        { earningsDate: '2026-03-31', epsActual: -0.2, epsEstimated: -0.1 },
    ]);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('getFundamentalFacts', () => {
    it('입력을 모아 사실을 만들고, 가장 최근 연간 행을 쓴다', async () => {
        const result = await getFundamentalFacts('LAES');

        expect(result.facts.map(f => f.kind)).toEqual([
            'cashRunway',
            'dilutionFilings',
            'insiderTrades',
            'priceTarget',
            'epsStreak',
            'nextEarnings',
        ]);
        expect(result.facts[0]).toMatchObject({
            cash: 482,
            annualBurn: 43,
            asOf: '2025-12-31',
        });
        expect(result).toMatchObject({ complete: true, indexable: true });
        expect(mockListReportedEps).toHaveBeenCalledWith(
            'LAES',
            '2026-11-07',
            8
        );
    });

    it('한 입력원이 실패하면 그 사실만 빠지고, 불완전하면 noindex다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockScorecard.mockRejectedValue(new Error('db down'));
        mockProvider.getPriceTargetConsensus.mockResolvedValue(null);
        mockListReportedEps.mockResolvedValue([]);
        mockSchedule.mockResolvedValue(null);

        const result = await getFundamentalFacts('LAESX');

        expect(result.facts.map(f => f.kind)).toEqual(['cashRunway']);
        expect(result).toMatchObject({ complete: false, indexable: false });
    });

    it('한국 종목은 KST 날짜로 발표 행을 읽는다', async () => {
        await getFundamentalFacts('005930.KS');
        expect(mockListReportedEps).toHaveBeenCalledWith(
            '005930.KS',
            '2026-11-08',
            8
        );
    });

    it('수급이 degraded면 불완전으로 본다', async () => {
        mockScorecard.mockResolvedValue({ scorecard: null, degraded: true });

        const result = await getFundamentalFacts('DEGR');

        expect(result.complete).toBe(false);
    });

    it('모두 정상인데 사실이 3개 미만이면 noindex', async () => {
        mockFinancials.mockResolvedValue({
            income: [],
            balance: [],
            cashFlow: [],
            incomeGrowth: [],
            financialGrowth: [],
            cashFlowGrowth: [],
        });
        mockScorecard.mockResolvedValue({ scorecard: null, degraded: false });
        mockListReportedEps.mockResolvedValue([]);
        mockSchedule.mockResolvedValue(null);

        const result = await getFundamentalFacts('SPY');

        expect(result.facts.map(f => f.kind)).toEqual(['priceTarget']);
        expect(result).toMatchObject({ complete: true, indexable: false });
    });
});
