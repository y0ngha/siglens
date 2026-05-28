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
vi.mock('@/shared/api/fmp/fundamentalClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/fmp/fundamentalClient')
    >()),
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
// Redis 레이어는 getOrSetCache.test.ts에서 독립적으로 커버한다. 여기서는 fetcher로
// 위임만 시켜, Redis 환경변수가 설정된 CI에서도 실제 I/O 없이 격리되게 한다.
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: vi.fn(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
            fetcher()
    ),
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
