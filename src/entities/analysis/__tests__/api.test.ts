import type { MockedClass, Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { MOCK_CRYPTO_SESSION, MOCK_EQUITY_SESSION } = vi.hoisted(() => ({
    MOCK_CRYPTO_SESSION: { type: 'crypto' } as never,
    MOCK_EQUITY_SESSION: { type: 'equity' } as never,
}));

// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와 가독성을
// 위해 소스 코드에서도 모든 import보다 위에 둔다 (submitOverallAnalysisAction.test.ts와 동일 패턴).
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        submitAnalysis: vi.fn(),
        submitFundamentalAnalysis: vi.fn(),
        submitFinancialsAnalysis: vi.fn(),
        submitCongressTrend: vi.fn(),
        submitOverallAnalysis: vi.fn(),
        isEtRegularSessionOpen: vi.fn(),
        computeFinancialsScorecard: vi.fn(),
    };
});

vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn((profile: string) =>
        profile === 'crypto' ? MOCK_CRYPTO_SESSION : MOCK_EQUITY_SESSION
    ),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));

vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: vi.fn(() => mockFundamentalProvider),
}));

vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: vi.fn(() => mockFinancialsProvider),
}));

vi.mock('@/shared/api/fmp/getCongressTradesProvider', () => ({
    getCongressTradesProvider: vi.fn(() => mockCongressProvider),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(),
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return { listBySymbol: vi.fn() };
    }),
}));

vi.mock('@/entities/news-article', () => ({
    NEWS_ANALYSIS_LOOKBACK_MS: 30 * 24 * 60 * 60 * 1000,
    buildAnalysisNewsItems: vi.fn(() => []),
}));

vi.mock('@/entities/earnings-report', () => ({
    getNextEarningsReport: vi.fn(),
}));

vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
}));

vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: vi.fn(),
}));

import {
    submitAnalysis,
    submitFundamentalAnalysis,
    submitFinancialsAnalysis,
    submitCongressTrend,
    submitOverallAnalysis,
    isEtRegularSessionOpen,
    computeFinancialsScorecard,
    DEEPSEEK_V4_FLASH_MODEL,
    type SubmitAnalysisGatedResult,
    type SubmitFundamentalAnalysisResult,
    type SubmitFinancialsAnalysisResult,
    type SubmitCongressTrendResult,
    type SubmitOverallAnalysisResult,
    type OptionsSnapshot,
    type FinancialsSnapshot,
    type FinancialsScorecard,
} from '@y0ngha/siglens-core';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import {
    prewarmTechnical,
    prewarmFundamental,
    prewarmFinancials,
    prewarmCongress,
    prewarmOverall,
} from '../api';

const mockProvider = {
    getQuote: vi.fn(),
} as unknown as import('@y0ngha/siglens-core').MarketDataProvider;

const mockFundamentalProvider =
    {} as import('@/shared/api/fmp/getFundamentalDataProvider').FundamentalProviderWithRawPeers;
const mockFinancialsProvider =
    {} as import('@y0ngha/siglens-core').FinancialStatementsProvider;
const mockCongressProvider =
    {} as import('@y0ngha/siglens-core').CongressTradesProvider;

const mockSubmitAnalysis = vi.mocked(submitAnalysis);
const mockSubmitFundamentalAnalysis = vi.mocked(submitFundamentalAnalysis);
const mockSubmitFinancialsAnalysis = vi.mocked(submitFinancialsAnalysis);
const mockSubmitCongressTrend = vi.mocked(submitCongressTrend);
const mockSubmitOverallAnalysis = vi.mocked(submitOverallAnalysis);
const mockIsRegularSession = vi.mocked(isEtRegularSessionOpen);
const mockComputeFinancialsScorecard = vi.mocked(computeFinancialsScorecard);
const mockGetCachedMarketDataProvider = vi.mocked(getCachedMarketDataProvider);
const mockResolveMarketProfile = vi.mocked(resolveMarketProfile);
const mockGetFundamentalDataProvider = vi.mocked(getFundamentalDataProvider);
const mockGetFinancialStatementsProvider = vi.mocked(
    getFinancialStatementsProvider
);
const mockGetCongressTradesProvider = vi.mocked(getCongressTradesProvider);
const mockGetFinancialsSnapshot = vi.mocked(getFinancialsSnapshot);
const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockGetNextEarningsReport = vi.mocked(getNextEarningsReport);
const mockFetchOptionsSnapshot = vi.mocked(fetchOptionsSnapshot);
const mockIsOiStale = vi.mocked(isOpenInterestSnapshotStale);

