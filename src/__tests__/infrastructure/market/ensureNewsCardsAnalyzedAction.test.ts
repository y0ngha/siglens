import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';
import { DISABLED_THINKING_BUDGET } from '@/infrastructure/market/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import {
    submitNewsCardAnalysis,
    pollNewsCardAnalysis,
} from '@y0ngha/siglens-core';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import type {
    NewsItem,
    NewsCardAnalysis,
    SubmitNewsCardAnalysisResult,
    PollNewsCardAnalysisResult,
} from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitNewsCardAnalysis: jest.fn(),
    pollNewsCardAnalysis: jest.fn(),
}));

jest.mock('@/shared/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/infrastructure/fmp/newsClient', () => ({
    FmpNewsClient: jest.fn().mockImplementation(() => ({
        fetchNewsForPeriod: jest.fn(),
    })),
}));

jest.mock('@/shared/db/client', () => ({
    getDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));

jest.mock('@/entities/news-article', () => ({
    DrizzleNewsRepository: jest.fn().mockImplementation(() => ({
        upsertNewsItem: jest.fn(),
        attachAnalysis: jest.fn(),
        listBySymbol: jest.fn().mockResolvedValue([]),
    })),
}));

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { DrizzleNewsRepository } from '@/entities/news-article';

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

const mockPollNewsCardAnalysis = pollNewsCardAnalysis as jest.MockedFunction<
    typeof pollNewsCardAnalysis
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
    priceImpact: 'high',
};

const SUBMITTED_RESULT: SubmitNewsCardAnalysisResult = {
    status: 'submitted',
    jobId: 'job-card-001',
};

const POLL_DONE: PollNewsCardAnalysisResult = {
    status: 'done',
    result: CARD_ANALYSIS,
};

const POLL_ERROR: PollNewsCardAnalysisResult = {
    status: 'error',
    error: 'LLM worker failed',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ensureNewsCardsAnalyzedAction 함수는', () => {
    let mockFetchNewsForPeriod: jest.Mock;
    let mockUpsertNewsItem: jest.Mock;
    let mockAttachAnalysis: jest.Mock;
    let mockListBySymbol: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSubmitNewsCardAnalysis.mockReset();
        mockPollNewsCardAnalysis.mockReset();

        mockFetchNewsForPeriod = jest.fn();
        mockUpsertNewsItem = jest.fn().mockResolvedValue(undefined);
        mockAttachAnalysis = jest.fn().mockResolvedValue(undefined);
        mockListBySymbol = jest.fn().mockResolvedValue([]);

        MockFmpNewsClient.mockImplementation(
            () => ({ fetchNewsForPeriod: mockFetchNewsForPeriod }) as never
        );
        MockNewsRepository.mockImplementation(
            () =>
                ({
                    upsertNewsItem: mockUpsertNewsItem,
                    attachAnalysis: mockAttachAnalysis,
                    listBySymbol: mockListBySymbol,
                }) as never
        );
    });

    it('FMP에서 6개월치 뉴스를 가져온다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
            'AAPL',
            NEWS_LOOKBACK_MS
        );
    });

    it('각 뉴스 아이템을 DB에 upsert한다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
        expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
        expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
    });

    it('각 뉴스 아이템에 대해 submitNewsCardAnalysis를 호출한다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
            item: NEWS_ITEM_1,
            thinkingBudget: DISABLED_THINKING_BUDGET,
        });
        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
            item: NEWS_ITEM_2,
            thinkingBudget: DISABLED_THINKING_BUDGET,
        });
    });

    describe('submitted 결과는', () => {
        it('pollNewsCardAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockPollNewsCardAnalysis).toHaveBeenCalledWith(
                SUBMITTED_RESULT.jobId
            );
        });

        it('poll 완료(done) 시 attachAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });

        it('poll 에러(error) 시 attachAnalysis를 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_ERROR);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).not.toHaveBeenCalled();
        });

        it('processing 후 done이 되면 attachAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockPollNewsCardAnalysis).toHaveBeenCalledTimes(3);
            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });
    });

    it('FMP fetch 실패 시 reject하지 않고 조용히 리턴한다', async () => {
        mockFetchNewsForPeriod.mockRejectedValue(
            new Error('FMP network error')
        );

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        expect(mockUpsertNewsItem).not.toHaveBeenCalled();
    });

    it('upsert 실패해도 모든 아이템의 카드 분석을 시도한다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockUpsertNewsItem
            .mockRejectedValueOnce(new Error('DB constraint error'))
            .mockResolvedValueOnce(undefined);
        mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
    });

    it('upsert 과반 실패 시 에러를 throw한다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        // Both upserts fail → 2/2 > 50%, triggers majority-failure throw.
        mockUpsertNewsItem
            .mockRejectedValueOnce(new Error('DB down'))
            .mockRejectedValueOnce(new Error('DB down'));

        await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
            'majority upsert failure'
        );

        expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
    });

    it('카드 분석 실패 시 reject하지 않고 계속 진행한다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1, NEWS_ITEM_2]);
        mockSubmitNewsCardAnalysis
            .mockRejectedValueOnce(new Error('LLM timeout'))
            .mockResolvedValueOnce(SUBMITTED_RESULT);
        mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

        await expect(
            ensureNewsCardsAnalyzedAction('AAPL')
        ).resolves.toBeUndefined();

        expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
        expect(mockAttachAnalysis).toHaveBeenCalledTimes(1);
    });

    describe('DB-first 필터링은', () => {
        it('모든 아이템이 이미 분석 완료(analyzedAt != null)이면 카드 분석을 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: new Date('2025-07-01') },
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockListBySymbol).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('분석 완료된 아이템은 건너뛰고 미분석 아이템만 카드 분석을 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: new Date('2025-07-01') },
                { id: NEWS_ITEM_2.id, analyzedAt: null },
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_2 })
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_1 })
            );
        });

        it('listBySymbol 실패 시 에러를 전파한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockListBySymbol.mockRejectedValue(new Error('DB connection lost'));

            await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
                'DB connection lost'
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('skipAnalysis 옵션은', () => {
        it('true이면 FMP fetch와 DB upsert는 수행하지만 LLM 분석은 건너뛴다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: true,
            });

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockListBySymbol).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('false이면 기존과 동일하게 LLM 분석까지 수행한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: false,
            });

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
        });
    });

    it('뉴스가 없으면 upsert와 카드 분석을 호출하지 않는다', async () => {
        mockFetchNewsForPeriod.mockResolvedValue([]);

        await ensureNewsCardsAnalyzedAction('AAPL');

        expect(mockUpsertNewsItem).not.toHaveBeenCalled();
        expect(mockListBySymbol).not.toHaveBeenCalled();
        expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
    });
});
