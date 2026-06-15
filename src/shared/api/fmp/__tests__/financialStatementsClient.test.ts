vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { FmpFinancialStatementsClient } from '../financialStatementsClient';
import { FMP_STATEMENTS_REVALIDATE_SECONDS } from '@/shared/config/time';

const mockFetch = vi.fn();

const TEST_API_KEY = 'test-api-key';

describe('FmpFinancialStatementsClient', () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.FMP_API_KEY;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = TEST_API_KEY;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.FMP_API_KEY = originalEnv;
    });

    /** Helper — resolve fetch with a JSON array. */
    function mockOk(body: unknown): void {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => body,
        });
    }

    /** Helper — resolve fetch with a non-2xx status. */
    function mockError(status: number): void {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status,
            headers: new Headers(),
        });
    }

    // ------------------------------------------------------------------ //
    // getIncomeStatements
    // ------------------------------------------------------------------ //

    describe('getIncomeStatements', () => {
        it('maps raw fields to IncomeStatementRow correctly', async () => {
            mockOk([
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
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
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
            });
        });

        it('passes endpoint, symbol, period, and limit query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getIncomeStatements('AAPL', 'annual', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('income-statement');
            expect(url).toContain('symbol=AAPL');
            expect(url).toContain('period=annual');
            expect(url).toContain('limit=5');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(await client.getIncomeStatements('X', 'annual', 5)).toEqual(
                []
            );
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY', date: '2024-09-28' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.revenue).toBeNull();
            expect(result[0]?.eps).toBeNull();
        });

        it('maps NaN to null', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    revenue: NaN,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.revenue).toBeNull();
        });

        it('derived margin fields are always null (computed by core)', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    revenue: 391_035_000_000,
                    grossProfit: 170_782_000_000,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.grossMargin).toBeNull();
            expect(result[0]?.operatingMargin).toBeNull();
            expect(result[0]?.netMargin).toBeNull();
        });

        it('propagates FMP throw (no error swallow)', async () => {
            mockError(404);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getIncomeStatements('AAPL', 'annual', 5)
            ).rejects.toThrow('404');
        });

        it('uses FMP_STATEMENTS_REVALIDATE_SECONDS for Next cache revalidate', async () => {
            mockOk([]);
            await new FmpFinancialStatementsClient().getIncomeStatements(
                'AAPL',
                'annual',
                5
            );
            const opts = mockFetch.mock.calls[0]![1] as RequestInit & {
                next?: { revalidate?: number };
            };
            expect(opts.next?.revalidate).toBe(
                FMP_STATEMENTS_REVALIDATE_SECONDS
            );
        });
    });

    // ------------------------------------------------------------------ //
    // getBalanceSheets
    // ------------------------------------------------------------------ //

    describe('getBalanceSheets', () => {
        it('maps raw fields to BalanceSheetRow correctly', async () => {
            mockOk([
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
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getBalanceSheets('AAPL', 'annual', 5);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
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
            });
        });

        it('passes endpoint and query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getBalanceSheets('AAPL', 'quarter', 3);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('balance-sheet-statement');
            expect(url).toContain('symbol=AAPL');
            expect(url).toContain('period=quarter');
            expect(url).toContain('limit=3');
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(await client.getBalanceSheets('X', 'annual', 5)).toEqual([]);
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY', date: '2024-09-28' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getBalanceSheets('AAPL', 'annual', 5);
            expect(result[0]?.totalAssets).toBeNull();
            expect(result[0]?.netDebt).toBeNull();
        });

        it('currentRatio is always null (derived by core)', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    totalCurrentAssets: 100,
                    totalCurrentLiabilities: 50,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getBalanceSheets('AAPL', 'annual', 5);
            expect(result[0]?.currentRatio).toBeNull();
        });

        it('propagates FMP throw', async () => {
            mockError(403);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getBalanceSheets('AAPL', 'annual', 5)
            ).rejects.toThrow('403');
        });
    });

    // ------------------------------------------------------------------ //
    // getCashFlowStatements
    // ------------------------------------------------------------------ //

    describe('getCashFlowStatements', () => {
        it('maps raw fields to CashFlowRow correctly', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    operatingCashFlow: 118_254_000_000,
                    capitalExpenditure: -9_447_000_000,
                    freeCashFlow: 108_807_000_000,
                    dividendsPaid: -15_234_000_000,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                date: '2024-09-28',
                operatingCashFlow: 118_254_000_000,
                capitalExpenditure: -9_447_000_000,
                freeCashFlow: 108_807_000_000,
                dividendsPaid: -15_234_000_000,
                fcfMargin: null,
            });
        });

        it('passes endpoint and query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getCashFlowStatements('AAPL', 'annual', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('cash-flow-statement');
            expect(url).toContain('symbol=AAPL');
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(
                await client.getCashFlowStatements('X', 'annual', 5)
            ).toEqual([]);
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY', date: '2024-09-28' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.operatingCashFlow).toBeNull();
            expect(result[0]?.freeCashFlow).toBeNull();
        });

        it('fcfMargin is always null (derived by core)', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    freeCashFlow: 100_000_000,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowStatements(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.fcfMargin).toBeNull();
        });

        it('propagates FMP throw', async () => {
            mockError(404);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getCashFlowStatements('AAPL', 'annual', 5)
            ).rejects.toThrow('404');
        });
    });

    // ------------------------------------------------------------------ //
    // getIncomeStatementGrowths
    // ------------------------------------------------------------------ //

    describe('getIncomeStatementGrowths', () => {
        it('maps raw fields to IncomeGrowthRow correctly', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    growthRevenue: 0.02,
                    growthNetIncome: 0.07,
                    growthEPS: 0.11,
                    growthOperatingIncome: 0.1,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                growthRevenue: 0.02,
                growthNetIncome: 0.07,
                growthEPS: 0.11,
                growthOperatingIncome: 0.1,
            });
        });

        it('passes endpoint and query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getIncomeStatementGrowths('AAPL', 'annual', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('income-statement-growth');
            expect(url).toContain('symbol=AAPL');
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(
                await client.getIncomeStatementGrowths('X', 'annual', 5)
            ).toEqual([]);
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatementGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.growthRevenue).toBeNull();
            expect(result[0]?.growthEPS).toBeNull();
        });

        it('propagates FMP throw', async () => {
            mockError(404);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getIncomeStatementGrowths('AAPL', 'annual', 5)
            ).rejects.toThrow('404');
        });
    });

    // ------------------------------------------------------------------ //
    // getFinancialGrowths — critical: epsgrowth → epsGrowth
    // ------------------------------------------------------------------ //

    describe('getFinancialGrowths', () => {
        it('maps raw fields to FinancialGrowthRow correctly including epsgrowth → epsGrowth', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    revenueGrowth: 0.02,
                    netIncomeGrowth: 0.07,
                    epsgrowth: 0.11, // FMP wire name (lowercase)
                    freeCashFlowGrowth: 0.15,
                    operatingCashFlowGrowth: 0.09,
                    assetGrowth: 0.03,
                    debtGrowth: -0.05,
                    threeYRevenueGrowthPerShare: 0.08,
                    fiveYRevenueGrowthPerShare: 0.12,
                    tenYRevenueGrowthPerShare: 0.1,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getFinancialGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                revenueGrowth: 0.02,
                netIncomeGrowth: 0.07,
                epsGrowth: 0.11, // domain field name (camelCase)
                freeCashFlowGrowth: 0.15,
                operatingCashFlowGrowth: 0.09,
                assetGrowth: 0.03,
                debtGrowth: -0.05,
                threeYRevenueGrowthPerShare: 0.08,
                fiveYRevenueGrowthPerShare: 0.12,
                tenYRevenueGrowthPerShare: 0.1,
            });
        });

        it('maps epsgrowth=undefined → epsGrowth: null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getFinancialGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.epsGrowth).toBeNull();
        });

        it('maps epsgrowth=NaN → epsGrowth: null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY', epsgrowth: NaN }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getFinancialGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.epsGrowth).toBeNull();
        });

        it('passes endpoint and query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getFinancialGrowths('AAPL', 'annual', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('financial-growth');
            expect(url).toContain('symbol=AAPL');
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(await client.getFinancialGrowths('X', 'annual', 5)).toEqual(
                []
            );
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getFinancialGrowths(
                'AAPL',
                'annual',
                5
            );
            expect(result[0]?.revenueGrowth).toBeNull();
            expect(result[0]?.debtGrowth).toBeNull();
            expect(result[0]?.threeYRevenueGrowthPerShare).toBeNull();
        });

        it('propagates FMP throw', async () => {
            mockError(400);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getFinancialGrowths('AAPL', 'annual', 5)
            ).rejects.toThrow('400');
        });
    });

    // ------------------------------------------------------------------ //
    // getCashFlowGrowths
    // ------------------------------------------------------------------ //

    describe('getCashFlowGrowths', () => {
        it('maps raw fields to CashFlowGrowthRow correctly', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    growthOperatingCashFlow: 0.07,
                    growthFreeCashFlow: 0.09,
                    growthCapitalExpenditure: -0.02,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowGrowths('AAPL', 'annual', 5);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                fiscalYear: '2024',
                period: 'FY',
                growthOperatingCashFlow: 0.07,
                growthFreeCashFlow: 0.09,
                growthCapitalExpenditure: -0.02,
            });
        });

        it('passes endpoint and query params', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            await client.getCashFlowGrowths('AAPL', 'annual', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('cash-flow-statement-growth');
            expect(url).toContain('symbol=AAPL');
        });

        it('returns [] when FMP returns empty array', async () => {
            mockOk([]);
            const client = new FmpFinancialStatementsClient();
            expect(await client.getCashFlowGrowths('X', 'annual', 5)).toEqual(
                []
            );
        });

        it('maps undefined numeric fields to null', async () => {
            mockOk([{ fiscalYear: '2024', period: 'FY' }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowGrowths('AAPL', 'annual', 5);
            expect(result[0]?.growthOperatingCashFlow).toBeNull();
            expect(result[0]?.growthFreeCashFlow).toBeNull();
        });

        it('propagates FMP throw', async () => {
            mockError(404);
            const client = new FmpFinancialStatementsClient();
            await expect(
                client.getCashFlowGrowths('AAPL', 'annual', 5)
            ).rejects.toThrow('404');
        });
    });

    // ------------------------------------------------------------------ //
    // Multi-row mapping
    // ------------------------------------------------------------------ //

    describe('multi-row mapping', () => {
        it('maps all rows in an array response', async () => {
            mockOk([
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-09-28',
                    revenue: 391_000_000_000,
                },
                {
                    fiscalYear: '2023',
                    period: 'FY',
                    date: '2023-09-30',
                    revenue: 383_000_000_000,
                },
                {
                    fiscalYear: '2022',
                    period: 'FY',
                    date: '2022-09-24',
                    revenue: 394_000_000_000,
                },
            ]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements(
                'AAPL',
                'annual',
                3
            );
            expect(result).toHaveLength(3);
            expect(result[0]?.fiscalYear).toBe('2024');
            expect(result[1]?.fiscalYear).toBe('2023');
            expect(result[2]?.fiscalYear).toBe('2022');
        });
    });

    // ------------------------------------------------------------------ //
    // Defensive fallback paths: missing string fields default to ''
    // ------------------------------------------------------------------ //

    describe('missing string fields fall back to empty string', () => {
        it('getIncomeStatements: missing fiscalYear/period/date → empty strings', async () => {
            mockOk([{ revenue: 100 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatements('X', 'annual', 1);
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
            expect(result[0]?.date).toBe('');
        });

        it('getBalanceSheets: missing fiscalYear/period/date → empty strings', async () => {
            mockOk([{ totalAssets: 200 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getBalanceSheets('X', 'annual', 1);
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
            expect(result[0]?.date).toBe('');
        });

        it('getCashFlowStatements: missing fiscalYear/period/date → empty strings', async () => {
            mockOk([{ operatingCashFlow: 50 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowStatements('X', 'annual', 1);
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
            expect(result[0]?.date).toBe('');
        });

        it('getIncomeStatementGrowths: missing fiscalYear/period → empty strings', async () => {
            mockOk([{ growthRevenue: 0.1 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getIncomeStatementGrowths(
                'X',
                'annual',
                1
            );
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
        });

        it('getFinancialGrowths: missing fiscalYear/period → empty strings', async () => {
            mockOk([{ revenueGrowth: 0.05 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getFinancialGrowths('X', 'annual', 1);
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
        });

        it('getCashFlowGrowths: missing fiscalYear/period → empty strings', async () => {
            mockOk([{ growthOperatingCashFlow: 0.07 }]);
            const client = new FmpFinancialStatementsClient();
            const result = await client.getCashFlowGrowths('X', 'annual', 1);
            expect(result[0]?.fiscalYear).toBe('');
            expect(result[0]?.period).toBe('');
        });
    });
});
