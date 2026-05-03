import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';
import { submitNewsCardAnalysis } from '@y0ngha/siglens-core';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import type {
    NewsItem,
    NewsCardAnalysis,
    SubmitNewsCardAnalysisResult,
} from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitNewsCardAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/fmp/newsClient', () => ({
    FmpNewsClient: jest.fn().mockImplementation(() => ({
        fetchNews: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));

jest.mock('@/infrastructure/db/newsRepository', () => ({
    DrizzleNewsRepository: jest.fn().mockImplementation(() => ({
        upsertNewsItem: jest.fn(),
        attachAnalysis: jest.fn(),
    })),
}));

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';

const MockNewsRepository = DrizzleNewsRepository as jest.MockedClass<
    typeof DrizzleNewsRepository
>;
const MockFmpNewsClient = FmpNewsClient as jest.MockedClass<
    typeof FmpNewsClient
>;

const mockSubmitNewsCardAnalysis =
    submitNewsCardAnalysis as jest.MockedFunction<
        typeof submitNewsCardAnalysis
    >;

const NEWS_ITEM_1: NewsItem = {
    id: 'item-001',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl-1',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple Q3 earnings beat',
    bodyEn: 'Apple reported strong Q3 results...',
};

const NEWS_ITEM_2: NewsItem = {
    id: 'item-002',
    symbol: 'AAPL',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/aapl-2',
    publishedAt: '2025-07-02T12:00:00.000Z',
    titleEn: 'Apple launches new iPhone',
    bodyEn: 'Apple announced the new iPhone...',
};

const CARD_ANALYSIS: NewsCardAnalysis = {
    titleKo: '애플 Q3 실적 예상치 상회',
    bodyKo: null,
    summaryKo: '긍정적 실적 발표',
    sentiment: 'bullish',
    category: 'earnings',
};

const CACHED_RESULT: SubmitNewsCardAnalysisResult = {
    status: 'cached',
    result: CARD_ANALYSIS,
};

const SUBMITTED_RESULT: SubmitNewsCardAnalysisResult = {
    status: 'submitted',
    jobId: 'job-card-001',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ensureNewsCardsAnalyzedAction 함수는', () => {
    let mockFetchNews: jest.Mock;
    let mockUpsertNewsItem: jest.Mock;
    let mockAttachAnalysis: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSubmitNewsCardAnalysis.mockReset();

        mockFetchNews = jest.fn();
        mockUpsertNewsItem = jest.fn().mockResolvedValue(undefined);
        mockAttachAnalysis = jest.fn().mockResolvedValue(undefined);

        MockFmpNewsClient.mockImplementation(
            () => ({ fetchNews: mockFetchNews }) as never
        );
        MockNewsRepository.mockImplementation(
            () =>
                ({
                    upsertNewsItem: mockUpsertNewsItem,
                    attachAnalysis: mockAttachAnalysis,
                }) as never
        );
    });

    it('FMP에서 7일치 뉴스를 가져온다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockFetchNews).toHaveBeenCalledWith('AAPL', '7d');
    });

    it('각 뉴스 아이템을 DB에 upsert한다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
        expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
        expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
    });

    it('각 뉴스 아이템에 대해 submitNewsCardAnalysis를 호출한다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
            item: NEWS_ITEM_1,
        });
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
            item: NEWS_ITEM_2,
        });
    });

    it('캐시 결과(cached)가 있으면 attachAnalysis를 호출한다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(CACHED_RESULT);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockAttachAnalysis).toHaveBeenCalledWith(
            NEWS_ITEM_1.id,
            CARD_ANALYSIS,
            expect.any(Date)
        );
    });

    it('submitted 결과면 attachAnalysis를 호출하지 않는다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockAttachAnalysis).not.toHaveBeenCalled();
    });

    it('FMP fetch 실패 시 reject하지 않고 조용히 리턴한다', async () => {
        mockFetchNews.mockRejectedValue(new Error('FMP network error'));

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        expect(mockUpsertNewsItem).not.toHaveBeenCalled();
    });

    it('upsert 실패한 아이템은 건너뛰고 나머지를 처리한다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        // First upsert fails, second succeeds
        mockUpsertNewsItem
            .mockRejectedValueOnce(new Error('DB constraint error'))
            .mockResolvedValueOnce(undefined);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        // Only the second item's card analysis is attempted
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
            item: NEWS_ITEM_2,
        });
    });

    it('카드 분석 실패 시 reject하지 않고 계속 진행한다', async () => {
        mockFetchNews.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis
            .mockRejectedValueOnce(new Error('LLM timeout'))
            .mockResolvedValueOnce(SUBMITTED_RESULT);

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        // Both items attempted; first fails silently, second succeeds
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
    });

    it('뉴스가 없으면 upsert와 카드 분석을 호출하지 않는다', async () => {
        mockFetchNews.mockResolvedValue([]);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockUpsertNewsItem).not.toHaveBeenCalled();
        expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
    });
});
