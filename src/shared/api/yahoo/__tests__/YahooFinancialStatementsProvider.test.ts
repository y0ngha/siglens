import { describe, it, expect, vi, beforeEach } from 'vitest';

const getYahooStatements = vi.fn();

vi.mock('../yahooStatementsSource', () => ({
    getYahooStatements: (...args: unknown[]) => getYahooStatements(...args),
}));

const { YahooFinancialStatementsProvider } =
    await import('../YahooFinancialStatementsProvider');

const provider = new YahooFinancialStatementsProvider();

/** yahoo 원본은 오래된 순이지만 소스가 뒤집어 최신순으로 넘긴다. */
function annual(year: number, extra: Record<string, unknown> = {}) {
    return { date: new Date(`${year}-12-31T00:00:00Z`), ...extra };
}

function quarter(iso: string, extra: Record<string, unknown> = {}) {
    return { date: new Date(`${iso}T00:00:00Z`), ...extra };
}

function statements(over: Record<string, unknown[]> = {}) {
    return { income: [], balance: [], cashFlow: [], ...over };
}

beforeEach(() => getYahooStatements.mockReset());

describe('getIncomeStatements', () => {
    it('maps a row and derives the margins yahoo does not provide', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    annual(2025, {
                        totalRevenue: 333_605_938_000_000,
                        grossProfit: 131_370_425_000_000,
                        operatingIncome: 43_601_051_000_000,
                        netIncome: 44_260_956_000_000,
                        EBITDA: 97_013_846_000_000,
                        basicEPS: 6605,
                        dilutedEPS: 6603,
                    }),
                ],
            })
        );

        const rows = await provider.getIncomeStatements(
            '005930.KS',
            'annual',
            5
        );
        // 파생값(마진)만 단언하면 통과 경로의 필드명은 아무거나여도 통과한다 —
        // yahoo 이름과 도메인 이름이 다른 항목(`EBITDA`)이 특히 그렇다. 픽스처 값이
        // 서로 다르므로 전 항목을 한 번에 고정한다.
        expect(rows[0]).toMatchObject({
            fiscalYear: '2025',
            period: 'FY',
            date: '2025-12-31',
            revenue: 333_605_938_000_000,
            grossProfit: 131_370_425_000_000,
            operatingIncome: 43_601_051_000_000,
            netIncome: 44_260_956_000_000,
            ebitda: 97_013_846_000_000,
            eps: 6605,
            epsDiluted: 6603,
        });
        expect(rows[0]!.grossMargin).toBeCloseTo(39.379, 2);
        expect(rows[0]!.operatingMargin).toBeCloseTo(13.07, 2);
        expect(rows[0]!.netMargin).toBeCloseTo(13.267, 2);
    });

    it('returns null margins when revenue is zero or missing', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [annual(2025, { grossProfit: 10, totalRevenue: 0 })],
            })
        );

        const rows = await provider.getIncomeStatements(
            '005930.KS',
            'annual',
            5
        );
        expect(rows[0]!.grossMargin).toBeNull();
    });

    it('labels quarters from the fiscal month', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    quarter('2026-03-31'),
                    quarter('2025-12-31'),
                    quarter('2025-09-30'),
                    quarter('2025-06-30'),
                ],
            })
        );

        const rows = await provider.getIncomeStatements(
            '005930.KS',
            'quarter',
            4
        );
        expect(rows.map(r => `${r.fiscalYear}/${r.period}`)).toEqual([
            '2026/Q1',
            '2025/Q4',
            '2025/Q3',
            '2025/Q2',
        ]);
    });

    it('honours the limit', async () => {
        getYahooStatements.mockResolvedValue(
            statements({ income: [annual(2025), annual(2024), annual(2023)] })
        );

        expect(
            await provider.getIncomeStatements('005930.KS', 'annual', 2)
        ).toHaveLength(2);
    });

    it('forwards the requested period to the source', async () => {
        getYahooStatements.mockResolvedValue(statements());

        await provider.getIncomeStatements('005930.KS', 'quarter', 4);

        expect(getYahooStatements).toHaveBeenCalledWith('005930.KS', 'quarter');
    });
});

