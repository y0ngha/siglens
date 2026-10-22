import { describe, it, expect } from 'vitest';
import {
    mapProfile,
    mapKeyMetrics,
    mapRatios,
    mapCashFlow,
    mapIncomeGrowth,
    mapPriceTargetConsensus,
    mapGradesConsensus,
    quarterlyTtmNetIncome,
} from '../yahooFundamentalMap';
import type {
    YahooFundamentals,
    YahooStatementRow,
} from '../yahooFundamentalSource';

function build(over: Partial<YahooFundamentals> = {}): YahooFundamentals {
    return {
        summary: null,
        income: [],
        balance: [],
        cashFlow: [],
        quarterlyBalance: [],
        quarterlyIncome: [],
        ...over,
    };
}

/** 소스가 최신순으로 뒤집어 넘기므로 **첫 인자가 최신 회계연도**다. */
function years(...rows: YahooStatementRow[]): YahooStatementRow[] {
    return rows;
}

describe('mapProfile', () => {
    const summary = {
        price: {
            longName: 'Samsung Electronics Co., Ltd.',
            shortName: 'SamsungElec',
        },
        assetProfile: {
            sector: 'Technology',
            industry: 'Consumer Electronics',
            website: 'https://www.samsung.com',
            longBusinessSummary: 'Samsung engages in ...',
            companyOfficers: [
                { name: 'Mr. Hark-Kyu Park', title: 'President & Head of DX' },
                {
                    name: 'Mr. Tae-Moon Roh',
                    title: 'President, CEO, Head of MX',
                },
            ],
        },
        summaryDetail: { marketCap: 1_802_521_672_679_424 },
    };

    it('maps the full profile', () => {
        expect(mapProfile('005930.KS', build({ summary } as never))).toEqual({
            symbol: '005930.KS',
            companyName: 'Samsung Electronics Co., Ltd.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 1_802_521_672_679_424,
            ceo: 'Mr. Tae-Moon Roh',
            website: 'https://www.samsung.com',
            description: 'Samsung engages in ...',
        });
    });

    it('picks the CEO by title pattern, not list position', () => {
        // yahoo는 직함 문자열만 주므로 패턴 매칭이 유일한 판별 수단이다.
        const result = mapProfile('005930.KS', build({ summary } as never));
        expect(result!.ceo).toBe('Mr. Tae-Moon Roh');
    });

    it('matches "Chief Executive" spelled out', () => {
        const result = mapProfile(
            'X',
            build({
                summary: {
                    assetProfile: {
                        companyOfficers: [
                            {
                                name: 'Jane Doe',
                                title: 'Chief Executive Officer',
                            },
                        ],
                    },
                },
            } as never)
        );
        expect(result!.ceo).toBe('Jane Doe');
    });

    it('returns null ceo when no officer matches', () => {
        const result = mapProfile(
            'X',
            build({
                summary: {
                    assetProfile: {
                        companyOfficers: [{ name: 'A', title: 'CFO' }],
                    },
                },
            } as never)
        );
        expect(result!.ceo).toBeNull();
    });

    it('falls back to shortName then symbol for the company name', () => {
        expect(
            mapProfile(
                '005930.KS',
                build({
                    summary: { price: { shortName: 'SamsungElec' } },
                } as never)
            )!.companyName
        ).toBe('SamsungElec');

        expect(
            mapProfile('005930.KS', build({ summary: {} } as never))!
                .companyName
        ).toBe('005930.KS');
    });

    it('defaults missing sector/industry/marketCap rather than emitting undefined', () => {
        const result = mapProfile('X', build({ summary: {} } as never));
        expect(result).toMatchObject({
            sector: '',
            industry: '',
            marketCap: 0,
            website: null,
            description: null,
        });
    });

    it('returns null when the summary is absent', () => {
        expect(mapProfile('X', build())).toBeNull();
    });
});

