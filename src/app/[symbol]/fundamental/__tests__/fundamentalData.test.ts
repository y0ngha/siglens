vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/ticker', () => ({
    DrizzleProfileDescriptionTranslationRepository: vi
        .fn()
        .mockImplementation(() => ({
            findBySymbol: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue(undefined),
        })),
    translateCompanyDescription: vi.fn().mockResolvedValue('translated desc'),
}));
vi.mock('@/shared/api/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: class MockFmpFundamentalClient {
        getProfile = vi.fn().mockResolvedValue(null);
        getStockPeers = vi.fn().mockResolvedValue([]);
        getKeyMetricsTtm = vi.fn().mockResolvedValue(null);
        getRatiosTtm = vi.fn().mockResolvedValue(null);
        getIncomeStatementGrowth = vi.fn().mockResolvedValue(null);
        getFinancialScores = vi.fn().mockResolvedValue(null);
        getCashFlowStatement = vi.fn().mockResolvedValue(null);
        getAnalystEstimates = vi.fn().mockResolvedValue(null);
        getGradesConsensus = vi.fn().mockResolvedValue(null);
        getPriceTargetConsensus = vi.fn().mockResolvedValue(null);
        getPriceTargetSummary = vi.fn().mockResolvedValue(null);
    },
}));
vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
    };
});

import {
    getProfile,
    getStockPeers,
    getKeyMetricsTtm,
    getRatiosTtm,
    getIncomeStatementGrowth,
    getFinancialScores,
    getCashFlowStatement,
    getAnalystEstimates,
    getGradesConsensus,
    getPriceTargetConsensus,
    getPriceTargetSummary,
} from '@/app/[symbol]/fundamental/fundamentalData';

describe('fundamentalData', () => {
    it('getProfile returns null when FMP returns null', async () => {
        const result = await getProfile('AAPL');
        expect(result).toBeNull();
    });

    it('getStockPeers returns an empty array', async () => {
        const result = await getStockPeers('AAPL');
        expect(result).toEqual([]);
    });

    it('getKeyMetricsTtm returns null', async () => {
        const result = await getKeyMetricsTtm('AAPL');
        expect(result).toBeNull();
    });

    it('getRatiosTtm returns null', async () => {
        const result = await getRatiosTtm('AAPL');
        expect(result).toBeNull();
    });

    it('getIncomeStatementGrowth returns null', async () => {
        const result = await getIncomeStatementGrowth('AAPL');
        expect(result).toBeNull();
    });

    it('getFinancialScores returns null', async () => {
        const result = await getFinancialScores('AAPL');
        expect(result).toBeNull();
    });

    it('getCashFlowStatement returns null', async () => {
        const result = await getCashFlowStatement('AAPL');
        expect(result).toBeNull();
    });

    it('getAnalystEstimates returns null', async () => {
        const result = await getAnalystEstimates('AAPL');
        expect(result).toBeNull();
    });

    it('getGradesConsensus returns null', async () => {
        const result = await getGradesConsensus('AAPL');
        expect(result).toBeNull();
    });

    it('getPriceTargetConsensus returns null', async () => {
        const result = await getPriceTargetConsensus('AAPL');
        expect(result).toBeNull();
    });

    it('getPriceTargetSummary returns null', async () => {
        const result = await getPriceTargetSummary('AAPL');
        expect(result).toBeNull();
    });
});
