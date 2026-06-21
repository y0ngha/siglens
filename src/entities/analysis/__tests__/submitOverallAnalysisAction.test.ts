import type { MockedFunction, MockedClass, Mock } from 'vitest';
// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와
// 가독성을 위해 소스 코드에서도 모든 import보다 위에 둔다.
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn(),
}));

// action이 core로 forwarding하는 인자 shape, OI-stale 게이팅, financials scorecard
// 주입을 검증한다. requireActual로 타입 surface를 합치고 핵심 3개 export를 override한다.
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        submitOverallAnalysis: vi.fn(),
        isEtRegularSessionOpen: vi.fn(),
        computeFinancialsScorecard: vi.fn(),
    };
});

vi.mock('@/shared/api/fmp/fundamentalClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/fmp/fundamentalClient')
    >()),
    FmpFundamentalClient: vi.fn().mockImplementation(function () {
        return {};
    }),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/news-article', async () => {
    const actual = await vi.importActual('@/entities/news-article');
    return {
        ...actual,
        DrizzleNewsRepository: vi.fn().mockImplementation(function () {
            return {
                listBySymbol: vi.fn(),
            };
        }),
    };
});

vi.mock('@/entities/earnings-report', () => ({
    getNextEarningsReport: vi.fn(),
}));

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
}));

vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: vi.fn(),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));

vi.mock('@/shared/api/market/sessionSpecFor', async () => {
    const { US_EQUITY_SESSION, CRYPTO_SESSION } = await vi.importActual<
        typeof import('@y0ngha/siglens-core')
    >('@y0ngha/siglens-core');
    return {
        sessionSpecFor: vi.fn((profile: string) =>
            profile === 'crypto' ? CRYPTO_SESSION : US_EQUITY_SESSION
        ),
    };
});

import { submitOverallAnalysisAction } from '../actions/submitOverallAnalysisAction';
import {
    isEtRegularSessionOpen,
    submitOverallAnalysis,
    computeFinancialsScorecard,
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type ModelId,
    type OptionsSnapshot,
    type SubmitOverallAnalysisResult,
    type EnrichedNewsItem,
    type EarningsCalendarItem,
    type FinancialsSnapshot,
    type FinancialsScorecard,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import {
    DrizzleNewsRepository,
    MAX_AGGREGATE_NEWS_ITEMS,
} from '@/entities/news-article';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import type { AnalysisGateError } from '@/shared/lib/types';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;

const mockHeaders = headers as MockedFunction<typeof headers>;
const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockGetNextEarningsReport = getNextEarningsReport as MockedFunction<
    typeof getNextEarningsReport
>;

const mockSubmitOverallAnalysis = submitOverallAnalysis as MockedFunction<
    typeof submitOverallAnalysis
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockFetchSnapshot = fetchOptionsSnapshot as MockedFunction<
    typeof fetchOptionsSnapshot
>;
const mockIsRegularSession = isEtRegularSessionOpen as MockedFunction<
    typeof isEtRegularSessionOpen
>;
const mockIsOiStale = isOpenInterestSnapshotStale as MockedFunction<
    typeof isOpenInterestSnapshotStale
>;
const mockGetFinancialsSnapshot = getFinancialsSnapshot as MockedFunction<
    typeof getFinancialsSnapshot
>;
const mockComputeFinancialsScorecard =
    computeFinancialsScorecard as MockedFunction<
        typeof computeFinancialsScorecard
    >;
const mockGetCachedMarketDataProvider =
    getCachedMarketDataProvider as MockedFunction<
        typeof getCachedMarketDataProvider
    >;
const mockResolveMarketProfile = resolveMarketProfile as MockedFunction<
    typeof resolveMarketProfile
>;

function makeSnapshot(): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice: 150,
        capturedAt: '2026-05-22T13:30:00Z',
        chains: [],
    };
}

const ANALYZED_ROW = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple earnings beat',
    bodyEn: 'Apple reported...',
    titleKo: '애플 실적 예상치 상회',
    bodyKo: '애플이 보고했다...',
    summaryKo: '긍정적 실적 발표',
    sentiment: 'bullish',
    priceImpact: 'positive',
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

const UNANALYZED_ROW = {
    ...ANALYZED_ROW,
    id: 'def456',
    titleKo: null,
    bodyKo: null,
    summaryKo: null,
    priceImpact: null,
    sentiment: null,
    category: null,
    analyzedAt: null,
};

const NEXT_EARNINGS: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: null,
    epsEstimated: 1.4,
    revenueActual: null,
    revenueEstimated: 88_000_000_000,
    lastUpdated: '2025-07-15',
};