describe('mapKeyMetrics', () => {
    // 전부 삼성전자 2026-08-17 실측값이다.
    const summary = {
        price: { regularMarketPrice: 274_500 },
        summaryDetail: {
            marketCap: 1_802_521_672_679_424,
            priceToSalesTrailing12Months: 3.7147098,
        },
        defaultKeyStatistics: {
            netIncomeToCommon: 149_733_733_564_416,
            // 시총 산출 기준(6.567B)과 어긋나는 값 — EPS 분모로 쓰면 안 된다.
            sharesOutstanding: 5_764_191_903,
            pegRatio: 0.18,
            enterpriseToEbitda: 7.237,
        },
    };
    /** 연간(FY2025) 자기자본. PBR 분모로 쓰면 결산 이후 분기가 빠진다. */
    const balance = years({ stockholdersEquity: 424_313_255_000_000 });
    /** 분기(2026-03-31) 자기자본 — PBR이 실제로 써야 하는 값. */
    const quarterlyBalance = years({
        stockholdersEquity: 473_964_801_000_000,
    });

    it('derives PER from market cap over net income, not from share count', () => {
        // yahoo가 KRX 종목에 trailingPE를 주지 않는다. sharesOutstanding과
        // ordinarySharesNumber가 어긋나므로 주식수를 거치지 않는 쪽이 안정적이다.
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result!.peRatioTTM).toBeCloseTo(12.038, 2);
    });

    it('derives PBR from the latest QUARTERLY equity, not the annual one', () => {
        // 연간(424.3조)을 쓰면 4.25, 분기(474.0조)를 쓰면 3.80. 결산 이후 분기 이익이
        // 반영되지 않아 생기는 과대다 — SK하이닉스 실측에서는 36%까지 벌어졌다.
        const result = mapKeyMetrics(
            build({ summary, balance, quarterlyBalance } as never)
        );
        expect(result!.pbRatioTTM).toBeCloseTo(3.803, 2);
    });

    it('falls back to annual equity when no quarterly balance exists', () => {
        // 신규 상장 등으로 분기 제표가 없는 종목은 연간이라도 보여 주는 편이 낫다.
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result!.pbRatioTTM).toBeCloseTo(4.248, 2);
    });

    it('derives EPS from the implied share count, not sharesOutstanding', () => {
        // 삼성전자 실측(2026-08-17): 보고된 최근 4분기 EPS 합이 22,683원이다.
        //   sharesOutstanding(5.764B) 사용 → 25,977원 (+14.5% 과대)
        //   내재주식수(시총/현재가 = 6.567B) 사용 → 22,802원 (+0.53%)
        const REPORTED_TTM_EPS = 22_683;
        const result = mapKeyMetrics(build({ summary, balance } as never));

        expect(result!.epsTTM).toBeCloseTo(22_802, 0);
        // 보고값과의 상대 오차가 1% 안에 머무는지 — 분모를 잘못 바꾸면 즉시 깨진다.
        expect(Math.abs(result!.epsTTM! / REPORTED_TTM_EPS - 1)).toBeLessThan(
            0.01
        );
    });

    it('keeps price / EPS identical to PER', () => {
        // 같은 분모(내재주식수)를 공유하므로 항등식이어야 한다 — 화면에서 두 지표가
        // 서로 어긋나면 사용자가 값을 신뢰하지 않는다.
        const result = mapKeyMetrics(build({ summary, balance } as never))!;
        const price = summary.price.regularMarketPrice;
        expect(price / result.epsTTM!).toBeCloseTo(result.peRatioTTM!, 6);
    });

    it('returns null EPS when price is missing or zero', () => {
        for (const regularMarketPrice of [0, undefined]) {
            const result = mapKeyMetrics(
                build({
                    summary: { ...summary, price: { regularMarketPrice } },
                    balance,
                } as never)
            );
            expect(result!.epsTTM).toBeNull();
        }
    });

    it('passes through the metrics yahoo already computes', () => {
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result).toMatchObject({
            priceToSalesRatioTTM: 3.7147098,
            pegRatioTTM: 0.18,
            enterpriseValueOverEBITDATTM: 7.237,
        });
    });

    it('returns null for PBR when equity is negative (capital impairment)', () => {
        // 음수 PBR은 수학적으로는 나오지만 "저평가"로 오독된다 — FMP도 비워 보낸다.
        const result = mapKeyMetrics(
            build({
                summary,
                quarterlyBalance: years({ stockholdersEquity: -1_000 }),
            } as never)
        );
        expect(result!.pbRatioTTM).toBeNull();
    });

    it('returns null for PER when net income is zero or negative', () => {
        for (const netIncomeToCommon of [0, -5_000]) {
            const result = mapKeyMetrics(
                build({
                    summary: {
                        ...summary,
                        defaultKeyStatistics: {
                            ...summary.defaultKeyStatistics,
                            netIncomeToCommon,
                        },
                    },
                    balance,
                } as never)
            );
            expect(result!.peRatioTTM).toBeNull();
        }
    });

    it('returns nulls when the balance sheet is missing', () => {
        const result = mapKeyMetrics(build({ summary } as never));
        expect(result!.pbRatioTTM).toBeNull();
        expect(result!.peRatioTTM).not.toBeNull();
    });

    it('uses the most recent quarter for equity', () => {
        const result = mapKeyMetrics(
            build({
                summary,
                quarterlyBalance: years(
                    { stockholdersEquity: 473_964_801_000_000 },
                    { stockholdersEquity: 1 }
                ),
            } as never)
        );
        expect(result!.pbRatioTTM).toBeCloseTo(3.803, 2);
    });

    it('returns null when the summary is absent', () => {
        expect(mapKeyMetrics(build())).toBeNull();
    });
});

