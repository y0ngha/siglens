import { describe, expect, it } from 'vitest';
import { FakeFinancialStatementsProvider } from '@/shared/api/fmp/FakeFinancialStatementsProvider';

describe('FakeFinancialStatementsProvider', () => {
    const fake = new FakeFinancialStatementsProvider();

    describe('getIncomeStatements', () => {
        it('returns exactly 2 fiscal years so tables render non-trivially', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            expect(rows).toHaveLength(2);
            expect(rows.map(r => r.fiscalYear)).toEqual(['2024', '2023']);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 1);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.fiscalYear).toBe('2024');
        });

        it('exposes deterministic IncomeStatementRow values with derived margins null', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            expect(rows[0]).toEqual({
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
                // Derived by core's normalizeFinancialsSnapshot — fixture leaves null.
                grossMargin: null,
                operatingMargin: null,
                netMargin: null,
            });
        });

        it('revenue grows year over year (most-recent first)', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            expect(rows[0]?.revenue).toBe(391_035_000_000);
            expect(rows[1]?.revenue).toBe(383_285_000_000);
            expect(rows[0]!.revenue!).toBeGreaterThan(rows[1]!.revenue!);
        });
    });

    describe('getBalanceSheets', () => {
        it('returns exactly 2 fiscal years', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 5);
            expect(rows).toHaveLength(2);
            expect(rows.map(r => r.fiscalYear)).toEqual(['2024', '2023']);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 1);
            expect(rows).toHaveLength(1);
        });

        it('exposes deterministic BalanceSheetRow values with currentRatio null', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 5);
            expect(rows[0]).toEqual({
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
                // Derived by core → fixture leaves null.
                currentRatio: null,
            });
        });
    });

    describe('getCashFlowStatements', () => {
        it('returns exactly 2 fiscal years', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 5);
            expect(rows).toHaveLength(2);
            expect(rows.map(r => r.fiscalYear)).toEqual(['2024', '2023']);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 1);
            expect(rows).toHaveLength(1);
        });

        it('exposes deterministic CashFlowRow values with fcfMargin null', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 5);
            expect(rows[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                date: '2024-09-28',
                operatingCashFlow: 118_254_000_000,
                capitalExpenditure: -9_447_000_000,
                freeCashFlow: 108_807_000_000,
                dividendsPaid: -15_234_000_000,
                // Derived by core → fixture leaves null.
                fcfMargin: null,
            });
        });
    });

    describe('getIncomeStatementGrowths', () => {
        it('returns exactly 2 rows', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(rows).toHaveLength(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                1
            );
            expect(rows).toHaveLength(1);
        });

        it('exposes deterministic IncomeGrowthRow values', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(rows[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                growthRevenue: 0.0201,
                growthNetIncome: -0.0337,
                growthEPS: -0.0033,
                growthOperatingIncome: 0.0779,
            });
        });
    });

    describe('getFinancialGrowths', () => {
        it('returns exactly 2 rows', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 5);
            expect(rows).toHaveLength(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 1);
            expect(rows).toHaveLength(1);
        });

        it('exposes deterministic FinancialGrowthRow values incl. epsGrowth', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 5);
            expect(rows[0]).toEqual({
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
            });
        });
    });

    describe('getCashFlowGrowths', () => {
        it('returns exactly 2 rows', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 5);
            expect(rows).toHaveLength(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 1);
            expect(rows).toHaveLength(1);
        });

        it('exposes deterministic CashFlowGrowthRow values', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 5);
            expect(rows[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                growthOperatingCashFlow: 0.0699,
                growthFreeCashFlow: 0.0927,
                growthCapitalExpenditure: 0.1382,
            });
        });
    });

    describe('determinism', () => {
        it('returns identical income rows regardless of symbol', async () => {
            const rowsAapl = await fake.getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            const rowsMsft = await fake.getIncomeStatements(
                'MSFT',
                'annual',
                5
            );
            expect(rowsAapl).toEqual(rowsMsft);
        });

        it('returns identical balance rows regardless of symbol', async () => {
            const rowsA = await fake.getBalanceSheets('AAPL', 'annual', 5);
            const rowsB = await fake.getBalanceSheets('TSLA', 'annual', 5);
            expect(rowsA).toEqual(rowsB);
        });
    });
});
