import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { submitOverallAnalysis } from '@y0ngha/siglens-core';
import type {
    ModelId,
    SubmitOverallAnalysisResult,
    EnrichedNewsItem,
    EarningsCalendarItem,
} from '@y0ngha/siglens-core';

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

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';

const MockNewsRepository = DrizzleNewsRepository as jest.MockedClass<
    typeof DrizzleNewsRepository
>;
const MockCalRepository = DrizzleEarningsCalendarRepository as jest.MockedClass<
    typeof DrizzleEarningsCalendarRepository
>;

const mockSubmitOverallAnalysis = submitOverallAnalysis as jest.MockedFunction<
    typeof submitOverallAnalysis
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitOverallAnalysisAction 함수는', () => {
    let mockListBySymbol: jest.Mock;
    let mockGetNextForSymbol: jest.Mock;

    beforeEach(() => {
        mockSubmitOverallAnalysis.mockReset();
        MockNewsRepository.mockClear();
        MockCalRepository.mockClear();

        mockListBySymbol = jest.fn();
        mockGetNextForSymbol = jest.fn();

        MockNewsRepository.mockImplementation(
            () => ({ listBySymbol: mockListBySymbol }) as never
        );
        MockCalRepository.mockImplementation(
            () => ({ getNextForSymbol: mockGetNextForSymbol }) as never
        );
    });

    it('symbol, timeframe, modelId를 submitOverallAnalysis에 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction('AAPL', '1Day', MODEL_ID);

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
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction('AAPL', '1Day', MODEL_ID);

        const callArg = mockSubmitOverallAnalysis.mock.calls[0]?.[0];
        expect(callArg?.newsItems).toHaveLength(1);
        const item = callArg?.newsItems?.[0] as EnrichedNewsItem;
        expect(item.card.titleKo).toBe('애플 실적 예상치 상회');
    });

    it('다음 실적 발표가 있으면 upcomingCalendar에 포함한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(NEXT_EARNINGS);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction('AAPL', '1Day', MODEL_ID);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [NEXT_EARNINGS] })
        );
    });

    it('다음 실적 발표가 없으면 upcomingCalendar는 빈 배열이다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitOverallAnalysisAction('AAPL', '1Day', MODEL_ID);

        expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitOverallAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitOverallAnalysisAction(
            'AAPL',
            '1Day',
            MODEL_ID
        );

        expect(result).toBe(SUBMITTED_RESULT);
    });

    it('내부에서 예외가 발생하면 status: error를 반환한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitOverallAnalysis.mockRejectedValueOnce(
            new Error('unexpected')
        );

        const result = await submitOverallAnalysisAction(
            'AAPL',
            '1Day',
            MODEL_ID
        );

        expect(result).toMatchObject({ status: 'error', axis: 'technical' });
    });
});