/**
 * 피노(033790.KQ) 실측(2026-10-22): yahoo 요약 통계가 2022 회계연도에 멈춰 `netIncomeToCommon`이
 * 4,978만 원이었고, 그 값으로 PER 12,249.5배가 나갔다. 최근 4분기 순이익 합(약 49.3억 원)으로는
 * 약 124배(네이버 112.77배)다.
 */
describe('mapKeyMetrics — 멈춘 요약 통계와 4분기 TTM', () => {
    const MARKET_CAP = 609_869_824_000;
    const quarter = (iso: string, netIncomeCommonStockholders: number) => ({
        date: new Date(`${iso}T00:00:00Z`),
        netIncomeCommonStockholders,
    });
    /** 최신순 4분기, 합 4,930,000,000원. */
    const quarterlyIncome = [
        quarter('2026-06-30', 1_400_000_000),
        quarter('2026-03-31', 1_300_000_000),
        quarter('2025-12-31', 1_130_000_000),
        quarter('2025-09-30', 1_100_000_000),
    ];
    const TTM = 4_930_000_000;
    const summaryWith = (
        lastFiscalYearEnd: string,
        netIncomeToCommon: number
    ) => ({
        price: { regularMarketPrice: 18_000 },
        summaryDetail: {
            marketCap: MARKET_CAP,
            priceToSalesTrailing12Months: 61.9,
        },
        defaultKeyStatistics: {
            netIncomeToCommon,
            lastFiscalYearEnd: new Date(`${lastFiscalYearEnd}T00:00:00Z`),
            enterpriseToEbitda: 900,
            pegRatio: 4,
        },
        financialData: {
            returnOnEquity: 0.00218,
            returnOnAssets: 0.001,
            operatingMargins: 0.01,
            profitMargins: 0.00505,
            currentRatio: 2.1,
            totalDebt: 1_000,
        },
    });
    const STALE = summaryWith('2022-12-31', 49_787_500);

    it('요약이 멈췄으면 최근 4분기 합으로 PER·EPS를 낸다(12,249배가 아니다)', () => {
        const result = mapKeyMetrics(
            build({ summary: STALE, quarterlyIncome } as never)
        )!;
        expect(result.peRatioTTM).toBeCloseTo(MARKET_CAP / TTM, 6);
        expect(result.peRatioTTM).toBeLessThan(200);
        expect(result.epsTTM).toBeCloseTo(TTM / (MARKET_CAP / 18_000), 6);
    });

    it('요약이 멈췄고 4분기가 없으면 PER·EPS를 비운다(재무제표 기간으로만 멈춤을 판정)', () => {
        const result = mapKeyMetrics(
            build({
                summary: STALE,
                quarterlyBalance: [
                    {
                        date: new Date('2026-06-30T00:00:00Z'),
                        stockholdersEquity: 1,
                    },
                ],
            } as never)
        )!;
        expect(result.peRatioTTM).toBeNull();
        expect(result.epsTTM).toBeNull();
    });

    it('요약이 멈췄으면 요약 통계가 계산한 P/S·EV/EBITDA·PEG도 비운다', () => {
        const result = mapKeyMetrics(
            build({ summary: STALE, quarterlyIncome } as never)
        )!;
        expect(result.priceToSalesRatioTTM).toBeNull();
        expect(result.enterpriseValueOverEBITDATTM).toBeNull();
        expect(result.pegRatioTTM).toBeNull();
    });

    it('요약이 신선하고 4분기 합과 3배 안에서 맞으면 4분기 합을 쓴다', () => {
        const result = mapKeyMetrics(
            build({
                summary: summaryWith('2025-12-31', 4_500_000_000),
                quarterlyIncome,
            } as never)
        )!;
        expect(result.peRatioTTM).toBeCloseTo(MARKET_CAP / TTM, 6);
        expect(result.priceToSalesRatioTTM).toBe(61.9);
    });

    it('요약이 신선해도 4분기 합과 3배 넘게 어긋나면 PER·EPS를 비운다', () => {
        const result = mapKeyMetrics(
            build({
                summary: summaryWith('2025-12-31', 49_787_500),
                quarterlyIncome,
            } as never)
        )!;
        expect(result.peRatioTTM).toBeNull();
        expect(result.epsTTM).toBeNull();
    });

    it('4분기 기간이 1년 안에 모이지 않으면(중간 분기 결측) TTM으로 보지 않고 신선한 요약 값을 쓴다', () => {
        const gapped = [
            quarter('2026-06-30', 1),
            quarter('2026-03-31', 1),
            quarter('2025-09-30', 1),
            quarter('2025-06-30', 1),
        ];
        expect(quarterlyTtmNetIncome(gapped)).toBeUndefined();
        const result = mapKeyMetrics(
            build({
                summary: summaryWith('2025-12-31', 4_500_000_000),
                quarterlyIncome: gapped,
            } as never)
        )!;
        expect(result.peRatioTTM).toBeCloseTo(MARKET_CAP / 4_500_000_000, 6);
    });

    it('지배주주 순이익이 없으면 분기 순이익으로 떨어지고, 한 분기라도 비면 TTM을 내지 않는다', () => {
        expect(
            quarterlyTtmNetIncome([
                { date: new Date('2026-06-30T00:00:00Z'), netIncome: 1 },
                quarter('2026-03-31', 2),
                quarter('2025-12-31', 3),
                quarter('2025-09-30', 4),
            ])
        ).toBe(10);
        expect(
            quarterlyTtmNetIncome([
                { date: new Date('2026-06-30T00:00:00Z') },
                quarter('2026-03-31', 2),
                quarter('2025-12-31', 3),
                quarter('2025-09-30', 4),
            ])
        ).toBeUndefined();
        expect(
            quarterlyTtmNetIncome(quarterlyIncome.slice(0, 3))
        ).toBeUndefined();
    });

    it('요약이 멈췄으면 mapRatios의 수익성 비율을 비우고 재무상태표 기반 값은 남긴다', () => {
        const result = mapRatios(
            build({ summary: STALE, quarterlyIncome } as never)
        )!;
        expect(result).toMatchObject({
            returnOnEquityTTM: null,
            returnOnAssetsTTM: null,
            operatingProfitMarginTTM: null,
            netProfitMarginTTM: null,
            currentRatioTTM: 2.1,
        });
    });

    it('요약이 신선하면 mapRatios는 그대로 통과시킨다', () => {
        const result = mapRatios(
            build({
                summary: summaryWith('2025-12-31', 4_500_000_000),
                quarterlyIncome,
            } as never)
        )!;
        expect(result.returnOnEquityTTM).toBe(0.00218);
    });
});

