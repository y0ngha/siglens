import type { MockedClass, Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { MOCK_CRYPTO_SESSION, MOCK_EQUITY_SESSION } = vi.hoisted(() => ({
    MOCK_CRYPTO_SESSION: { type: 'crypto' } as never,
    MOCK_EQUITY_SESSION: { type: 'equity' } as never,
}));

// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와 가독성을
// 위해 소스 코드에서도 모든 import보다 위에 둔다 (runOverallAnalysisAction.test.ts와 동일 패턴).
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        runAnalysis: vi.fn(),
        runFundamentalAnalysis: vi.fn(),
        runFinancialsAnalysis: vi.fn(),
        runCongressTrend: vi.fn(),
        runOverallAnalysis: vi.fn(),
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
    runAnalysis,
    runFundamentalAnalysis,
    runFinancialsAnalysis,
    runCongressTrend,
    runOverallAnalysis,
    isEtRegularSessionOpen,
    computeFinancialsScorecard,
    DEEPSEEK_V4_FLASH_MODEL,
    type RunAnalysisResult,
    type RunFundamentalAnalysisResult,
    type RunFinancialsAnalysisResult,
    type RunCongressTrendResult,
    type RunOverallAnalysisResult,
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

const mockRunAnalysis = vi.mocked(runAnalysis);
const mockRunFundamentalAnalysis = vi.mocked(runFundamentalAnalysis);
const mockRunFinancialsAnalysis = vi.mocked(runFinancialsAnalysis);
const mockRunCongressTrend = vi.mocked(runCongressTrend);
const mockRunOverallAnalysis = vi.mocked(runOverallAnalysis);
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
    const cachedResult: RunAnalysisResult = {
        status: 'cached',
        result: { summary: 'cached' } as never,
        lockedInfoDepth: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunAnalysis.mockResolvedValue(cachedResult);
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetCachedMarketDataProvider.mockReturnValue(mockProvider);
    });

    it('calls runAnalysis with the anonymous-free branch shape (modelId default, skipEnqueueIfMiss:false, tier:free, reasoning:false, no bucket)', async () => {
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, false);

        expect(mockRunAnalysis).toHaveBeenCalledWith(
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

        const lastCall = mockRunAnalysis.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        expect(lastCall![3]).toBe(true);
    });

    it('forwards fmpSymbol through to submitAnalysis', async () => {
        await prewarmTechnical('BTCUSD', 'Bitcoin', '^BTCUSD', false);

        expect(mockRunAnalysis).toHaveBeenCalledWith(
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
    const cachedResult: RunFundamentalAnalysisResult = {
        status: 'cached',
        result: { categories: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunFundamentalAnalysis.mockResolvedValue(cachedResult);
        mockGetFundamentalDataProvider.mockReturnValue(mockFundamentalProvider);
    });

    it('calls runFundamentalAnalysis with the anonymous-free branch shape', async () => {
        await prewarmFundamental('AAPL', false);

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith({
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

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmFundamental('AAPL', false);

        const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmFinancials', () => {
    const cachedResult: RunFinancialsAnalysisResult = {
        status: 'cached',
        result: { categories: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunFinancialsAnalysis.mockResolvedValue(cachedResult);
        mockGetFinancialStatementsProvider.mockReturnValue(
            mockFinancialsProvider
        );
    });

    it('calls runFinancialsAnalysis with the anonymous-free branch shape', async () => {
        await prewarmFinancials('AAPL', false);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith({
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

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmFinancials('AAPL', false);

        const callArg = mockRunFinancialsAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmCongress', () => {
    const cachedResult: RunCongressTrendResult = {
        status: 'cached',
        result: { trades: [] } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunCongressTrend.mockResolvedValue(cachedResult);
        mockGetCongressTradesProvider.mockReturnValue(mockCongressProvider);
    });

    it('calls runCongressTrend with the anonymous-free branch shape (no BYOK gate)', async () => {
        await prewarmCongress('AAPL', false);

        expect(mockRunCongressTrend).toHaveBeenCalledWith({
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

        expect(mockRunCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmCongress('AAPL', false);

        const callArg = mockRunCongressTrend.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });
});

describe('prewarmOverall', () => {
    const SUBMITTED_RESULT: RunOverallAnalysisResult = {
        status: 'done',
        result: { summary: 'ok' } as never,
    };

    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetCachedMarketDataProvider.mockReturnValue(mockProvider);
        mockGetFundamentalDataProvider.mockReturnValue(mockFundamentalProvider);
        mockRunOverallAnalysis.mockResolvedValue(SUBMITTED_RESULT);
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

    it('calls runOverallAnalysis with the anonymous-free branch shape', async () => {
        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
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

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmOverall('AAPL', 'Apple Inc.', false);

        const callArg = mockRunOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });

    it('fetches options snapshot even though skipEnqueueIfMiss is false (unlike the bot-gated action)', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(makeSnapshot());

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockFetchOptionsSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ optionsSnapshot: expect.any(Object) })
        );
    });

    it('passes optionsSnapshot=undefined when fetchOptionsSnapshot returns null', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);

        await prewarmOverall('AAPL', 'Apple Inc.', false);

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
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
        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
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

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [next] })
        );
    });

    it('fail-soft: when fetchOptionsSnapshot rejects, still calls runOverallAnalysis with optionsSnapshot:undefined (does not throw)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockFetchOptionsSnapshot.mockRejectedValueOnce(
            new Error('options fetch boom')
        );

        await expect(prewarmOverall('AAPL', 'Apple Inc.', false)).resolves.toBe(
            SUBMITTED_RESULT
        );

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ optionsSnapshot: undefined })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            '[prewarmOverall] options snapshot fetch failed:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('fail-soft: when getFinancialsSnapshot rejects, still calls runOverallAnalysis with financialsScorecard:undefined (does not throw)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGetFinancialsSnapshot.mockRejectedValueOnce(
            new Error('financials snapshot boom')
        );

        await expect(prewarmOverall('AAPL', 'Apple Inc.', false)).resolves.toBe(
            SUBMITTED_RESULT
        );

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ financialsScorecard: undefined })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            '[prewarmOverall] financials scorecard fetch failed:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('fail-soft: when computeFinancialsScorecard throws (post-fetch), still calls runOverallAnalysis with financialsScorecard:undefined (does not throw)', async () => {
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

        expect(mockRunOverallAnalysis).toHaveBeenCalledWith(
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
