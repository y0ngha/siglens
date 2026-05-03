import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { submitNewsAnalysis } from '@y0ngha/siglens-core';
import type {
    ModelId,
    SubmitNewsAnalysisResult,
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
    submitNewsAnalysis: jest.fn(),
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

const mockSubmitNewsAnalysis = submitNewsAnalysis as jest.MockedFunction<
    typeof submitNewsAnalysis
>;

/** An analyzed DB news row (has titleKo, summaryKo, sentiment, category). */
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

/** An unanalyzed DB news row (titleKo is null). */
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

const SUBMITTED_RESULT: SubmitNewsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-news-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitNewsAnalysisAction 함수는', () => {
    let mockListBySymbol: jest.Mock;
    let mockGetNextForSymbol: jest.Mock;

    beforeEach(() => {
        mockSubmitNewsAnalysis.mockReset();
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

    it('symbol과 modelId를 siglens-core submitNewsAnalysis에 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'AAPL', modelId: MODEL_ID })
        );
    });

    it('titleKo가 null인 미분석 뉴스를 필터링하고 enrichedNews만 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW, UNANALYZED_ROW]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', MODEL_ID);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg?.news).toHaveLength(1);
        const item = callArg?.news[0] as EnrichedNewsItem;
        expect(item.id).toBe('abc123');
        expect(item.card.titleKo).toBe('애플 실적 예상치 상회');
    });

    it('다음 실적 발표가 있으면 upcomingCalendar에 포함한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextForSymbol.mockResolvedValue(NEXT_EARNINGS);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                upcomingCalendar: [NEXT_EARNINGS],
            })
        );
    });

    it('다음 실적 발표가 없으면 upcomingCalendar를 빈 배열로 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextForSymbol.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);
        const noNewsResult: SubmitNewsAnalysisResult = {
            status: 'error',
            code: 'no_news',
            error: 'No news items provided.',
        };
        mockSubmitNewsAnalysis.mockResolvedValueOnce(noNewsResult);

        const result = await submitNewsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(noNewsResult);
    });
});
