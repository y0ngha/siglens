import type {
    BalanceSheetRow,
    CashFlowGrowthRow,
    CashFlowRow,
    FinancialGrowthRow,
    FinancialStatementsProvider,
    IncomeGrowthRow,
    IncomeStatementRow,
    StatementPeriod,
} from '@y0ngha/siglens-core';

/**
 * E2E-only `FinancialStatementsProvider` returning deterministic, non-throwing
 * fixture data instead of calling FMP. Reached only when E2E_TEST=1 (see
 * getFinancialStatementsProvider). Reads NO env keys and performs NO network I/O.
 *
 * Unlike `FakeFundamentalDataProvider` which returns minimal null/[] (the
 * fundamental page headings are the main E2E target), this fake returns real rows
 * so that the financials scorecard and statement tables render non-trivially —
 * E2E tests can assert on rendered revenue/EPS values and year-over-year rows.
 *
 * Numbers are Apple-like in scale but fully synthetic. Rows are ordered
 * most-recent-first (same as FMP). `limit` is respected via `.slice(0, limit)`.
 *
 * Derived fields computed by core (grossMargin, currentRatio, fcfMargin) are
 * kept null — same contract as `FmpFinancialStatementsClient`.
 */
export class FakeFinancialStatementsProvider implements FinancialStatementsProvider {
    // Fixture data — two full fiscal years per series, most recent first.
    private static readonly INCOME_FIXTURES: IncomeStatementRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            date: '2024-09-28',
            revenue: 391_035_000_000,
            grossProfit: 170_782_000_000,
            operatingIncome: 123_216_000_000,
            netIncome: 93_736_000_000,
            ebitda: 134_000_000_000,
            eps: 6.11,
            epsDiluted: 6.08,
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            date: '2023-09-30',
            revenue: 383_285_000_000,
            grossProfit: 169_148_000_000,
            operatingIncome: 114_301_000_000,
            netIncome: 96_995_000_000,
            ebitda: 125_820_000_000,
            eps: 6.13,
            epsDiluted: 6.08,
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
        },
    ];

    private static readonly BALANCE_FIXTURES: BalanceSheetRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            date: '2024-09-28',
            totalAssets: 364_980_000_000,
            totalCurrentAssets: 152_987_000_000,
            totalLiabilities: 308_030_000_000,
            totalCurrentLiabilities: 176_392_000_000,
            cashAndShortTermInvestments: 65_171_000_000,
            totalDebt: 101_304_000_000,
            netDebt: 47_476_000_000,
            totalStockholdersEquity: 56_950_000_000,
            currentRatio: null,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            date: '2023-09-30',
            totalAssets: 352_583_000_000,
            totalCurrentAssets: 143_566_000_000,
            totalLiabilities: 290_437_000_000,
            totalCurrentLiabilities: 145_308_000_000,
            cashAndShortTermInvestments: 61_555_000_000,
            totalDebt: 109_615_000_000,
            netDebt: 81_123_000_000,
            totalStockholdersEquity: 62_146_000_000,
            currentRatio: null,
        },
    ];

    private static readonly CASH_FLOW_FIXTURES: CashFlowRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            date: '2024-09-28',
            operatingCashFlow: 118_254_000_000,
            capitalExpenditure: -9_447_000_000,
            freeCashFlow: 108_807_000_000,
            dividendsPaid: -15_234_000_000,
            fcfMargin: null,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            date: '2023-09-30',
            operatingCashFlow: 110_543_000_000,
            capitalExpenditure: -10_959_000_000,
            freeCashFlow: 99_584_000_000,
            dividendsPaid: -14_996_000_000,
            fcfMargin: null,
        },
    ];

    private static readonly INCOME_GROWTH_FIXTURES: IncomeGrowthRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            growthRevenue: 0.0201,
            growthNetIncome: -0.0337,
            growthEPS: -0.0033,
            growthOperatingIncome: 0.0779,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            growthRevenue: -0.0273,
            growthNetIncome: -0.0293,
            growthEPS: -0.0044,
            growthOperatingIncome: -0.0392,
        },
    ];

    private static readonly FINANCIAL_GROWTH_FIXTURES: FinancialGrowthRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            revenueGrowth: 0.0201,
            netIncomeGrowth: -0.0337,
            epsGrowth: -0.0033,
            freeCashFlowGrowth: 0.0927,
            operatingCashFlowGrowth: 0.0699,
            assetGrowth: 0.0352,
            debtGrowth: -0.076,
            threeYRevenueGrowthPerShare: 0.073,
            fiveYRevenueGrowthPerShare: 0.098,
            tenYRevenueGrowthPerShare: 0.121,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            revenueGrowth: -0.0273,
            netIncomeGrowth: -0.0293,
            epsGrowth: -0.0044,
            freeCashFlowGrowth: 0.0124,
            operatingCashFlowGrowth: -0.0085,
            assetGrowth: -0.0019,
            debtGrowth: 0.002,
            threeYRevenueGrowthPerShare: 0.083,
            fiveYRevenueGrowthPerShare: 0.102,
            tenYRevenueGrowthPerShare: 0.116,
        },
    ];

    private static readonly CASH_FLOW_GROWTH_FIXTURES: CashFlowGrowthRow[] = [
        {
            fiscalYear: '2024',
            period: 'FY',
            growthOperatingCashFlow: 0.0699,
            growthFreeCashFlow: 0.0927,
            growthCapitalExpenditure: 0.1382,
        },
        {
            fiscalYear: '2023',
            period: 'FY',
            growthOperatingCashFlow: -0.0085,
            growthFreeCashFlow: 0.0124,
            growthCapitalExpenditure: -0.0991,
        },
    ];

    async getIncomeStatements(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<IncomeStatementRow[]> {
        return FakeFinancialStatementsProvider.INCOME_FIXTURES.slice(0, limit);
    }

    async getBalanceSheets(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<BalanceSheetRow[]> {
        return FakeFinancialStatementsProvider.BALANCE_FIXTURES.slice(0, limit);
    }

    async getCashFlowStatements(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<CashFlowRow[]> {
        return FakeFinancialStatementsProvider.CASH_FLOW_FIXTURES.slice(
            0,
            limit
        );
    }

    async getIncomeStatementGrowths(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<IncomeGrowthRow[]> {
        return FakeFinancialStatementsProvider.INCOME_GROWTH_FIXTURES.slice(
            0,
            limit
        );
    }

    async getFinancialGrowths(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<FinancialGrowthRow[]> {
        return FakeFinancialStatementsProvider.FINANCIAL_GROWTH_FIXTURES.slice(
            0,
            limit
        );
    }

    async getCashFlowGrowths(
        _symbol: string,
        _period: StatementPeriod,
        limit: number
    ): Promise<CashFlowGrowthRow[]> {
        return FakeFinancialStatementsProvider.CASH_FLOW_GROWTH_FIXTURES.slice(
            0,
            limit
        );
    }
}
