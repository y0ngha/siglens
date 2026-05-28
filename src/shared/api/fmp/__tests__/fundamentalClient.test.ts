vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { FmpFundamentalClient } from '../fundamentalClient';

const mockFetch = vi.fn();

const TEST_API_KEY = 'test-api-key';

describe('FmpFundamentalClient', () => {
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
    // API key guard (shared fmpGet behaviour)
    // ------------------------------------------------------------------ //

    describe('FMP_API_KEY missing', () => {
        it('getProfile throws when FMP_API_KEY is not set', async () => {
            delete process.env.FMP_API_KEY;
            const client = new FmpFundamentalClient();
            await expect(client.getProfile('AAPL')).rejects.toThrow(
                'FMP_API_KEY'
            );
        });
    });

    // ------------------------------------------------------------------ //
    // Non-2xx HTTP error (shared fmpGet behaviour)
    // ------------------------------------------------------------------ //

    describe('non-2xx HTTP response', () => {
        it('getProfile throws with status in message', async () => {
            mockError(404);
            const client = new FmpFundamentalClient();
            await expect(client.getProfile('AAPL')).rejects.toThrow('404');
        });

        it('getKeyMetricsTtm returns null when both optional endpoints fail', async () => {
            mockError(400);
            mockError(400);
            const client = new FmpFundamentalClient();
            await expect(client.getKeyMetricsTtm('AAPL')).resolves.toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getProfile
    // ------------------------------------------------------------------ //

    describe('getProfile', () => {
        it('maps marketCap and returns all fields', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    sector: 'Technology',
                    industry: 'Consumer Electronics',
                    marketCap: 3_000_000_000_000,
                    ceo: 'Tim Cook',
                    website: 'https://apple.com',
                    description: 'Apple designs consumer electronics.',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getProfile('AAPL');
            expect(result).toEqual({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                sector: 'Technology',
                industry: 'Consumer Electronics',
                marketCap: 3_000_000_000_000,
                ceo: 'Tim Cook',
                website: 'https://apple.com',
                description: 'Apple designs consumer electronics.',
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            const result = await client.getProfile('UNKNOWN');
            expect(result).toBeNull();
        });

        it('passes the correct URL with apikey', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    sector: 'Technology',
                    industry: 'Consumer Electronics',
                    mktCap: 1,
                    ceo: null,
                    website: null,
                    description: null,
                },
            ]);
            const client = new FmpFundamentalClient();
            await client.getProfile('AAPL');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('profile');
            expect(url).toContain('symbol=AAPL');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });

        it('handles nullable optional fields (ceo/website/description)', async () => {
            mockOk([
                {
                    symbol: 'TEST',
                    companyName: 'Test Corp',
                    sector: 'Finance',
                    industry: 'Banking',
                    mktCap: 100,
                    ceo: null,
                    website: null,
                    description: null,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getProfile('TEST');
            expect(result?.ceo).toBeNull();
            expect(result?.website).toBeNull();
            expect(result?.description).toBeNull();
        });

        it('returns null when market cap is missing', async () => {
            mockOk([
                {
                    symbol: 'TEST',
                    companyName: 'Test Corp',
                    sector: 'Finance',
                    industry: 'Banking',
                    ceo: null,
                    website: null,
                    description: null,
                },
            ]);
            const client = new FmpFundamentalClient();
            expect(await client.getProfile('TEST')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getKeyMetricsTtm
    // ------------------------------------------------------------------ //

    describe('getKeyMetricsTtm', () => {
        it('returns mapped TTM key metrics', async () => {
            mockOk([
                {
                    evToEBITDATTM: 22.0,
                },
            ]);
            mockOk([
                {
                    priceToEarningsRatioTTM: 28.5,
                    priceToSalesRatioTTM: 7.2,
                    priceToBookRatioTTM: 45.1,
                    priceToEarningsGrowthRatioTTM: 2.3,
                    netIncomePerShareTTM: 6.11,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getKeyMetricsTtm('AAPL');
            expect(result).toEqual({
                peRatioTTM: 28.5,
                priceToSalesRatioTTM: 7.2,
                pbRatioTTM: 45.1,
                pegRatioTTM: 2.3,
                enterpriseValueOverEBITDATTM: 22.0,
                epsTTM: 6.11,
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getKeyMetricsTtm('X')).toBeNull();
        });

        it('uses key metrics when ratios fallback request fails', async () => {
            mockOk([
                {
                    peRatioTTM: 28.5,
                    priceToSalesRatioTTM: 7.2,
                    pbRatioTTM: 45.1,
                    pegRatioTTM: 2.3,
                    enterpriseValueOverEBITDATTM: 22,
                    epsTTM: 6.11,
                },
            ]);
            mockError(400);
            const client = new FmpFundamentalClient();
            expect(await client.getKeyMetricsTtm('AAPL')).toEqual({
                peRatioTTM: 28.5,
                priceToSalesRatioTTM: 7.2,
                pbRatioTTM: 45.1,
                pegRatioTTM: 2.3,
                enterpriseValueOverEBITDATTM: 22,
                epsTTM: 6.11,
            });
        });
    });

    // ------------------------------------------------------------------ //
    // getRatiosTtm
    // ------------------------------------------------------------------ //

    describe('getRatiosTtm', () => {
        it('returns mapped TTM ratios', async () => {
            mockOk([
                {
                    operatingProfitMarginTTM: 0.3,
                    netProfitMarginTTM: 0.25,
                    debtToAssetsRatioTTM: 0.31,
                    currentRatioTTM: 0.94,
                },
            ]);
            mockOk([
                {
                    returnOnEquityTTM: 1.47,
                    returnOnAssetsTTM: 0.28,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getRatiosTtm('AAPL');
            expect(result?.returnOnEquityTTM).toBe(1.47);
            expect(result?.currentRatioTTM).toBe(0.94);
            expect(result?.debtRatioTTM).toBe(0.31);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getRatiosTtm('X')).toBeNull();
        });

        it('uses ratios when key metrics fallback request fails', async () => {
            mockOk([
                {
                    returnOnEquityTTM: 1.47,
                    returnOnAssetsTTM: 0.28,
                    operatingProfitMarginTTM: 0.3,
                    netProfitMarginTTM: 0.25,
                    debtRatioTTM: 0.31,
                    currentRatioTTM: 0.94,
                },
            ]);
            mockError(400);
            const client = new FmpFundamentalClient();
            expect(await client.getRatiosTtm('AAPL')).toEqual({
                returnOnEquityTTM: 1.47,
                returnOnAssetsTTM: 0.28,
                operatingProfitMarginTTM: 0.3,
                netProfitMarginTTM: 0.25,
                debtRatioTTM: 0.31,
                currentRatioTTM: 0.94,
            });
        });

        it('currentRatioTTM falls back to metrics when ratios row omits it', async () => {
            // ratios row has no currentRatioTTM → `ratios?.currentRatioTTM` is
            // undefined → the ?? right-hand branch reads metrics?.currentRatioTTM.
            mockOk([
                {
                    // ratios-ttm row — omits currentRatioTTM
                    returnOnEquityTTM: 1.0,
                    returnOnAssetsTTM: 0.2,
                    operatingProfitMarginTTM: 0.3,
                    netProfitMarginTTM: 0.25,
                    debtToAssetsRatioTTM: 0.31,
                },
            ]);
            mockOk([
                {
                    // key-metrics-ttm row — provides currentRatioTTM
                    currentRatioTTM: 1.85,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getRatiosTtm('AAPL');
            expect(result?.currentRatioTTM).toBe(1.85);
        });
    });

    // ------------------------------------------------------------------ //
    // getCashFlowStatement
    // ------------------------------------------------------------------ //

    describe('getCashFlowStatement', () => {
        it('returns operating cash flow', async () => {
            mockOk([{ operatingCashFlow: 110_543_000_000 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getCashFlowStatement('AAPL');
            expect(result?.operatingCashFlow).toBe(110_543_000_000);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getCashFlowStatement('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getIncomeStatementGrowth
    // ------------------------------------------------------------------ //

    describe('getIncomeStatementGrowth', () => {
        it('returns growth rates', async () => {
            mockOk([{ growthRevenue: 0.08, growthEPS: 0.13 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getIncomeStatementGrowth('AAPL');
            expect(result?.growthRevenue).toBe(0.08);
            expect(result?.growthEPS).toBe(0.13);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getIncomeStatementGrowth('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getFinancialScores
    // ------------------------------------------------------------------ //

    describe('getFinancialScores', () => {
        it('returns Altman Z-score and Piotroski F-score', async () => {
            mockOk([{ altmanZScore: 6.5, piotroskiScore: 7 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getFinancialScores('AAPL');
            expect(result?.altmanZScore).toBe(6.5);
            expect(result?.piotroskiScore).toBe(7);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getFinancialScores('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getStockPeers
    // ------------------------------------------------------------------ //

    describe('getStockPeers', () => {
        it('returns array of mapped peer entries', async () => {
            mockOk([
                {
                    symbol: 'MSFT',
                    companyName: 'Microsoft',
                    mktCap: 2_800_000_000_000,
                },
                {
                    symbol: 'GOOGL',
                    companyName: 'Alphabet',
                    mktCap: 1_900_000_000_000,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getStockPeers('AAPL');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                symbol: 'MSFT',
                companyName: 'Microsoft',
                marketCap: 2_800_000_000_000,
            });
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getStockPeers('X')).toEqual([]);
        });

        it('skips peer entries without finite market cap', async () => {
            mockOk([{ symbol: 'BAD', companyName: 'Bad Data' }]);
            const client = new FmpFundamentalClient();
            expect(await client.getStockPeers('AAPL')).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // getAnalystEstimates
    // ------------------------------------------------------------------ //

    describe('getAnalystEstimates', () => {
        it('returns consensus estimate fields', async () => {
            mockOk([{ epsAvg: 1.58, revenueAvg: 95_000_000_000 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getAnalystEstimates('AAPL');
            expect(result?.estimatedEpsAvg).toBe(1.58);
            expect(result?.estimatedRevenueAvg).toBe(95_000_000_000);
        });

        it('passes required Financial Estimates API query parameters', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            await client.getAnalystEstimates('AAPL');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('analyst-estimates');
            expect(url).toContain('symbol=AAPL');
            expect(url).toContain('period=annual');
            expect(url).toContain('page=0');
            expect(url).toContain('limit=10');
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getAnalystEstimates('X')).toBeNull();
        });

        it('uses estimatedEpsAvg / estimatedRevenueAvg alias fields when primary epsAvg / revenueAvg are absent', async () => {
            // Row has the alias field names only — epsAvg/revenueAvg are absent so
            // the ?? right-hand branch in the mapping is exercised.
            mockOk([
                {
                    estimatedEpsAvg: 2.34,
                    estimatedRevenueAvg: 120_000_000_000,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getAnalystEstimates('AAPL');
            expect(result?.estimatedEpsAvg).toBe(2.34);
            expect(result?.estimatedRevenueAvg).toBe(120_000_000_000);
        });
    });

    // ------------------------------------------------------------------ //
    // getGrades
    // ------------------------------------------------------------------ //

    describe('getGrades', () => {
        it('maps known action strings to GradesAction union', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-01-15',
                    gradingCompany: 'Goldman Sachs',
                    previousGrade: 'Neutral',
                    newGrade: 'Buy',
                    action: 'upgrade',
                },
                {
                    symbol: 'AAPL',
                    date: '2024-01-10',
                    gradingCompany: 'Morgan Stanley',
                    previousGrade: 'Overweight',
                    newGrade: 'Equal-Weight',
                    action: 'downgrade',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getGrades('AAPL');
            expect(result[0]!.action).toBe('upgrade');
            expect(result[1]!.action).toBe('downgrade');
        });

        it('maps "maintained" and "reiterated" to maintained', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-01-01',
                    gradingCompany: 'JPMorgan',
                    previousGrade: 'Overweight',
                    newGrade: 'Overweight',
                    action: 'Reiterated',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getGrades('AAPL');
            expect(result[0]!.action).toBe('maintained');
        });

        it('maps "initiated coverage" to initiated', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-01-01',
                    gradingCompany: 'Citi',
                    previousGrade: null,
                    newGrade: 'Buy',
                    action: 'Initiated Coverage',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getGrades('AAPL');
            expect(result[0]!.action).toBe('initiated');
        });

        it('falls back to "other" for unrecognised action strings', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-01-01',
                    gradingCompany: 'Unknown',
                    previousGrade: null,
                    newGrade: 'Buy',
                    action: 'suspended',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getGrades('AAPL');
            expect(result[0]!.action).toBe('other');
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getGrades('X')).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // getGradesConsensus
    // ------------------------------------------------------------------ //

    describe('getGradesConsensus', () => {
        it('returns mapped consensus counts', async () => {
            mockOk([
                { strongBuy: 12, buy: 18, hold: 5, sell: 1, strongSell: 0 },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getGradesConsensus('AAPL');
            expect(result).toEqual({
                strongBuy: 12,
                buy: 18,
                hold: 5,
                sell: 1,
                strongSell: 0,
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getGradesConsensus('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getPriceTargetConsensus
    // ------------------------------------------------------------------ //

    describe('getPriceTargetConsensus', () => {
        it('returns mapped price target consensus fields', async () => {
            mockOk([
                {
                    targetHigh: 250,
                    targetLow: 160,
                    targetMedian: 210,
                    targetConsensus: 205,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getPriceTargetConsensus('AAPL');
            expect(result?.targetHigh).toBe(250);
            expect(result?.targetLow).toBe(160);
            expect(result?.targetMedian).toBe(210);
            expect(result?.targetConsensus).toBe(205);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getPriceTargetConsensus('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getPriceTargetSummary
    // ------------------------------------------------------------------ //

    describe('getPriceTargetSummary', () => {
        it('returns mapped rolling average price targets', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    lastMonthCount: 1,
                    lastMonthAvgPriceTarget: 200.75,
                    lastQuarterCount: 3,
                    lastQuarterAvgPriceTarget: 204.2,
                    lastYearCount: 48,
                    lastYearAvgPriceTarget: 232.99,
                    allTimeCount: 167,
                    allTimeAvgPriceTarget: 201.21,
                    publishers:
                        '["Benzinga","StreetInsider","TheFly","Pulse 2.0","TipRanks Contributor","MarketWatch","Investing","Barrons","Investor\'s Business Daily"]',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getPriceTargetSummary('AAPL');
            expect(result?.lastMonth.avgPriceTarget).toBe(200.75);
            expect(result?.lastQuarter.avgPriceTarget).toBe(204.2);
            expect(result?.lastYear.avgPriceTarget).toBe(232.99);
        });

        it('maps missing average fields to null', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    lastMonthCount: 0,
                    lastQuarterCount: 0,
                    lastYearCount: 0,
                    allTimeCount: 0,
                    publishers: '[]',
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getPriceTargetSummary('AAPL');
            expect(result).toEqual({
                lastMonth: { avgPriceTarget: null },
                lastQuarter: { avgPriceTarget: null },
                lastYear: { avgPriceTarget: null },
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getPriceTargetSummary('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getSectorPerformanceSnapshot
    // ------------------------------------------------------------------ //

    describe('getSectorPerformanceSnapshot', () => {
        it('returns mapped sector performance entries for a date', async () => {
            mockOk([
                { sector: 'Technology', averageChange: 1.23 },
                { sector: 'Energy', averageChange: -0.45 },
            ]);
            const client = new FmpFundamentalClient();
            const result =
                await client.getSectorPerformanceSnapshot('2024-01-15');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                sector: 'Technology',
                changesPercentage: 1.23,
            });
            expect(result[1]).toEqual({
                sector: 'Energy',
                changesPercentage: -0.45,
            });
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('sector-performance-snapshot');
            expect(url).toContain('date=2024-01-15');
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(
                await client.getSectorPerformanceSnapshot('2024-01-15')
            ).toEqual([]);
        });

        it('skips entries without finite sector performance value', async () => {
            mockOk([{ sector: 'Technology' }]);
            const client = new FmpFundamentalClient();
            expect(
                await client.getSectorPerformanceSnapshot('2024-01-15')
            ).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // getHistoricalSectorPerformance — unconditional stub
    // ------------------------------------------------------------------ //

    describe('getHistoricalSectorPerformance', () => {
        it('always resolves to [] without making any HTTP request', async () => {
            const client = new FmpFundamentalClient();
            await expect(
                client.getHistoricalSectorPerformance('Technology')
            ).resolves.toEqual([]);
            // The stub never calls fetch — no mock call should have been made.
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------ //
    // getEarningsReports — malformed row (no date fields)
    // ------------------------------------------------------------------ //

    describe('getEarningsReports — malformed rows', () => {
        it('drops a row that has neither date nor earningsDate → returns []', async () => {
            // Row has a symbol but no string date / earningsDate → toEarningsDate
            // returns null → toFmpEarningsReportItem returns [] → flatMap drops it.
            mockOk([{ symbol: 'AAPL', epsActual: 1.5 }]);
            const client = new FmpFundamentalClient();
            await expect(client.getEarningsReports('AAPL')).resolves.toEqual(
                []
            );
        });
    });

    // ------------------------------------------------------------------ //
    // getEarningsReport
    // ------------------------------------------------------------------ //

    describe('getEarningsReport', () => {
        it('returns the first earnings report entry', async () => {
            mockOk([
                { symbol: 'AAPL', date: '2024-02-01' },
                { symbol: 'AAPL', date: '2023-11-02' },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getEarningsReport('AAPL');
            expect(result).toEqual({
                symbol: 'AAPL',
                earningsDate: '2024-02-01',
            });
        });

        it('supports legacy earningsDate field name', async () => {
            mockOk([{ symbol: 'AAPL', earningsDate: '2024-02-01' }]);
            const client = new FmpFundamentalClient();
            expect(await client.getEarningsReport('AAPL')).toEqual({
                symbol: 'AAPL',
                earningsDate: '2024-02-01',
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getEarningsReport('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getEarningsReports
    // ------------------------------------------------------------------ //

    describe('getEarningsReports', () => {
        it('maps EPS and revenue fields for comparison storage', async () => {
            const raw = {
                symbol: 'AAPL',
                date: '2026-04-30',
                epsActual: 2.01,
                epsEstimated: 1.95,
                revenueActual: 111_184_000_000,
                revenueEstimated: 109_457_600_000,
                lastUpdated: '2026-05-10',
            };
            mockOk([raw]);
            const client = new FmpFundamentalClient();

            await expect(client.getEarningsReports('AAPL')).resolves.toEqual([
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-04-30',
                    epsActual: 2.01,
                    epsEstimated: 1.95,
                    revenueActual: 111_184_000_000,
                    revenueEstimated: 109_457_600_000,
                    lastUpdated: '2026-05-10',
                    rawPayload: raw,
                },
            ]);
        });

        it('passes limit=5 by default', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();

            await client.getEarningsReports('MSFT');

            const url = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('symbol=MSFT');
            expect(url).toContain('limit=5');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });
    });
});