const SEAM_SOURCE = readFileSync(
    fileURLToPath(new URL('../api.ts', import.meta.url)),
    'utf8'
);

function makeSnapshot(): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice: 150,
        capturedAt: '2026-05-22T13:30:00Z',
        chains: [],
    };
}

describe('prewarmTechnical', () => {
    const cachedResult: SubmitAnalysisGatedResult = {
        status: 'cached',
        result: { summary: 'cached' } as never,
        lockedInfoDepth: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitAnalysis.mockResolvedValue(cachedResult);
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetCachedMarketDataProvider.mockReturnValue(mockProvider);
    });

    it('calls submitAnalysis with the anonymous-free branch shape (modelId default, skipEnqueueIfMiss:false, tier:free, reasoning:false, no bucket)', async () => {
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, false);

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            false,
            undefined,
            {
                modelId: DEEPSEEK_V4_FLASH_MODEL,
                skipEnqueueIfMiss: false,
                marketDataProvider: mockProvider,
                assetClass: 'equity',
                tierContext: { userId: null, tier: 'free' },
                reasoning: false,
                positionBucket: undefined,
            }
        );
    });

    it('threads force=true as the 4th positional arg', async () => {
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, true);

        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        expect(lastCall![3]).toBe(true);
    });

    it('forwards fmpSymbol through to submitAnalysis', async () => {
        await prewarmTechnical('BTCUSD', 'Bitcoin', '^BTCUSD', false);

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'BTCUSD',
            'Bitcoin',
            '1Day',
            false,
            '^BTCUSD',
            expect.objectContaining({ marketDataProvider: mockProvider })
        );
    });
});