describe('getBalanceSheets', () => {
    const row = annual(2025, {
        totalAssets: 566_942_110_000_000,
        currentAssets: 247_684_612_000_000,
        totalLiabilitiesNetMinorityInterest: 130_621_773_000_000,
        currentLiabilities: 106_411_348_000_000,
        cashCashEquivalentsAndShortTermInvestments: 125_847_114_000_000,
        totalDebt: 25_239_139_000_000,
        stockholdersEquity: 424_313_255_000_000,
    });

    /**
     * [회귀] 이 블록은 파생값(`netDebt`/`currentRatio`)만 단언하고 통과 매핑 7개를
     * 하나도 고정하지 않고 있었다 — 감사 라운드 11에서 7개 필드를 서로 바꿔 끼우는
     * 뮤테이션 8건이 전부 살아남았다.
     *
     * 가장 위험한 건 `totalLiabilities`다. yahoo 쪽 이름이
     * `totalLiabilitiesNetMinorityInterest`라 도메인 이름과 닮지 않았는데, 같은
     * 픽스처 행에 그럴싸한 오답(`totalDebt`)이 나란히 있다. 바꿔 껴도 값이 나오므로
     * 눈에 띄지 않지만, core 스코어카드가 `totalLiabilities / totalAssets`로
     * debtRatio를 매기므로 삼성전자 기준 0.230이 0.044로 바뀐다.
     */
    it('yahoo 필드명을 도메인 필드에 정확히 매핑한다', async () => {
        getYahooStatements.mockResolvedValue(statements({ balance: [row] }));

        const [sheet] = await provider.getBalanceSheets(
            '005930.KS',
            'annual',
            1
        );

        expect(sheet).toMatchObject({
            fiscalYear: '2025',
            period: 'FY',
            date: '2025-12-31',
            totalAssets: 566_942_110_000_000,
            totalCurrentAssets: 247_684_612_000_000,
            totalLiabilities: 130_621_773_000_000,
            totalCurrentLiabilities: 106_411_348_000_000,
            cashAndShortTermInvestments: 125_847_114_000_000,
            totalDebt: 25_239_139_000_000,
            totalStockholdersEquity: 424_313_255_000_000,
        });
    });

    it('computes netDebt because yahoo always leaves it empty', async () => {
        getYahooStatements.mockResolvedValue(statements({ balance: [row] }));

        const [sheet] = await provider.getBalanceSheets(
            '005930.KS',
            'annual',
            1
        );
        // 25.2조 부채 − 125.8조 현금 = 순현금 상태(음수).
        expect(sheet!.netDebt).toBe(25_239_139_000_000 - 125_847_114_000_000);
        expect(sheet!.netDebt).toBeLessThan(0);
    });

    it('computes the current ratio', async () => {
        getYahooStatements.mockResolvedValue(statements({ balance: [row] }));

        const [sheet] = await provider.getBalanceSheets(
            '005930.KS',
            'annual',
            1
        );
        expect(sheet!.currentRatio).toBeCloseTo(2.328, 3);
    });

    it('returns null netDebt/currentRatio when inputs are missing', async () => {
        getYahooStatements.mockResolvedValue(
            statements({ balance: [annual(2025)] })
        );

        const [sheet] = await provider.getBalanceSheets(
            '005930.KS',
            'annual',
            1
        );
        expect(sheet!.netDebt).toBeNull();
        expect(sheet!.currentRatio).toBeNull();
    });

    it('returns null currentRatio when current liabilities are zero', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                balance: [
                    annual(2025, { currentAssets: 10, currentLiabilities: 0 }),
                ],
            })
        );

        const [sheet] = await provider.getBalanceSheets(
            '005930.KS',
            'annual',
            1
        );
        expect(sheet!.currentRatio).toBeNull();
    });
});

describe('getCashFlowStatements', () => {
    it('maps the cash flow row and defers fcfMargin to normalization', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                cashFlow: [
                    annual(2025, {
                        operatingCashFlow: 85_315_148_000_000,
                        capitalExpenditure: -52_153_149_000_000,
                        freeCashFlow: 33_161_999_000_000,
                        cashDividendsPaid: -9_897_183_000_000,
                    }),
                ],
            })
        );

        const [row] = await provider.getCashFlowStatements(
            '005930.KS',
            'annual',
            1
        );
        expect(row).toMatchObject({
            operatingCashFlow: 85_315_148_000_000,
            capitalExpenditure: -52_153_149_000_000,
            freeCashFlow: 33_161_999_000_000,
            dividendsPaid: -9_897_183_000_000,
            // 매출이 있어야 계산되므로 스냅샷 정규화 단계에서 채워진다.
            fcfMargin: null,
        });
    });
});

describe('growth rows — YoY offset', () => {
    it('compares annual rows against the immediately prior year', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    annual(2025, { totalRevenue: 110, basicEPS: 20 }),
                    annual(2024, { totalRevenue: 100, basicEPS: 10 }),
                ],
            })
        );

        const [row] = await provider.getIncomeStatementGrowths(
            '005930.KS',
            'annual',
            5
        );
        expect(row!.growthRevenue).toBeCloseTo(0.1, 5);
        expect(row!.growthEPS).toBeCloseTo(1, 5);
    });

    it('compares quarters against the same quarter last year, not the prior quarter', async () => {
        // 인접 분기와 비교하면 계절성이 성장률로 둔갑한다 — 반도체 업종에서 특히 왜곡.
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    quarter('2026-03-31', { totalRevenue: 200 }),
                    quarter('2025-12-31', { totalRevenue: 999 }),
                    quarter('2025-09-30', { totalRevenue: 999 }),
                    quarter('2025-06-30', { totalRevenue: 999 }),
                    quarter('2025-03-31', { totalRevenue: 100 }),
                ],
            })
        );

        const rows = await provider.getIncomeStatementGrowths(
            '005930.KS',
            'quarter',
            5
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]!.fiscalYear).toBe('2026');
        expect(rows[0]!.period).toBe('Q1');
        // 200 vs 전년 동기 100 → +100%. 직전 분기(999)와 비교했다면 음수가 나온다.
        expect(rows[0]!.growthRevenue).toBeCloseTo(1, 5);
    });

    it('omits the oldest rows that have no prior-year counterpart', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [annual(2025, { totalRevenue: 110 })],
            })
        );

        expect(
            await provider.getIncomeStatementGrowths('005930.KS', 'annual', 5)
        ).toEqual([]);
    });
});

