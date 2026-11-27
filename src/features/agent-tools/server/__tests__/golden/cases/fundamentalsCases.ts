import {
    tprEps,
    tprRevenue,
} from '@/entities/earnings-report/__tests__/fixtures/secConcepts';
import { providerKrValuation } from '@/entities/kr-valuation/lib/computeKrValuation';
import {
    fakes,
    repos,
} from '@/features/agent-tools/server/__tests__/golden/boundary';
import { analystViews } from '@/features/agent-tools/server/__tests__/golden/fixtures';
import {
    CLOCKS,
    listCrypto,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '@/features/agent-tools/server/__tests__/golden/goldenCase';
import { addUtcIsoDays } from '@/shared/lib/isoDate';

/**
 * `get_fundamentals` — FMP 펀더멘털·재무제표, SEC XBRL 분기(실제 SEC 응답 모양의 `secConcepts` 픽스처), 배당(FMP/Yahoo/DART),
 * 지수 편입(위키백과 목록), 애널리스트 뷰(가벼운 조회), 실적 반응(합성 일봉 위에서 계산).
 */

function fundamentalProvider(over: {
    name: string;
    marketCap: number;
    pe: number | null;
    epsTtm: number;
}) {
    return {
        getProfile: async (symbol: string) => ({
            symbol,
            companyName: over.name,
            sector: 'Technology',
            industry: 'Semiconductor Equipment & Materials',
            marketCap: over.marketCap,
            ceo: 'Ava Lindqvist',
            website: 'https://goldenrod.example.com',
            description: 'Designs process controllers for semiconductor fabs.',
        }),
        getKeyMetricsTtm: async () => ({
            peRatioTTM: over.pe,
            priceToSalesRatioTTM: 8.412736,
            pbRatioTTM: 11.30418,
            pegRatioTTM: 1.6271,
            enterpriseValueOverEBITDATTM: 24.918374,
            epsTTM: over.epsTtm,
        }),
        getRatiosTtm: async () => ({
            returnOnEquityTTM: 0.4183726,
            returnOnAssetsTTM: 0.1927364,
            operatingProfitMarginTTM: 0.3014827,
            netProfitMarginTTM: 0.2471936,
            debtRatioTTM: 0.4127,
            currentRatioTTM: 2.31847,
        }),
        getIncomeStatementGrowth: async () => ({
            growthRevenue: 0.1183726,
            growthEPS: 0.1641827,
        }),
        getFinancialScores: async () => ({
            altmanZScore: 11.284,
            piotroskiScore: 7,
        }),
        getCashFlowStatement: async () => ({
            operatingCashFlow: 14_281_000_000,
        }),
        getGradesConsensus: async () => ({
            strongBuy: 9,
            buy: 24,
            hold: 11,
            sell: 2,
            strongSell: 1,
            source: 'yahoo',
        }),
        getPriceTargetConsensus: async () => ({
            targetHigh: 330,
            targetLow: 190,
            targetMedian: 262,
            targetConsensus: 259.873333,
        }),
        getAnalystEstimates: async () => ({
            estimatedEpsAvg: 9.4183,
            estimatedRevenueAvg: 61_827_000_000,
        }),
    };
}

const incomeRow = (
    date: string,
    period: string,
    fiscalYear: string,
    i: number
) => ({
    fiscalYear,
    period,
    date,
    filingDate: addUtcIsoDays(date, 33),
    reportedCurrency: 'USD',
    revenue: 13_820_000_000 + i * 412_000_000,
    grossProfit: 6_381_000_000 + i * 201_000_000,
    operatingIncome: 4_112_000_000 + i * 127_000_000,
    netIncome: 3_418_000_000 + i * 99_000_000,
    ebitda: 4_918_000_000 + i * 131_000_000,
    eps: Number((2.21 + i * 0.07).toFixed(2)),
    epsDiluted: Number((2.18 + i * 0.07).toFixed(2)),
    grossMargin: 0.4617,
    operatingMargin: 0.2975,
    netMargin: 0.2473,
});

const QUARTERS = [
    ['2026-09-27', 'Q3', '2026'],
    ['2026-06-28', 'Q2', '2026'],
    ['2026-03-29', 'Q1', '2026'],
    ['2025-12-28', 'Q4', '2025'],
    ['2025-09-28', 'Q3', '2025'],
    ['2025-06-29', 'Q2', '2025'],
    ['2025-03-30', 'Q1', '2025'],
    ['2024-12-29', 'Q4', '2024'],
] as const;

const REPORTED = [
    '2026-10-29',
    '2026-07-30',
    '2026-04-30',
    '2026-01-29',
    '2025-10-30',
    '2025-07-31',
    '2025-05-01',
    '2025-01-30',
];

export function arrangeUsFundamentals(): void {
    listUsStock();
    fakes.getFundamentalDataProvider.mockImplementation(() =>
        fundamentalProvider({
            name: 'Goldenrod Systems Inc.',
            marketCap: 412_384_000_000,
            pe: 31.284716,
            epsTtm: 7.8273,
        })
    );
    fakes.getFinancialStatementsProvider.mockImplementation(() => ({
        getIncomeStatements: async () =>
            QUARTERS.map(([date, period, year], i) =>
                incomeRow(date, period, year, QUARTERS.length - i)
            ),
    }));
    fakes.getFmpGradesConsensus.mockResolvedValue({
        strongBuy: 7,
        buy: 21,
        hold: 13,
        sell: 1,
        strongSell: 0,
    });
    fakes.getNextEarningsSchedule.mockResolvedValue({
        symbol: SYMBOLS.us,
        earningsDate: '2027-01-28',
        epsActual: null,
        epsEstimated: 2.71,
        revenueActual: null,
        revenueEstimated: 17_120_000_000,
        dateConfirmed: false,
    });
    fakes.listReportedEarningsDates.mockResolvedValue(REPORTED);
    fakes.getFmpDividendHistory.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
            exDate: addUtcIsoDays('2026-11-06', -91 * i),
            payDate: addUtcIsoDays('2026-11-13', -91 * i),
            amount: 0.26 - (i >= 4 ? 0.02 : 0),
        }))
    );
    fakes.fetchIndexConstituents.mockImplementation(async (index: string) =>
        index === 'dowJones' ? ['AAA', 'BBB'] : [SYMBOLS.us, 'AAA', 'CCC']
    );
    repos.secFilings.methods.findCikBySymbol.mockResolvedValue(1_990_001);
    fakes.fetchCompanyConceptJson.mockImplementation(
        async (_cik: number, concept: string) => {
            if (concept === 'EarningsPerShareDiluted') return tprEps;
            if (concept === 'Revenues') return tprRevenue;
            return null;
        }
    );
    fakes.getAnalystViews.mockResolvedValue(analystViews(SYMBOLS.us, 0));
}

