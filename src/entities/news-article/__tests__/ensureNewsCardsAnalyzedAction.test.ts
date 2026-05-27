import type { MockedFunction, MockedClass, Mock } from 'vitest';
import { ensureNewsCardsAnalyzedAction } from '../actions/ensureNewsCardsAnalyzedAction';
import { DISABLED_THINKING_BUDGET } from '../lib/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import {
    submitNewsCardAnalysis,
    pollNewsCardAnalysis,
} from '@y0ngha/siglens-core';
import { FmpNewsClient } from '../lib/fmpNewsClient';
import type {
    NewsItem,
    NewsCardAnalysis,
    SubmitNewsCardAnalysisResult,
    PollNewsCardAnalysisResult,
} from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitNewsCardAnalysis: vi.fn(),
    pollNewsCardAnalysis: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/fmpNewsClient', () => ({
    FmpNewsClient: vi.fn().mockImplementation(function () {
        return {
            fetchNewsForPeriod: vi.fn(),
        };
    }),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/news-article', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return {
            upsertNewsItem: vi.fn(),
            attachAnalysis: vi.fn(),
            listBySymbol: vi.fn().mockResolvedValue([]),
        };
    }),
}));

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { DrizzleNewsRepository } from '@/entities/news-article';

const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const MockFmpNewsClient = FmpNewsClient as MockedClass<typeof FmpNewsClient>;

const mockSubmitNewsCardAnalysis = submitNewsCardAnalysis as MockedFunction<
    typeof submitNewsCardAnalysis
>;

const mockPollNewsCardAnalysis = pollNewsCardAnalysis as MockedFunction<
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
    let mockFetchNewsForPeriod: Mock;
    let mockUpsertNewsItem: Mock;
    let mockAttachAnalysis: Mock;
    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitNewsCardAnalysis.mockReset();
        mockPollNewsCardAnalysis.mockReset();

        mockFetchNewsForPeriod = vi.fn();
        mockUpsertNewsItem = vi.fn().mockResolvedValue(undefined);
        mockAttachAnalysis = vi.fn().mockResolvedValue(undefined);
        mockListBySymbol = vi.fn().mockResolvedValue([]);

        MockFmpNewsClient.mockImplementation(function () {
            return { fetchNewsForPeriod: mockFetchNewsForPeriod } as never;
        });
        MockNewsRepository.mockImplementation(function () {
            return {
                upsertNewsItem: mockUpsertNewsItem,
                attachAnalysis: mockAttachAnalysis,
                listBySymbol: mockListBySymbol,
            } as never;
        });
    });

    describe('정상 흐름에서', () => {
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
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
        });

        it('각 뉴스 아이템에 대해 submitNewsCardAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
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

        it('뉴스가 없으면 upsert와 카드 분석을 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockListBySymbol).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
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

    describe('오류 처리에서', () => {
        it('FMP fetch 실패 시 reject하지 않고 조용히 리턴한다', async () => {
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP network error')
            );

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
        });

        it('FMP 429 fetch 실패 시 서버 로그를 남기지 않고 조용히 리턴한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP news/stock 429')
            );

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('upsert 실패해도 모든 아이템의 카드 분석을 시도한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
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
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
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
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
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
});
