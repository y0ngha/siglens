import { describe, expect, it } from 'vitest';
import { FakeFinancialStatementsProvider } from '@/shared/api/fmp/FakeFinancialStatementsProvider';

describe('FakeFinancialStatementsProvider', () => {
    const fake = new FakeFinancialStatementsProvider();

    // ------------------------------------------------------------------ //
    // getIncomeStatements
    // ------------------------------------------------------------------ //

    describe('getIncomeStatements', () => {
        it('returns at least 2 rows so tables render non-trivially', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            expect(rows.length).toBeGreaterThanOrEqual(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 1);
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required IncomeStatementRow fields', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(typeof row.period).toBe('string');
            expect(typeof row.date).toBe('string');
            // numeric fields can be number or null
            expect(row.revenue == null || typeof row.revenue === 'number').toBe(
                true
            );
            expect(
                row.grossMargin === null || typeof row.grossMargin === 'number'
            ).toBe(true);
        });

        it('revenue grows year over year (deterministic fixture)', async () => {
            const rows = await fake.getIncomeStatements('AAPL', 'annual', 5);
            // Rows ordered most-recent first; revenue of older year < newer year
            const rev0 = rows[0]?.revenue ?? 0;
            const rev1 = rows[1]?.revenue ?? 0;
            // Revenue should generally be growing (newer > older)
            expect(rev0).toBeGreaterThan(rev1);
        });
    });

    // ------------------------------------------------------------------ //
    // getBalanceSheets
    // ------------------------------------------------------------------ //

    describe('getBalanceSheets', () => {
        it('returns at least 2 rows', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 5);
            expect(rows.length).toBeGreaterThanOrEqual(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 1);
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required BalanceSheetRow fields', async () => {
            const rows = await fake.getBalanceSheets('AAPL', 'annual', 5);
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(typeof row.period).toBe('string');
            expect(
                row.totalAssets == null || typeof row.totalAssets === 'number'
            ).toBe(true);
            // currentRatio is computed by core → stays null
            expect(row.currentRatio).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getCashFlowStatements
    // ------------------------------------------------------------------ //

    describe('getCashFlowStatements', () => {
        it('returns at least 2 rows', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 5);
            expect(rows.length).toBeGreaterThanOrEqual(2);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 1);
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required CashFlowRow fields', async () => {
            const rows = await fake.getCashFlowStatements('AAPL', 'annual', 5);
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(
                row.operatingCashFlow == null ||
                    typeof row.operatingCashFlow === 'number'
            ).toBe(true);
            // fcfMargin is computed by core → stays null
            expect(row.fcfMargin).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getIncomeStatementGrowths
    // ------------------------------------------------------------------ //

    describe('getIncomeStatementGrowths', () => {
        it('returns at least 1 row', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(rows.length).toBeGreaterThanOrEqual(1);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                1
            );
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required IncomeGrowthRow fields', async () => {
            const rows = await fake.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(
                row.growthRevenue == null ||
                    typeof row.growthRevenue === 'number'
            ).toBe(true);
            expect(
                row.growthNetIncome == null ||
                    typeof row.growthNetIncome === 'number'
            ).toBe(true);
        });
    });

    // ------------------------------------------------------------------ //
    // getFinancialGrowths
    // ------------------------------------------------------------------ //

    describe('getFinancialGrowths', () => {
        it('returns at least 1 row', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 5);
            expect(rows.length).toBeGreaterThanOrEqual(1);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 1);
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required FinancialGrowthRow fields', async () => {
            const rows = await fake.getFinancialGrowths('AAPL', 'annual', 5);
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(
                row.revenueGrowth == null ||
                    typeof row.revenueGrowth === 'number'
            ).toBe(true);
            expect(
                row.epsGrowth == null || typeof row.epsGrowth === 'number'
            ).toBe(true);
        });
    });

    // ------------------------------------------------------------------ //
    // getCashFlowGrowths
    // ------------------------------------------------------------------ //

    describe('getCashFlowGrowths', () => {
        it('returns at least 1 row', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 5);
            expect(rows.length).toBeGreaterThanOrEqual(1);
        });

        it('respects the limit parameter', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 1);
            expect(rows.length).toBeLessThanOrEqual(1);
        });

        it('rows have required CashFlowGrowthRow fields', async () => {
            const rows = await fake.getCashFlowGrowths('AAPL', 'annual', 5);
            const row = rows[0]!;
            expect(typeof row.fiscalYear).toBe('string');
            expect(
                row.growthOperatingCashFlow == null ||
                    typeof row.growthOperatingCashFlow === 'number'
            ).toBe(true);
            expect(
                row.growthFreeCashFlow == null ||
                    typeof row.growthFreeCashFlow === 'number'
            ).toBe(true);
        });
    });

    // ------------------------------------------------------------------ //
    // Determinism — same output regardless of symbol (E2E fixture)
    // ------------------------------------------------------------------ //

    describe('determinism', () => {
        it('returns identical rows regardless of symbol', async () => {
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

        it('returns identical rows regardless of symbol for balanceSheets', async () => {
            const rowsA = await fake.getBalanceSheets('AAPL', 'annual', 5);
            const rowsB = await fake.getBalanceSheets('TSLA', 'annual', 5);
            expect(rowsA).toEqual(rowsB);
        });
    });
});
