import { describe, expect, it } from 'vitest';
import {
    buildFundamentalFacts,
    isFundamentalIndexable,
} from '../lib/buildFundamentalFacts';
import type {
    FundamentalFact,
    FundamentalFactsInput,
    FundamentalFactsScorecard,
} from '../model';

const TODAY = '2026-11-07';

function scorecard(
    overrides: Partial<{
        dilution: FundamentalFactsScorecard['dilution']['metrics'];
        insider: FundamentalFactsScorecard['insider']['metrics'];
        kr: FundamentalFactsScorecard['insider']['krMetrics'];
        pctFloat: number | null;
        daysToCover: number | null;
    }> = {}
): FundamentalFactsScorecard {
    return {
        dilution: { metrics: overrides.dilution ?? null },
        insider: {
            metrics: overrides.insider ?? null,
            ...(overrides.kr ? { krMetrics: overrides.kr } : {}),
        },
        short: {
            metrics: {
                shortInterestPctFloat: overrides.pctFloat ?? null,
                daysToCover: overrides.daysToCover ?? null,
            },
        },
        freshness: {
            dilutionWindow: { from: null, to: null, days: 180 },
            insiderWindow: { from: null, to: null, days: 90 },
            shortInterestSettlementDate: '2026-10-15',
        },
    };
}

function input(
    overrides: Partial<FundamentalFactsInput> = {}
): FundamentalFactsInput {
    return {
        today: TODAY,
        annual: null,
        scorecard: null,
        priceTargetConsensus: null,
        priceTargetSummary: null,
        grades: null,
        earnings: null,
        nextEarningsDate: null,
        ...overrides,
    };
}

const kinds = (facts: readonly FundamentalFact[]) => facts.map(f => f.kind);