describe('mapRatios', () => {
    const financialData = {
        returnOnEquity: 0.30792,
        returnOnAssets: 0.17692,
        operatingMargins: 0.52187,
        profitMargins: 0.30858,
        currentRatio: 7.531,
        totalDebt: 25_239_139_000_000,
    };

    it('maps the ratios yahoo provides directly', () => {
        const result = mapRatios(
            build({ summary: { financialData } } as never)
        );
        expect(result).toMatchObject({
            returnOnEquityTTM: 0.30792,
            returnOnAssetsTTM: 0.17692,
            operatingProfitMarginTTM: 0.52187,
            netProfitMarginTTM: 0.30858,
            currentRatioTTM: 7.531,
        });
    });

    it('computes debtRatio against total assets, not equity', () => {
        // yahoo `debtToEquity`는 자기자본 대비라 도메인이 기대하는 총자산 대비와 다르다.
        const result = mapRatios(
            build({
                summary: { financialData },
                balance: years({ totalAssets: 566_942_110_000_000 }),
            } as never)
        );
        expect(result!.debtRatioTTM).toBeCloseTo(0.0445, 4);
    });

    it('debtRatio 분모는 연간이 아니라 최신 분기 총자산이다', () => {
        // 분자 `totalDebt`가 TTM 시점 값이라 분모도 같은 시점이어야 한다. 위 케이스는
        // 연간만 줘서 폴백 경로만 밟았고, 그래서 우선순위를 뒤집어도 통과했다 —
        // PBR에는 같은 불변식을 잠그는 테스트가 있는데 여기만 비어 있었다.
        // 분기(566.9조)면 0.0445, 연간(1,000조)이면 0.0252.
        const result = mapRatios(
            build({
                summary: { financialData },
                quarterlyBalance: years({ totalAssets: 566_942_110_000_000 }),
                balance: years({ totalAssets: 1_000_000_000_000_000 }),
            } as never)
        );
        expect(result!.debtRatioTTM).toBeCloseTo(0.0445, 4);
    });

    it('returns null debtRatio when total assets are unavailable', () => {
        const result = mapRatios(
            build({ summary: { financialData } } as never)
        );
        expect(result!.debtRatioTTM).toBeNull();
    });

    it('returns null when financialData is absent', () => {
        expect(mapRatios(build({ summary: {} } as never))).toBeNull();
        expect(mapRatios(build())).toBeNull();
    });
});

