import { describe, it, expect } from 'vitest';
import {
    mapProfile,
    mapKeyMetrics,
    mapRatios,
    mapCashFlow,
    mapIncomeGrowth,
    mapPriceTargetConsensus,
    mapGradesConsensus,
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
    const summary = {
        summaryDetail: {
            marketCap: 1_802_521_672_679_424,
            priceToSalesTrailing12Months: 3.7147098,
        },
        defaultKeyStatistics: {
            netIncomeToCommon: 149_733_733_564_416,
            sharesOutstanding: 5_764_191_903,
            pegRatio: 0.18,
            enterpriseToEbitda: 7.237,
        },
    };
    const balance = years({ stockholdersEquity: 424_313_255_000_000 });

    it('derives PER from market cap over net income, not from share count', () => {
        // yahoo가 KRX 종목에 trailingPE를 주지 않는다. sharesOutstanding과
        // ordinarySharesNumber가 어긋나므로 주식수를 거치지 않는 쪽이 안정적이다.
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result!.peRatioTTM).toBeCloseTo(12.038, 2);
    });

    it('derives PBR from market cap over stockholders equity', () => {
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result!.pbRatioTTM).toBeCloseTo(4.248, 2);
    });

    it('derives EPS per share from net income over shares outstanding', () => {
        const result = mapKeyMetrics(build({ summary, balance } as never));
        expect(result!.epsTTM).toBeCloseTo(25976.5, 0);
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
                balance: years({ stockholdersEquity: -1_000 }),
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

    it('uses the latest fiscal year for equity', () => {
        const result = mapKeyMetrics(
            build({
                summary,
                balance: years(
                    { stockholdersEquity: 424_313_255_000_000 },
                    { stockholdersEquity: 1 }
                ),
            } as never)
        );
        expect(result!.pbRatioTTM).toBeCloseTo(4.248, 2);
    });

    it('returns null when the summary is absent', () => {
        expect(mapKeyMetrics(build())).toBeNull();
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
        ).toEqual({ operatingCashFlow: 85_315_148_000_000 });
    });

    it('returns a null field when the row lacks the value', () => {
        expect(mapCashFlow(build({ cashFlow: years({}) }))).toEqual({
            operatingCashFlow: null,
        });
    });

    it('returns null when there are no cash flow rows', () => {
        expect(mapCashFlow(build())).toBeNull();
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