describe('buildFundamentalFacts', () => {
    it('입력이 모두 비면 사실이 없다', () => {
        expect(buildFundamentalFacts(input())).toEqual([]);
    });

    describe('cashRunway', () => {
        it('영업현금흐름이 적자면 현금 ÷ 연간 적자로 기간을 낸다', () => {
            const facts = buildFundamentalFacts(
                input({
                    annual: {
                        date: '2025-12-31',
                        cashAndShortTermInvestments: 482,
                        operatingCashFlow: -43,
                        netIncome: -1,
                        reportedCurrency: 'USD',
                    },
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'cashRunway',
                    cash: 482,
                    annualBurn: 43,
                    years: 482 / 43,
                    reportedCurrency: 'USD',
                    asOf: '2025-12-31',
                },
            ]);
        });

        it.each([0, 120])('영업현금흐름 %d(적자 아님)이면 내지 않는다', ocf => {
            const facts = buildFundamentalFacts(
                input({
                    annual: {
                        date: '2025-12-31',
                        cashAndShortTermInvestments: 100,
                        operatingCashFlow: ocf,
                        netIncome: -1,
                        reportedCurrency: null,
                    },
                })
            );
            expect(facts).toEqual([]);
        });
    });

    it('영업현금흐름이 적자여도 순이익이 흑자(은행 등)면 내지 않는다', () => {
        const facts = buildFundamentalFacts(
            input({
                annual: {
                    date: '2025-12-31',
                    cashAndShortTermInvestments: 100,
                    operatingCashFlow: -10,
                    netIncome: 50,
                    reportedCurrency: null,
                },
            })
        );
        expect(facts).toEqual([]);
    });

    describe('dilutionFilings', () => {
        it('180일 안 공시가 1건 이상이면 낸다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        dilution: {
                            filingsInWindow: 2,
                            atmFilings: 1,
                            shelfFilings: 1,
                            latestFilingDate: '2026-10-01',
                        },
                    }),
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'dilutionFilings',
                    filings: 2,
                    atmFilings: 1,
                    shelfFilings: 1,
                    windowDays: 180,
                    latestFilingDate: '2026-10-01',
                },
            ]);
        });

        it('공시 0건이면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        dilution: {
                            filingsInWindow: 0,
                            atmFilings: 0,
                            shelfFilings: 0,
                            latestFilingDate: null,
                        },
                    }),
                })
            );
            expect(facts).toEqual([]);
        });
    });

    describe('insider', () => {
        it('미국 종목은 매수·매도 건수와 금액을 낸다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        insider: {
                            buyCount: 0,
                            sellCount: 3,
                            buyValueUsd: 0,
                            sellValueUsd: 170_294,
                        },
                    }),
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'insiderTrades',
                    buyCount: 0,
                    sellCount: 3,
                    buyValueUsd: 0,
                    sellValueUsd: 170_294,
                    windowDays: 90,
                },
            ]);
        });

        it('거래 0건이면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        insider: {
                            buyCount: 0,
                            sellCount: 0,
                            buyValueUsd: 0,
                            sellValueUsd: 0,
                        },
                    }),
                })
            );
            expect(facts).toEqual([]);
        });

        it('한국 종목은 DART 보고 건수를 낸다(미국 지표보다 우선)', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        insider: {
                            buyCount: 5,
                            sellCount: 5,
                            buyValueUsd: 1,
                            sellValueUsd: 1,
                        },
                        kr: {
                            reports: 4,
                            reporters: 2,
                            netSharesChange: -1200,
                            latestReceiptDate: '2026-10-30',
                        },
                    }),
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'insiderReportsKr',
                    reports: 4,
                    reporters: 2,
                    netSharesChange: -1200,
                    latestReceiptDate: '2026-10-30',
                },
            ]);
        });

        it('한국 종목 보고 0건이면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({
                        kr: {
                            reports: 0,
                            reporters: 0,
                            netSharesChange: 0,
                            latestReceiptDate: null,
                        },
                    }),
                })
            );
            expect(facts).toEqual([]);
        });
    });

    describe('shortInterest', () => {
        it.each([
            [5, null],
            [null, 5],
        ])(
            '유통주식 대비 %s% 또는 상환일수 %s일이면 경계에서 낸다',
            (pct, dtc) => {
                const facts = buildFundamentalFacts(
                    input({
                        scorecard: scorecard({
                            pctFloat: pct,
                            daysToCover: dtc,
                        }),
                    })
                );
                expect(kinds(facts)).toEqual(['shortInterest']);
            }
        );

        it('둘 다 기준 미만이면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    scorecard: scorecard({ pctFloat: 4.9, daysToCover: 4.9 }),
                })
            );
            expect(facts).toEqual([]);
        });
    });

    describe('priceTarget', () => {
        it('컨센서스와 의견 수를 합쳐 낸다', () => {
            const facts = buildFundamentalFacts(
                input({
                    priceTargetConsensus: {
                        targetConsensus: 5.875,
                        targetHigh: 8,
                        targetLow: 3.75,
                        targetMedian: 5.875,
                    },
                    priceTargetSummary: {
                        lastMonth: { avgPriceTarget: null },
                        lastQuarter: { avgPriceTarget: 6 },
                        lastYear: { avgPriceTarget: 6 },
                    },
                    grades: {
                        strongBuy: 1,
                        buy: 1,
                        hold: 2,
                        sell: 0,
                        strongSell: 1,
                    },
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'priceTarget',
                    consensus: 5.875,
                    low: 3.75,
                    high: 8,
                    buy: 2,
                    hold: 2,
                    sell: 1,
                    stale: false,
                },
            ]);
        });

        it('최근 3개월 목표가가 없고 1년 안 목표가만 있으면 stale', () => {
            const [fact] = buildFundamentalFacts(
                input({
                    priceTargetConsensus: {
                        targetConsensus: 10,
                        targetHigh: null,
                        targetLow: null,
                        targetMedian: null,
                    },
                    priceTargetSummary: {
                        lastMonth: { avgPriceTarget: null },
                        lastQuarter: { avgPriceTarget: null },
                        lastYear: { avgPriceTarget: 9 },
                    },
                })
            );
            expect(fact).toMatchObject({ kind: 'priceTarget', stale: true });
        });

        it('컨센서스가 없으면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    priceTargetConsensus: {
                        targetConsensus: null,
                        targetHigh: null,
                        targetLow: null,
                        targetMedian: null,
                    },
                })
            );
            expect(facts).toEqual([]);
        });
    });

    describe('earnings', () => {
        const row = (
            earningsDate: string,
            epsActual: number | null,
            epsEstimated: number | null
        ) => ({ earningsDate, epsActual, epsEstimated });

        it('최근부터 연속 하회 횟수를 센다(정렬 무관, 다른 방향에서 멈춤)', () => {
            const facts = buildFundamentalFacts(
                input({
                    earnings: [
                        row('2025-09-11', 0.2, 0.1),
                        row('2026-09-11', -0.13, -0.1),
                        row('2026-03-31', -0.2, -0.1),
                    ],
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'epsStreak',
                    direction: 'miss',
                    count: 2,
                    latestDate: '2026-09-11',
                },
            ]);
        });

        it('예상치가 없는 분기에서 연속이 끊긴다(그 분기를 건너뛰어 잇지 않는다)', () => {
            const facts = buildFundamentalFacts(
                input({
                    earnings: [
                        row('2026-09-11', 1, 0.5),
                        row('2026-06-11', 0.8, null),
                        row('2026-03-11', 0.9, 0.5),
                    ],
                })
            );
            expect(facts).toEqual([]);
        });

        it('연속 1회면 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({
                    earnings: [
                        row('2026-09-11', 1, 0.5),
                        row('2026-06-11', 0.4, 0.5),
                    ],
                })
            );
            expect(facts).toEqual([]);
        });

        it('60일 안 다음 실적은 D-n과 직전 서프라이즈를 낸다', () => {
            const facts = buildFundamentalFacts(
                input({
                    nextEarningsDate: '2026-12-20',
                    earnings: [row('2026-09-11', 1.1, 1)],
                })
            );
            expect(facts).toHaveLength(1);
            expect(facts[0]).toMatchObject({
                kind: 'nextEarnings',
                date: '2026-12-20',
                daysUntil: 43,
                lastDate: '2026-09-11',
            });
            const fact = facts[0];
            if (fact?.kind !== 'nextEarnings') throw new Error('kind');
            expect(fact.lastSurprisePct).toBeCloseTo(10, 6);
        });

        it('100일 안이면 내고 101일 뒤면 내지 않는다(한 분기를 덮는 창)', () => {
            expect(
                kinds(
                    buildFundamentalFacts(
                        input({ nextEarningsDate: '2027-02-15', earnings: [] })
                    )
                )
            ).toEqual(['nextEarnings']);
            const facts = buildFundamentalFacts(
                input({ nextEarningsDate: '2027-02-16', earnings: [] })
            );
            expect(facts).toEqual([]);
        });

        it('오늘이거나 지난 예정일은 내지 않는다', () => {
            const facts = buildFundamentalFacts(
                input({ nextEarningsDate: TODAY, earnings: [] })
            );
            expect(facts).toEqual([]);
        });

        it('예상치 0이면 서프라이즈는 null', () => {
            const facts = buildFundamentalFacts(
                input({
                    nextEarningsDate: '2026-11-20',
                    earnings: [row('2026-08-20', 0.1, 0)],
                })
            );
            expect(facts).toEqual([
                {
                    kind: 'nextEarnings',
                    date: '2026-11-20',
                    daysUntil: 13,
                    lastSurprisePct: null,
                    lastDate: '2026-08-20',
                },
            ]);
        });
    });

    it('순서는 현금 → 증자 → 내부자 → 공매도 → 목표가 → EPS → 다음 실적', () => {
        const facts = buildFundamentalFacts(
            input({
                annual: {
                    date: '2025-12-31',
                    cashAndShortTermInvestments: 10,
                    operatingCashFlow: -5,
                    netIncome: -1,
                    reportedCurrency: null,
                },
                scorecard: scorecard({
                    dilution: {
                        filingsInWindow: 1,
                        atmFilings: 1,
                        shelfFilings: 0,
                        latestFilingDate: null,
                    },
                    insider: {
                        buyCount: 1,
                        sellCount: 0,
                        buyValueUsd: 1,
                        sellValueUsd: 0,
                    },
                    pctFloat: 12,
                }),
                priceTargetConsensus: {
                    targetConsensus: 3,
                    targetHigh: null,
                    targetLow: null,
                    targetMedian: null,
                },
                nextEarningsDate: '2026-11-30',
                earnings: [
                    {
                        earningsDate: '2026-08-01',
                        epsActual: 2,
                        epsEstimated: 1,
                    },
                    {
                        earningsDate: '2026-05-01',
                        epsActual: 2,
                        epsEstimated: 1,
                    },
                ],
            })
        );
        expect(kinds(facts)).toEqual([
            'cashRunway',
            'dilutionFilings',
            'insiderTrades',
            'shortInterest',
            'priceTarget',
            'epsStreak',
            'nextEarnings',
        ]);
    });
});

describe('isFundamentalIndexable', () => {
    const fact: FundamentalFact = {
        kind: 'epsStreak',
        direction: 'beat',
        count: 2,
        latestDate: TODAY,
    };
    it('사실 3개부터 색인한다', () => {
        expect(isFundamentalIndexable([fact, fact])).toBe(false);
        expect(isFundamentalIndexable([fact, fact, fact])).toBe(true);
    });
});