const dartRow = (se: string, kind: string, value: string) => ({
    se,
    stock_knd: kind,
    thstrm: value,
    frmtrm: '-',
    lwfr: '-',
});

export const fundamentalsCases: GoldenCase[] = [
    {
        tool: 'get_fundamentals',
        name: 'us-every-section-full-size',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: arrangeUsFundamentals,
    },
    {
        tool: 'get_fundamentals',
        name: 'us-weekend-sec-and-index-failures',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            arrangeUsFundamentals();
            fakes.fetchCompanyConceptJson.mockRejectedValue(
                new Error('sec 503')
            );
            fakes.fetchIndexConstituents.mockRejectedValue(
                new Error('wikipedia 500')
            );
            fakes.getFmpDividendHistory.mockResolvedValue([]);
            fakes.getNextEarningsSchedule.mockResolvedValue(null);
        },
    },
    {
        tool: 'get_fundamentals',
        name: 'kr-listed-basis-dart-dividend',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => {
            listKrStock();
            fakes.getFundamentalDataProvider.mockImplementation(() =>
                fundamentalProvider({
                    name: 'Hanbit Precision Co., Ltd.',
                    marketCap: 7_284_000_000_000,
                    pe: 18.41,
                    epsTtm: 6_521,
                })
            );
            fakes.findKrListedShares.mockResolvedValue(61_420_000);
            fakes.getKrValuation.mockImplementation(
                async (
                    _symbol: string,
                    _close: unknown,
                    provider: {
                        pe: number | null;
                        pb: number | null;
                        epsTtm: number | null;
                    }
                ) => providerKrValuation(provider, 'dart_unavailable')
            );
            fakes.getYahooDividendData.mockResolvedValue({
                history: [
                    { exDate: '2025-12-29', amount: 1_450 },
                    { exDate: '2024-12-27', amount: 1_300 },
                ],
                summary: {
                    dividendRate: 1_450,
                    trailingAnnualDividendRate: 1_450,
                    dividendYield: 0.0121,
                    trailingAnnualDividendYield: 0.0119,
                    exDividendDate: '2025-12-29',
                    lastDividendValue: 1_450,
                    lastDividendDate: '2025-12-29',
                },
            });
            fakes.getKrDartCorp.mockResolvedValue({
                corpCode: '00990110',
                matchedStockCode: '900110',
                viaCommonShare: false,
                corpName: '한빛정밀',
            });
            fakes.fetchAlotMatter.mockImplementation(
                async (_corp: string, year: number) =>
                    year === 2025
                        ? [
                              dartRow('주당 현금배당금(원)', '보통주', '1,450'),
                              dartRow('주당 현금배당금(원)', '우선주', '1,500'),
                              dartRow('현금배당수익률(%)', '보통주', '1.2'),
                          ]
                        : null
            );
            fakes.listReportedEarningsDates.mockResolvedValue([
                '2026-10-28',
                '2026-07-29',
                '2026-04-29',
            ]);
        },
    },
    {
        tool: 'get_fundamentals',
        name: 'kr-stale-listing',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => {
            listKrStock({ lastDate: '2026-09-30' });
            fakes.getFundamentalDataProvider.mockImplementation(() =>
                fundamentalProvider({
                    name: 'Hanbit Precision Co., Ltd.',
                    marketCap: 7_284_000_000_000,
                    pe: 18.41,
                    epsTtm: 6_521,
                })
            );
        },
    },
    {
        tool: 'get_fundamentals',
        name: 'crypto-tab-not-available',
        now: CLOCKS.crypto,
        args: { symbol: SYMBOLS.crypto },
        arrange: listCrypto,
    },
    {
        tool: 'get_fundamentals',
        name: 'no-profile',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us2 },
        arrange: () => {
            fakes.getFundamentalDataProvider.mockImplementation(() => ({
                ...fundamentalProvider({
                    name: 'x',
                    marketCap: 1,
                    pe: null,
                    epsTtm: 0,
                }),
                getProfile: async () => null,
            }));
        },
    },
];