describe('prewarmFundamental', () => {
    const cachedResult: SubmitFundamentalAnalysisResult = {
        status: 'cached',
        result: { categories: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitFundamentalAnalysis.mockResolvedValue(cachedResult);
        mockGetFundamentalDataProvider.mockReturnValue(mockFundamentalProvider);
    });

    it('calls submitFundamentalAnalysis with the anonymous-free branch shape', async () => {
        await prewarmFundamental('AAPL', false);

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith({
            symbol: 'AAPL',
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            dataProvider: mockFundamentalProvider,
            tier: 'free',
            reasoning: false,
            skipEnqueueIfMiss: false,
        });
    });

    it('threads force:true when requested', async () => {
        await prewarmFundamental('AAPL', true);

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmFundamental('AAPL', false);

        const callArg = mockSubmitFundamentalAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmFinancials', () => {
    const cachedResult: SubmitFinancialsAnalysisResult = {
        status: 'cached',
        result: { categories: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitFinancialsAnalysis.mockResolvedValue(cachedResult);
        mockGetFinancialStatementsProvider.mockReturnValue(
            mockFinancialsProvider
        );
    });

    it('calls submitFinancialsAnalysis with the anonymous-free branch shape', async () => {
        await prewarmFinancials('AAPL', false);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith({
            symbol: 'AAPL',
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            dataProvider: mockFinancialsProvider,
            tier: 'free',
            reasoning: false,
            skipEnqueueIfMiss: false,
        });
    });

    it('threads force:true when requested', async () => {
        await prewarmFinancials('AAPL', true);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmFinancials('AAPL', false);

        const callArg = mockSubmitFinancialsAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmCongress', () => {
    const cachedResult: SubmitCongressTrendResult = {
        status: 'cached',
        result: { trades: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitCongressTrend.mockResolvedValue(cachedResult);
        mockGetCongressTradesProvider.mockReturnValue(mockCongressProvider);
    });

    it('calls submitCongressTrend with the anonymous-free branch shape (no BYOK gate)', async () => {
        await prewarmCongress('AAPL', false);

        expect(mockSubmitCongressTrend).toHaveBeenCalledWith({
            symbol: 'AAPL',
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            dataProvider: mockCongressProvider,
            skipEnqueueIfMiss: false,
            reasoning: false,
            tier: 'free',
        });
    });

    it('threads force:true when requested', async () => {
        await prewarmCongress('AAPL', true);

        expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmCongress('AAPL', false);

        const callArg = mockSubmitCongressTrend.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmOverall', () => {
    const SUBMITTED_RESULT: SubmitOverallAnalysisResult = {
        status: 'submitted',
        jobId: 'job-overall-001',
    };

    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetCachedMarketDataProvider.mockReturnValue(mockProvider);
        mockGetFundamentalDataProvider.mockReturnValue(mockFundamentalProvider);
        mockSubmitOverallAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockIsRegularSession.mockReturnValue(false);
        mockIsOiStale.mockReturnValue(false);
        mockFetchOptionsSnapshot.mockResolvedValue(null);
        mockGetFinancialsSnapshot.mockResolvedValue({} as FinancialsSnapshot);
        mockComputeFinancialsScorecard.mockReturnValue(
            undefined as unknown as FinancialsScorecard
        );
        mockGetNextEarningsReport.mockResolvedValue(null);

        mockListBySymbol = vi.fn().mockResolvedValue([]);
        MockNewsRepository.mockImplementation(function () {
            return { listBySymbol: mockListBySymbol } as never;
        });
    });

    it('calls submitOverallAnalysis with the anonymous-free branch shape', async () => {
        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                timeframe: '1Day',
                modelId: DEEPSEEK_V4_FLASH_MODEL,
                fundamentalProvider: mockFundamentalProvider,
                marketDataProvider: mockProvider,
                technical: { tierContext: { userId: null, tier: 'free' } },
                tier: 'free',
                reasoning: false,
                skipEnqueueIfMiss: false,
                assetClass: 'equity',
            })
        );
    });

    it('threads force:true when requested', async () => {
        await prewarmOverall('AAPL', 'Apple Inc.', true);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmOverall('AAPL', 'Apple Inc.', false);

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });

    it('fetches options snapshot even though skipEnqueueIfMiss is false (unlike the bot-gated action)', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(makeSnapshot());

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockFetchOptionsSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ optionsSnapshot: expect.any(Object) })
        );
    });

    it('passes optionsSnapshot=undefined when fetchOptionsSnapshot returns null', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ optionsSnapshot: undefined })
        );
    });

    it('fetches financials scorecard even though skipEnqueueIfMiss is false', async () => {
        const scorecard = {
            composite: { grade: 'B' },
        } as unknown as FinancialsScorecard;
        mockGetFinancialsSnapshot.mockResolvedValueOnce(
            {} as FinancialsSnapshot
        );
        mockComputeFinancialsScorecard.mockReturnValueOnce(scorecard);

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockGetFinancialsSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ financialsScorecard: scorecard })
        );
    });

    it('includes upcomingCalendar when next earnings exist', async () => {
        const next = {
            symbol: 'AAPL',
            earningsDate: '2025-08-01',
            epsActual: null,
            epsEstimated: 1.4,
            revenueActual: null,
            revenueEstimated: 88_000_000_000,
            lastUpdated: '2025-07-15',
        };
        mockGetNextEarningsReport.mockResolvedValueOnce(next as never);

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [next] })
        );
    });

    it('fail-soft: when fetchOptionsSnapshot rejects, still calls submitOverallAnalysis with optionsSnapshot:undefined (does not throw)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockFetchOptionsSnapshot.mockRejectedValueOnce(
            new Error('options fetch boom')
        );

        await expect(prewarmOverall('AAPL', 'Apple Inc.', false)).resolves.toBe(
            SUBMITTED_RESULT
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ optionsSnapshot: undefined })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            '[prewarmOverall] options snapshot fetch failed:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('fail-soft: when getFinancialsSnapshot rejects, still calls submitOverallAnalysis with financialsScorecard:undefined (does not throw)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGetFinancialsSnapshot.mockRejectedValueOnce(
            new Error('financials snapshot boom')
        );

        await expect(prewarmOverall('AAPL', 'Apple Inc.', false)).resolves.toBe(
            SUBMITTED_RESULT
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ financialsScorecard: undefined })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            '[prewarmOverall] financials scorecard fetch failed:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('fail-soft: when computeFinancialsScorecard throws (post-fetch), still calls submitOverallAnalysis with financialsScorecard:undefined (does not throw)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGetFinancialsSnapshot.mockResolvedValueOnce(
            {} as FinancialsSnapshot
        );
        mockComputeFinancialsScorecard.mockImplementationOnce(() => {
            throw new Error('scorecard compute boom');
        });

        await expect(prewarmOverall('AAPL', 'Apple Inc.', false)).resolves.toBe(
            SUBMITTED_RESULT
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ financialsScorecard: undefined })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            '[prewarmOverall] financials scorecard fetch failed:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });
});

describe('prewarm seam static guard', () => {
    it('the shared entities/analysis/api.ts source contains no request-context calls', () => {
        expect(SEAM_SOURCE).not.toMatch(
            /next\/headers|getCurrentUser|isBot|cookies|draftMode/
        );
    });
});
