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
// 모킹된 FmpFundamentalClient의 단일 인스턴스 메서드 핸들. getFundamentalDataProvider가
// 클라이언트를 한 번만 생성·캐싱하고 fundamentalData.ts가 그 인스턴스를 그대로 쓰므로,
// 여기서 노출한 vi.fn()들이 곧 실제 호출 대상이다. 테스트별로 mockResolvedValueOnce로
// 반환값을 덮어쓸 수 있다.
const fundamentalClient = vi.hoisted(() => ({
    getProfile: vi.fn().mockResolvedValue(null),
    getStockPeers: vi.fn().mockResolvedValue([]),
    getKeyMetricsTtm: vi.fn().mockResolvedValue(null),
    getRatiosTtm: vi.fn().mockResolvedValue(null),
    getIncomeStatementGrowth: vi.fn().mockResolvedValue(null),
    getFinancialScores: vi.fn().mockResolvedValue(null),
    getCashFlowStatement: vi.fn().mockResolvedValue(null),
    getAnalystEstimates: vi.fn().mockResolvedValue(null),
    getGradesConsensus: vi.fn().mockResolvedValue(null),
    getPriceTargetConsensus: vi.fn().mockResolvedValue(null),
    getPriceTargetSummary: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/shared/api/fmp/fundamentalClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/fmp/fundamentalClient')
    >()),
    FmpFundamentalClient: class MockFmpFundamentalClient {
        getProfile = fundamentalClient.getProfile;
        getStockPeers = fundamentalClient.getStockPeers;
        getKeyMetricsTtm = fundamentalClient.getKeyMetricsTtm;
        getRatiosTtm = fundamentalClient.getRatiosTtm;
        getIncomeStatementGrowth = fundamentalClient.getIncomeStatementGrowth;
        getFinancialScores = fundamentalClient.getFinancialScores;
        getCashFlowStatement = fundamentalClient.getCashFlowStatement;
        getAnalystEstimates = fundamentalClient.getAnalystEstimates;
        getGradesConsensus = fundamentalClient.getGradesConsensus;
        getPriceTargetConsensus = fundamentalClient.getPriceTargetConsensus;
        getPriceTargetSummary = fundamentalClient.getPriceTargetSummary;
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

    it('getStockPeers populates per/psr from each peer key-metrics', async () => {
        fundamentalClient.getStockPeers.mockResolvedValueOnce([
            { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 3_000_000 },
        ]);
        fundamentalClient.getKeyMetricsTtm.mockResolvedValueOnce({
            peRatioTTM: 35.5,
            priceToSalesRatioTTM: 12.25,
            pbRatioTTM: null,
            pegRatioTTM: null,
            enterpriseValueOverEBITDATTM: null,
            epsTTM: null,
        });

        const result = await getStockPeers('AAPL');

        expect(result).toEqual([
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                marketCap: 3_000_000,
                per: 35.5,
                psr: 12.25,
            },
        ]);
        expect(fundamentalClient.getKeyMetricsTtm).toHaveBeenCalledWith('MSFT');
    });

    it('getStockPeers defaults per/psr to null when a peer has no key-metrics', async () => {
        fundamentalClient.getStockPeers.mockResolvedValueOnce([
            { symbol: 'GOOG', companyName: 'Alphabet', marketCap: 2_000_000 },
        ]);
        fundamentalClient.getKeyMetricsTtm.mockResolvedValueOnce(null);

        const result = await getStockPeers('AAPL');

        expect(result).toEqual([
            {
                symbol: 'GOOG',
                companyName: 'Alphabet',
                marketCap: 2_000_000,
                per: null,
                psr: null,
            },
        ]);
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