describe('mapCashFlow', () => {
    it('reads operating cash flow from the latest year', () => {
        expect(
            mapCashFlow(
                build({
                    cashFlow: years(
                        { operatingCashFlow: 85_315_148_000_000 },
                        { operatingCashFlow: 1 }
                    ),
                })
            )
        ).toEqual({
            operatingCashFlow: 85_315_148_000_000,
            reportedCurrency: null,
        });
    });

    it('returns a null field when the row lacks the value', () => {
        expect(mapCashFlow(build({ cashFlow: years({}) }))).toEqual({
            operatingCashFlow: null,
            reportedCurrency: null,
        });
    });

    it('labels the flow with the filer reporting currency, not the listing', () => {
        expect(
            mapCashFlow(
                build({
                    cashFlow: years({ operatingCashFlow: 1 }),
                    summary: { financialData: { financialCurrency: 'TWD' } },
                } as never)
            )
        ).toEqual({ operatingCashFlow: 1, reportedCurrency: 'TWD' });
    });

    it('returns null when there are no cash flow rows', () => {
        expect(mapCashFlow(build())).toBeNull();
    });

    it('trims whitespace around the reporting currency', () => {
        expect(
            mapCashFlow(
                build({
                    cashFlow: years({ operatingCashFlow: 1 }),
                    summary: { financialData: { financialCurrency: ' TWD ' } },
                } as never)
            )
        ).toEqual({ operatingCashFlow: 1, reportedCurrency: 'TWD' });
    });

    it('normalizes an empty or whitespace-only currency to null', () => {
        expect(
            mapCashFlow(
                build({
                    cashFlow: years({ operatingCashFlow: 1 }),
                    summary: { financialData: { financialCurrency: '' } },
                } as never)
            )
        ).toEqual({ operatingCashFlow: 1, reportedCurrency: null });

        expect(
            mapCashFlow(
                build({
                    cashFlow: years({ operatingCashFlow: 1 }),
                    summary: { financialData: { financialCurrency: '   ' } },
                } as never)
            )
        ).toEqual({ operatingCashFlow: 1, reportedCurrency: null });
    });
});

