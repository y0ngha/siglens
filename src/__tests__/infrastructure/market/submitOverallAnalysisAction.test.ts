import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { submitOverallAnalysis } from '@y0ngha/siglens-core';
import type {
    ModelId,
    SubmitOverallAnalysisResult,
    EnrichedNewsItem,
    EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import type { AnalysisGateError } from '@/infrastructure/market/byokGate';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitOverallAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));

jest.mock('@/infrastructure/db/newsRepository', () => ({
    DrizzleNewsRepository: jest.fn().mockImplementation(() => ({
        listBySymbol: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/db/earningsCalendarRepository', () => ({
    DrizzleEarningsCalendarRepository: jest.fn().mockImplementation(() => ({
        getNextForSymbol: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('@/infrastructure/market/byokGate', () => ({
    resolveTierAndByok: jest.fn(),
    buildGateError: jest.fn((code: string) => ({ code, message: `mock-${code}` })),
}));

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok } from '@/infrastructure/market/byokGate';

const MockNewsRepository = DrizzleNewsRepository as jest.MockedClass<
    typeof DrizzleNewsRepository
>;
const MockCalRepository = DrizzleEarningsCalendarRepository as jest.MockedClass<
    typeof DrizzleEarningsCalendarRepository
>;

const mockSubmitOverallAnalysis = submitOverallAnalysis as jest.MockedFunction<
    typeof submitOverallAnalysis
>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as jest.MockedFunction<
    typeof resolveTierAndByok
>;

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
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

const UNANALYZED_ROW = {
    ...ANALYZED_ROW,
    id: 'def456',
    titleKo: null,
    bodyKo: null,
    summaryKo: null,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitOverallAnalysisAction 함수는', () => {
    let mockListBySymbol: jest.Mock;
    let mockGetNextForSymbol: jest.Mock;

    beforeEach(() => {
        mockSubmitOverallAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        MockNewsRepository.mockClear();
        MockCalRepository.mockClear();

        mockListBySymbol = jest.fn().mockResolvedValue([]);
        mockGetNextForSymbol = jest.fn().mockResolvedValue(null);

        MockNewsRepository.mockImplementation(
            () => ({ listBySymbol: mockListBySymbol }) as never
        );
        MockCalRepository.mockImplementation(
            () => ({ getNextForSymbol: mockGetNextForSymbol }) as never
        );

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockSubmitOverallAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    // -------------------------------------------------------------------------
    // Existing core logic tests
    // -------------------------------------------------------------------------

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

    it('다음 실적 발표가 있으면 upcomingCalendar에 포함한다', async () => {
        mockGetNextForSymbol.mockResolvedValue(NEXT_EARNINGS);
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

        expect(result).toMatchObject({ status: 'error', axis: 'technical' });
    });

    // -------------------------------------------------------------------------
    // Gate behavior tests
    // -------------------------------------------------------------------------

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
        // Gate fires before expensive DB fetch
        expect(mockSubmitOverallAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier as top-level and technical axis tierContext when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitOverallAnalysisAction('AAPL', 'Apple Inc.', '1Day', MODEL_ID);

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

        await submitOverallAnalysisAction('AAPL', 'Apple Inc.', '1Day', PREMIUM_MODEL);

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

        await submitOverallAnalysisAction('AAPL', 'Apple Inc.', '1Day', PREMIUM_MODEL);

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

        await submitOverallAnalysisAction('AAPL', 'Apple Inc.', '1Day', MODEL_ID);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('technical axis tierContext.userId matches the resolved userId', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-abc' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
        });

        await submitOverallAnalysisAction('AAPL', 'Apple Inc.', '1Day', MODEL_ID);

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg?.technical).toMatchObject({
            tierContext: { userId: 'user-abc', tier: 'pro' },
        });
    });
});
