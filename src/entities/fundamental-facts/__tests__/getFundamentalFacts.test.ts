const {
    mockFinancials,
    mockScorecard,
    mockProvider,
    mockSchedule,
    mockListReportedEps,
    mockAnalystViews,
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
    mockAnalystViews: vi.fn(),
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
vi.mock('@/entities/analyst-views/server/getAnalystViews', () => ({
    getAnalystViews: mockAnalystViews,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => false }));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsSchedule: mockSchedule,
}));
vi.mock('@/entities/earnings-report/server/earningsReportsRepository', () => ({
    DrizzleEarningsReportsRepository: class {
        listReportedEps = mockListReportedEps;
    },
}));
const { mockStaticSymbolCache } = vi.hoisted(() => ({
    mockStaticSymbolCache: vi.fn(
        (_key: readonly string[], _symbol: string, fetcher: () => unknown) =>
            fetcher()
    ),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/shared/lib/etTimeUtils', () => ({
    kstDateKey: () => '2026-11-08',
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFundamentalFacts } from '../server/getFundamentalFacts';

const flowsScorecard = {
    dilution: {
        metrics: {
            filingsInWindow: 1,
            atmFilings: 1,
            marketedOfferingFilings: 0,
            privatePlacementFilings: 0,
            shelfFilings: 0,
            registrationFilings: 0,
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
    mockSchedule.mockResolvedValue({
        earningsDate: '2026-11-20',
        dateConfirmed: null,
    });
    mockAnalystViews.mockResolvedValue({ earnings: null, degraded: [] });
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
        // 실적은 DB 직접 읽기라 `unstable_cache`(staticSymbolCache) 안에서만 읽는다 — 밖이면 ISR이 동적으로 뒤집힌다.
        expect(mockStaticSymbolCache).toHaveBeenCalledWith(
            ['fundamental-facts:earnings', 'LAES', '2026-11-07'],
            'LAES',
            expect.any(Function),
            [],
            43200
        );
        // 목표가·의견은 펀더멘털 섹션과 같은 키(캐시 공유)로 읽는다.
        const keys = mockStaticSymbolCache.mock.calls.map(([key]) => key[0]);
        expect(keys).toEqual(
            expect.arrayContaining([
                'fundamental:pt-consensus',
                'fundamental:pt-summary',
                'fundamental:grades-consensus-v2',
            ])
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

    describe('Yahoo 실패 fallback 분포', () => {
        it('쓸 수 있는 값이라 성공 로드다: complete가 유지되고 FMP 건수가 의견 문장에 쓰인다', async () => {
            mockProvider.getGradesConsensus.mockResolvedValue({
                strongBuy: 2,
                buy: 3,
                hold: 1,
                sell: 0,
                strongSell: 0,
                source: 'fmp',
                yahooFailed: true,
            });

            const result = await getFundamentalFacts('GRYF');

            expect(result).toMatchObject({ complete: true, indexable: true });
            expect(
                result.facts.find(f => f.kind === 'priceTarget')
            ).toMatchObject({ buy: 5, hold: 1, sell: 0 });
        });
    });

    describe('투자의견 로드 실패', () => {
        it('실패는 FMP 자체가 실패한 것이므로 종전처럼 불완전(noindex)이다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockProvider.getGradesConsensus.mockRejectedValue(
                new Error('fmp down')
            );

            const result = await getFundamentalFacts('GRFAIL');

            expect(result).toMatchObject({ complete: false, indexable: false });
            const target = result.facts.find(f => f.kind === 'priceTarget');
            expect(target).toMatchObject({ buy: 0, hold: 0, sell: 0 });
        });
    });

    describe('다음 실적 확정 여부', () => {
        const nextEarnings = (
            facts: readonly { kind: string }[]
        ): Record<string, unknown> | undefined =>
            facts.find(f => f.kind === 'nextEarnings') as
                | Record<string, unknown>
                | undefined;

        it('미국: Yahoo가 같은 날짜를 확정이라 하면 확정과 세션을 싣는다', async () => {
            mockAnalystViews.mockResolvedValue({
                earnings: {
                    date: '2026-11-20',
                    isEstimate: false,
                    session: 'after_market',
                    callAt: null,
                },
                degraded: [],
            });

            const result = await getFundamentalFacts('USCONF');

            expect(mockAnalystViews).toHaveBeenCalledWith('USCONF', {
                detail: 'lite',
            });
            expect(nextEarnings(result.facts)).toMatchObject({
                date: '2026-11-20',
                confirmed: true,
                session: 'after_market',
            });
        });

        it('미국: Yahoo가 확정한 다른 날짜가 FMP 예정일을 이긴다(일수도 그 날짜 기준)', async () => {
            mockAnalystViews.mockResolvedValue({
                earnings: {
                    date: '2026-11-18',
                    isEstimate: false,
                    session: 'before_market',
                    callAt: null,
                },
                degraded: [],
            });

            const result = await getFundamentalFacts('USPROMO');

            expect(nextEarnings(result.facts)).toMatchObject({
                date: '2026-11-18',
                daysUntil: 11,
                confirmed: true,
                session: 'before_market',
            });
        });

        it('Yahoo 힌트가 없으면 미확정 그대로', async () => {
            const result = await getFundamentalFacts('USNOHINT');
            expect(nextEarnings(result.facts)).toMatchObject({
                confirmed: null,
                session: null,
            });
        });

        it('힌트는 DB 일정과 별도의 캐시 항목(12시간)으로 읽는다', async () => {
            await getFundamentalFacts('USKEY');
            expect(mockStaticSymbolCache).toHaveBeenCalledWith(
                ['fundamental-facts:earnings-hint', 'USKEY'],
                'USKEY',
                expect.any(Function),
                [],
                43200
            );
        });

        it('Yahoo가 degraded면 로더가 던져 캐시에 굳지 않고, 사실은 미확정이며 complete는 그대로', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockAnalystViews.mockResolvedValue({
                earnings: null,
                degraded: ['yahoo'],
            });
            const result = await getFundamentalFacts('USDEGR');
            expect(result.complete).toBe(true);
            expect(nextEarnings(result.facts)).toMatchObject({
                confirmed: null,
            });
        });

        it('FMP만 degraded인 힌트는 그대로 쓴다', async () => {
            mockAnalystViews.mockResolvedValue({
                earnings: {
                    date: '2026-11-20',
                    isEstimate: false,
                    session: 'after_market',
                    callAt: null,
                },
                degraded: ['fmp'],
            });
            const result = await getFundamentalFacts('USFMPDEG');
            expect(nextEarnings(result.facts)).toMatchObject({
                confirmed: true,
            });
        });

        it('힌트 조회가 던져도 사실은 미확정으로 남고 complete에 영향이 없다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockAnalystViews.mockRejectedValue(new Error('boom'));

            const result = await getFundamentalFacts('USTHROW');

            expect(result.complete).toBe(true);
            expect(nextEarnings(result.facts)).toMatchObject({
                date: '2026-11-20',
                confirmed: null,
            });
        });

        it('힌트가 예산(2.5초) 안에 안 오면 기다리지 않고 미확정으로 간다', async () => {
            vi.useRealTimers();
            vi.useFakeTimers({
                now: new Date('2026-11-08T04:00:00Z'),
                toFake: ['Date', 'setTimeout', 'clearTimeout'],
            });
            mockAnalystViews.mockReturnValue(new Promise(() => {}));

            const pending = getFundamentalFacts('USSLOW');
            await vi.advanceTimersByTimeAsync(2_500);
            const result = await pending;

            expect(result.complete).toBe(true);
            expect(nextEarnings(result.facts)).toMatchObject({
                confirmed: null,
            });
        });

        it('한국 종목은 애널리스트 뷰도 힌트 캐시 항목도 부르지 않는다', async () => {
            const result = await getFundamentalFacts('005930.KS');

            expect(mockAnalystViews).not.toHaveBeenCalled();
            const keys = mockStaticSymbolCache.mock.calls.map(
                ([key]) => key[0]
            );
            expect(keys).not.toContain('fundamental-facts:earnings-hint');
            expect(nextEarnings(result.facts)).toMatchObject({
                confirmed: null,
                session: null,
            });
        });
    });
});