describe('getFinancialGrowths', () => {
    it('aligns balance/cash-flow rows by statement date, not array index', async () => {
        // 제표별 행 수가 다를 수 있어 인덱스를 공유하면 다른 기간을 비교하게 된다.
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    annual(2025, { totalRevenue: 110, netIncome: 22 }),
                    annual(2024, { totalRevenue: 100, netIncome: 11 }),
                ],
                // balance에는 2023이 하나 더 있어 인덱스가 어긋난다.
                balance: [
                    annual(2025, { totalAssets: 220, totalDebt: 20 }),
                    annual(2024, { totalAssets: 200, totalDebt: 10 }),
                    annual(2023, { totalAssets: 1, totalDebt: 1 }),
                ],
                cashFlow: [
                    annual(2025, {
                        freeCashFlow: 60,
                        operatingCashFlow: 120,
                    }),
                    annual(2024, {
                        freeCashFlow: 30,
                        operatingCashFlow: 100,
                    }),
                ],
            })
        );

        const [row] = await provider.getFinancialGrowths(
            '005930.KS',
            'annual',
            5
        );
        expect(row!.assetGrowth).toBeCloseTo(0.1, 5);
        expect(row!.debtGrowth).toBeCloseTo(1, 5);
        expect(row!.freeCashFlowGrowth).toBeCloseTo(1, 5);
        expect(row!.operatingCashFlowGrowth).toBeCloseTo(0.2, 5);
    });

    it('leaves multi-year per-share growth null — past share counts are unreliable', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    annual(2025, { totalRevenue: 110 }),
                    annual(2024, { totalRevenue: 100 }),
                ],
            })
        );

        const [row] = await provider.getFinancialGrowths(
            '005930.KS',
            'annual',
            5
        );
        expect(row).toMatchObject({
            threeYRevenueGrowthPerShare: null,
            fiveYRevenueGrowthPerShare: null,
            tenYRevenueGrowthPerShare: null,
        });
    });

    it('returns null growth for statements missing the matching date', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                income: [
                    annual(2025, { totalRevenue: 110 }),
                    annual(2024, { totalRevenue: 100 }),
                ],
                balance: [],
            })
        );

        const [row] = await provider.getFinancialGrowths(
            '005930.KS',
            'annual',
            5
        );
        expect(row!.assetGrowth).toBeNull();
    });
});

describe('getCashFlowGrowths', () => {
    it('computes YoY growth for the three cash flow lines', async () => {
        getYahooStatements.mockResolvedValue(
            statements({
                cashFlow: [
                    annual(2025, {
                        operatingCashFlow: 120,
                        freeCashFlow: 60,
                        capitalExpenditure: -60,
                    }),
                    annual(2024, {
                        operatingCashFlow: 100,
                        freeCashFlow: 30,
                        capitalExpenditure: -50,
                    }),
                ],
            })
        );

        const [row] = await provider.getCashFlowGrowths(
            '005930.KS',
            'annual',
            5
        );
        expect(row!.growthOperatingCashFlow).toBeCloseTo(0.2, 5);
        expect(row!.growthFreeCashFlow).toBeCloseTo(1, 5);
        // capex는 음수 값이다(-50 → -60). 다른 성장률 필드와 **같은 산식**을 적용하므로
        // 부호 있는 값의 증감인 -20%가 된다 — "설비투자를 20% 더 썼다"는 직관과 반대지만,
        // 미국 종목이 쓰는 FMP `cash-flow-statement-growth`도 같은 규약이라 여기서만
        // 부호를 뒤집으면 한 화면에서 두 시장의 의미가 달라진다.
        expect(row!.growthCapitalExpenditure).toBeCloseTo(-0.2, 5);
    });
});

describe('empty source', () => {
    it('returns empty arrays for every method', async () => {
        getYahooStatements.mockResolvedValue(statements());

        const results = await Promise.all([
            provider.getIncomeStatements('X', 'annual', 5),
            provider.getBalanceSheets('X', 'annual', 5),
            provider.getCashFlowStatements('X', 'annual', 5),
            provider.getIncomeStatementGrowths('X', 'annual', 5),
            provider.getFinancialGrowths('X', 'annual', 5),
            provider.getCashFlowGrowths('X', 'annual', 5),
        ]);

        expect(results.every(r => r.length === 0)).toBe(true);
    });
});