describe('mapIncomeGrowth', () => {
    it('computes YoY growth from the two most recent fiscal years', () => {
        const result = mapIncomeGrowth(
            build({
                income: years(
                    { totalRevenue: 333_605_938_000_000, basicEPS: 6605 },
                    { totalRevenue: 300_870_903_000_000, basicEPS: 4950 }
                ),
            })
        );
        expect(result!.growthRevenue).toBeCloseTo(0.1088, 4);
        expect(result!.growthEPS).toBeCloseTo(0.3343, 4);
    });

    it('keeps a loss-to-profit swing positive by dividing by the absolute prior', () => {
        // 부호를 그대로 나누면 흑자 전환이 음수 성장률로 표시된다.
        const result = mapIncomeGrowth(
            build({ income: years({ basicEPS: 50 }, { basicEPS: -100 }) })
        );
        expect(result!.growthEPS).toBeCloseTo(1.5, 4);
    });

    it('returns null for a field whose prior value is zero', () => {
        const result = mapIncomeGrowth(
            build({
                income: years(
                    { totalRevenue: 100, basicEPS: 20 },
                    { totalRevenue: 0, basicEPS: 10 }
                ),
            })
        );
        expect(result!.growthRevenue).toBeNull();
        expect(result!.growthEPS).toBeCloseTo(1, 4);
    });

    it('returns null when there is only one fiscal year', () => {
        expect(
            mapIncomeGrowth(build({ income: years({ totalRevenue: 1 }) }))
        ).toBeNull();
    });
});

describe('mapPriceTargetConsensus', () => {
    it('maps the four target fields', () => {
        expect(
            mapPriceTargetConsensus(
                build({
                    summary: {
                        financialData: {
                            targetHighPrice: 725000,
                            targetLowPrice: 210000,
                            targetMedianPrice: 450000,
                            targetMeanPrice: 471908.2,
                        },
                    },
                } as never)
            )
        ).toEqual({
            targetHigh: 725000,
            targetLow: 210000,
            targetMedian: 450000,
            targetConsensus: 471908.2,
        });
    });

    it('returns null when every target is empty (no analyst coverage)', () => {
        // 빈 카드를 렌더하느니 상위의 "데이터 없음" 분기를 타게 한다.
        expect(
            mapPriceTargetConsensus(
                build({ summary: { financialData: {} } } as never)
            )
        ).toBeNull();
    });

    it('keeps a partially filled consensus', () => {
        const result = mapPriceTargetConsensus(
            build({
                summary: { financialData: { targetMeanPrice: 100 } },
            } as never)
        );
        expect(result).toEqual({
            targetHigh: null,
            targetLow: null,
            targetMedian: null,
            targetConsensus: 100,
        });
    });

    it('returns null when financialData is absent', () => {
        expect(mapPriceTargetConsensus(build())).toBeNull();
    });
});

describe('mapGradesConsensus', () => {
    it('uses the first trend entry (current period)', () => {
        expect(
            mapGradesConsensus(
                build({
                    summary: {
                        recommendationTrend: {
                            trend: [
                                {
                                    period: '0m',
                                    strongBuy: 11,
                                    buy: 25,
                                    hold: 1,
                                    sell: 0,
                                    strongSell: 0,
                                },
                                { period: '-1m', strongBuy: 99 },
                            ],
                        },
                    },
                } as never)
            )
        ).toEqual({
            strongBuy: 11,
            buy: 25,
            hold: 1,
            sell: 0,
            strongSell: 0,
        });
    });

    it('defaults missing counts to zero', () => {
        expect(
            mapGradesConsensus(
                build({
                    summary: { recommendationTrend: { trend: [{}] } },
                } as never)
            )
        ).toEqual({
            strongBuy: 0,
            buy: 0,
            hold: 0,
            sell: 0,
            strongSell: 0,
        });
    });

    it('returns null when the trend list is empty or absent', () => {
        expect(
            mapGradesConsensus(
                build({
                    summary: { recommendationTrend: { trend: [] } },
                } as never)
            )
        ).toBeNull();
        expect(mapGradesConsensus(build())).toBeNull();
    });
});
