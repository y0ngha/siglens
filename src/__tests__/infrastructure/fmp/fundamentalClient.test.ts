import { DEFAULT_GRADES_LIMIT, FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

const mockFetch = jest.fn();

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
        mockFetch.mockResolvedValueOnce({ ok: false, status });
    }

    // ------------------------------------------------------------------ //
    // API key guard (shared fmpGet behaviour)
    // ------------------------------------------------------------------ //

    describe('FMP_API_KEY missing', () => {
        it('getProfile throws when FMP_API_KEY is not set', async () => {
            delete process.env.FMP_API_KEY;
            const client = new FmpFundamentalClient();
            await expect(client.getProfile('AAPL')).rejects.toThrow('FMP_API_KEY');
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

        it('getKeyMetricsTtm throws with status in message', async () => {
            mockError(500);
            const client = new FmpFundamentalClient();
            await expect(client.getKeyMetricsTtm('AAPL')).rejects.toThrow('500');
        });
    });

    // ------------------------------------------------------------------ //
    // getProfile
    // ------------------------------------------------------------------ //

    describe('getProfile', () => {
        it('maps mktCap → marketCap and returns all fields', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    sector: 'Technology',
                    industry: 'Consumer Electronics',
                    mktCap: 3_000_000_000_000,
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
    });

    // ------------------------------------------------------------------ //
    // getKeyMetricsTtm
    // ------------------------------------------------------------------ //

    describe('getKeyMetricsTtm', () => {
        it('returns mapped TTM key metrics', async () => {
            mockOk([
                {
                    peRatioTTM: 28.5,
                    priceToSalesRatioTTM: 7.2,
                    pbRatioTTM: 45.1,
                    pegRatioTTM: 2.3,
                    enterpriseValueOverEBITDATTM: 22.0,
                    epsTTM: 6.11,
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
            const client = new FmpFundamentalClient();
            expect(await client.getKeyMetricsTtm('X')).toBeNull();
        });
    });

    // ------------------------------------------------------------------ //
    // getRatiosTtm
    // ------------------------------------------------------------------ //

    describe('getRatiosTtm', () => {
        it('returns mapped TTM ratios', async () => {
            mockOk([
                {
                    returnOnEquityTTM: 1.47,
                    returnOnAssetsTTM: 0.28,
                    operatingProfitMarginTTM: 0.30,
                    netProfitMarginTTM: 0.25,
                    debtRatioTTM: 0.31,
                    currentRatioTTM: 0.94,
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getRatiosTtm('AAPL');
            expect(result?.returnOnEquityTTM).toBe(1.47);
            expect(result?.currentRatioTTM).toBe(0.94);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getRatiosTtm('X')).toBeNull();
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
                { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2_800_000_000_000 },
                { symbol: 'GOOGL', companyName: 'Alphabet', marketCap: 1_900_000_000_000 },
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
    });

    // ------------------------------------------------------------------ //
    // getAnalystEstimates
    // ------------------------------------------------------------------ //

    describe('getAnalystEstimates', () => {
        it('returns consensus estimate fields', async () => {
            mockOk([{ estimatedEpsAvg: 1.58, estimatedRevenueAvg: 95_000_000_000 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getAnalystEstimates('AAPL');
            expect(result?.estimatedEpsAvg).toBe(1.58);
            expect(result?.estimatedRevenueAvg).toBe(95_000_000_000);
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getAnalystEstimates('X')).toBeNull();
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

        it('passes limit query parameter', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            await client.getGrades('AAPL', 5);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('limit=5');
        });

        it('uses default limit when none provided', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            await client.getGrades('AAPL');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain(`limit=${DEFAULT_GRADES_LIMIT}`);
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
            mockOk([{ strongBuy: 12, buy: 18, hold: 5, sell: 1, strongSell: 0 }]);
            const client = new FmpFundamentalClient();
            const result = await client.getGradesConsensus('AAPL');
            expect(result).toEqual({ strongBuy: 12, buy: 18, hold: 5, sell: 1, strongSell: 0 });
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
                    lastMonth: { avgPriceTarget: 205 },
                    lastQuarter: { avgPriceTarget: 200 },
                    lastYear: { avgPriceTarget: 190 },
                },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getPriceTargetSummary('AAPL');
            expect(result?.lastMonth.avgPriceTarget).toBe(205);
            expect(result?.lastQuarter.avgPriceTarget).toBe(200);
            expect(result?.lastYear.avgPriceTarget).toBe(190);
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
                { sector: 'Technology', changesPercentage: 1.23 },
                { sector: 'Energy', changesPercentage: -0.45 },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getSectorPerformanceSnapshot('2024-01-15');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ sector: 'Technology', changesPercentage: 1.23 });
            expect(result[1]).toEqual({ sector: 'Energy', changesPercentage: -0.45 });
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getSectorPerformanceSnapshot('2024-01-15')).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // getHistoricalSectorPerformance
    // ------------------------------------------------------------------ //

    describe('getHistoricalSectorPerformance', () => {
        it('returns mapped historical sector entries', async () => {
            mockOk([
                { date: '2024-01-15', sector: 'Technology', changesPercentage: 1.5 },
                { date: '2024-01-14', sector: 'Technology', changesPercentage: -0.3 },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getHistoricalSectorPerformance('Technology');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                date: '2024-01-15',
                sector: 'Technology',
                changesPercentage: 1.5,
            });
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getHistoricalSectorPerformance('Technology')).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // getEarningsReport
    // ------------------------------------------------------------------ //

    describe('getEarningsReport', () => {
        it('returns the first earnings report entry', async () => {
            mockOk([
                { symbol: 'AAPL', earningsDate: '2024-02-01' },
                { symbol: 'AAPL', earningsDate: '2023-11-02' },
            ]);
            const client = new FmpFundamentalClient();
            const result = await client.getEarningsReport('AAPL');
            expect(result).toEqual({ symbol: 'AAPL', earningsDate: '2024-02-01' });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpFundamentalClient();
            expect(await client.getEarningsReport('X')).toBeNull();
        });
    });
});