const SUBMITTED_RESULT: SubmitOverallAnalysisResult = {
    status: 'submitted',
    jobId: 'job-overall-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('submitOverallAnalysisAction 함수는', () => {
    let mockListBySymbol: Mock;

    beforeEach(() => {
        mockSubmitOverallAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        MockNewsRepository.mockClear();
        mockGetNextEarningsReport.mockReset();
        mockFetchSnapshot.mockReset();
        mockIsRegularSession.mockReset();
        mockIsOiStale.mockReset();
        mockGetFinancialsSnapshot.mockReset();
        mockComputeFinancialsScorecard.mockReset();

        mockListBySymbol = vi.fn().mockResolvedValue([]);
        mockGetNextEarningsReport.mockResolvedValue(null);

        MockNewsRepository.mockImplementation(function () {
            return { listBySymbol: mockListBySymbol } as never;
        });

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        // 기본값: 옵션 스냅샷 없음 + 정규장 외 + stale false 처리.
        // 옵션 axis 통합 전 기존 케이스가 영향받지 않도록 안전한 디폴트.
        mockFetchSnapshot.mockResolvedValue(null);
        mockIsRegularSession.mockReturnValue(false);
        mockIsOiStale.mockReturnValue(false);
        mockSubmitOverallAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        // 기본값: financials 스냅샷 없음 + scorecard undefined (기존 테스트 영향 방지)
        mockGetFinancialsSnapshot.mockResolvedValue({} as FinancialsSnapshot);
        mockComputeFinancialsScorecard.mockReturnValue(
            undefined as unknown as FinancialsScorecard
        );
    });

    it('symbol, timeframe, modelId를 submitOverallAnalysis에 전달한다', async () => {
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                timeframe: '1Day',
                modelId: MODEL_ID,
                marketDataProvider: mockProvider,
            })
        );
    });

    it('titleKo가 null인 미분석 뉴스를 필터링하고 enrichedNews만 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW, UNANALYZED_ROW]);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg?.newsItems).toHaveLength(1);
        const item = callArg?.newsItems?.[0] as EnrichedNewsItem;
        expect(item.card.titleKo).toBe('애플 실적 예상치 상회');
    });

    it('news input은 buildAnalysisNewsItems pipeline을 거쳐 MAX_AGGREGATE_NEWS_ITEMS로 cap된다', async () => {
        // pipeline 자체 검증은 buildAnalysisNewsItems.test.ts에서 망라.
        // 여기는 통합 — overall action이 그 함수를 통과시키는지만 확인.
        const rows = Array.from(
            { length: MAX_AGGREGATE_NEWS_ITEMS + 5 },
            (_, i) => ({
                ...ANALYZED_ROW,
                id: `id-${i}`,
            })
        );
        mockListBySymbol.mockResolvedValue(rows);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg?.newsItems).toHaveLength(MAX_AGGREGATE_NEWS_ITEMS);
    });

    it('다음 실적 발표가 있으면 upcomingCalendar에 포함한다', async () => {
        mockGetNextEarningsReport.mockResolvedValue(NEXT_EARNINGS);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [NEXT_EARNINGS] })
        );
    });

    it('다음 실적 발표가 없으면 upcomingCalendar는 빈 배열이다', async () => {
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(result).toBe(SUBMITTED_RESULT);
    });

    it('내부에서 예외가 발생하면 status: error를 반환한다', async () => {
        mockSubmitOverallAnalysis.mockRejectedValueOnce(
            new Error('unexpected')
        );

        const result = await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        expect(mockSubmitOverallAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier as top-level and technical axis tierContext when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg).toMatchObject({
            tier: 'member',
            technical: { tierContext: { tier: 'member' } },
        });
    });

    it('forwards userApiKey as top-level when present in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
            userApiKey: 'usr-key',
        });

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            PREMIUM_MODEL
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
            // no userApiKey
        });

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            PREMIUM_MODEL
        );

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('technical axis tierContext.userId matches the resolved userId', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-abc' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
        });

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg?.technical).toMatchObject({
            tierContext: { userId: 'user-abc', tier: 'pro' },
        });
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );

        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        await submitOverallAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '1Day',
            MODEL_ID
        );

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    describe('options axis integration', () => {
        it('passes optionsSnapshot + optionsOiStale to core', async () => {
            mockFetchSnapshot.mockResolvedValueOnce(makeSnapshot());
            mockIsRegularSession.mockReturnValueOnce(false);
            mockIsOiStale.mockReturnValueOnce(true);

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({
                    optionsSnapshot: expect.any(Object),
                    optionsOiStale: true,
                })
            );
        });

        it('passes optionsSnapshot=undefined for NoChains symbols', async () => {
            mockFetchSnapshot.mockResolvedValueOnce(null);

            await submitOverallAnalysisAction(
                'SPXUSD',
                'S&P',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ optionsSnapshot: undefined })
            );
        });

        it('forwards force=true through to core', async () => {
            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID,
                { force: true }
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ force: true })
            );
        });

        it('does not force when called without options arg', async () => {
            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.not.objectContaining({ force: true })
            );
        });

        it('passes optionsOiStale=false during regular session even if snapshot stale', async () => {
            mockFetchSnapshot.mockResolvedValueOnce(makeSnapshot());
            mockIsRegularSession.mockReturnValueOnce(true);
            mockIsOiStale.mockReturnValueOnce(true);

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ optionsOiStale: false })
            );
        });

        it('falls back to optionsSnapshot=undefined when fetchOptionsSnapshot rejects', async () => {
            // graceful degradation: 옵션 데이터 fetch가 실패해도 다른 3축으로
            // 종합 분석을 계속 진행해야 한다 (spec §2 row 1 NoChains와 동일 경로).
            mockFetchSnapshot.mockRejectedValueOnce(new Error('timeout'));

            const result = await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({
                    optionsSnapshot: undefined,
                    optionsOiStale: false,
                })
            );
            // 정상 흐름 유지 — error로 빠지지 않는다.
            expect(result).toBe(SUBMITTED_RESULT);
        });
    });

    describe('financials axis integration', () => {
        function makeFinancialsSnapshot(): FinancialsSnapshot {
            return {
                income: [],
                balance: [],
                cashFlow: [],
                incomeGrowth: [],
                financialGrowth: [],
                cashFlowGrowth: [],
            } as unknown as FinancialsSnapshot;
        }

        function makeFinancialsScorecard(): FinancialsScorecard {
            return {
                composite: { grade: 'B' },
            } as unknown as FinancialsScorecard;
        }

        it('financials scorecard를 계산해 core에 전달한다', async () => {
            const snapshot = makeFinancialsSnapshot();
            const scorecard = makeFinancialsScorecard();
            mockGetFinancialsSnapshot.mockResolvedValueOnce(snapshot);
            mockComputeFinancialsScorecard.mockReturnValueOnce(scorecard);

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockGetFinancialsSnapshot).toHaveBeenCalledWith('AAPL');
            expect(mockComputeFinancialsScorecard).toHaveBeenCalledWith(
                snapshot
            );
            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ financialsScorecard: scorecard })
            );
        });

        it('bot 요청(skipEnqueueIfMiss=true)이면 financials fetch를 건너뛴다', async () => {
            mockHeaders.mockResolvedValueOnce(
                new Headers({
                    'user-agent':
                        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                })
            );

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            // bot 트래픽은 financials fetch를 하지 않는다
            expect(mockGetFinancialsSnapshot).not.toHaveBeenCalled();
            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ financialsScorecard: undefined })
            );
        });

        it('financials fetch 실패 시 scorecard=undefined로 overall을 계속 진행한다', async () => {
            mockGetFinancialsSnapshot.mockRejectedValueOnce(
                new Error('financials fetch failed')
            );

            const result = await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            // graceful degradation — error 상태로 빠지지 않는다
            expect(result).toBe(SUBMITTED_RESULT);
            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ financialsScorecard: undefined })
            );
        });
    });

    describe('crypto symbol — session spec routing', () => {
        it('resolveMarketProfile가 "crypto"이면 getCachedMarketDataProvider를 CRYPTO_SESSION으로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('crypto');
            mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

            await submitOverallAnalysisAction(
                'BTCUSD',
                'Bitcoin',
                '1Day',
                MODEL_ID
            );

            expect(mockGetCachedMarketDataProvider).toHaveBeenCalledWith(
                CRYPTO_SESSION
            );
        });

        it('resolveMarketProfile가 "us-equity"이면 getCachedMarketDataProvider를 US_EQUITY_SESSION으로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('us-equity');
            mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockGetCachedMarketDataProvider).toHaveBeenCalledWith(
                US_EQUITY_SESSION
            );
        });
    });

    describe('assetClass forwarding', () => {
        it('resolveMarketProfile가 "crypto"이면 submitOverallAnalysis를 assetClass: "crypto"로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('crypto');
            mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

            await submitOverallAnalysisAction(
                'BTCUSD',
                'Bitcoin',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'crypto' })
            );
        });

        it('resolveMarketProfile가 "us-equity"이면 submitOverallAnalysis를 assetClass: "equity"로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('us-equity');
            mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

            await submitOverallAnalysisAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MODEL_ID
            );

            expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'equity' })
            );
        });
    });
});
